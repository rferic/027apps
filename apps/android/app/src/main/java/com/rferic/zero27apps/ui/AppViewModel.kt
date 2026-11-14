package com.rferic.zero27apps.ui

import android.app.Application
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.rferic.zero27apps.BuildConfig
import com.rferic.zero27apps.InstanceStore
import com.rferic.zero27apps.ServerUrl
import com.rferic.zero27apps.auth.EncryptedStringStore
import com.rferic.zero27apps.auth.InvitationLink
import com.rferic.zero27apps.auth.KeystoreSecretCipher
import com.rferic.zero27apps.auth.SupabaseFactory
import com.rferic.zero27apps.data.ApiClient
import com.rferic.zero27apps.data.ApiException
import com.rferic.zero27apps.data.PatchMeRequest
import com.rferic.zero27apps.data.RedeemRequest
import com.rferic.zero27apps.prefs.PrefsStringStore
import com.rferic.zero27apps.update.UpdateThrottle
import com.rferic.zero27apps.update.Updater
import com.rferic.zero27apps.FcmRegistrar
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.ktor.client.engine.okhttp.OkHttp
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

enum class LoginError { WRONG_CREDENTIALS, EMAIL_UNCONFIRMED, GENERIC }

/** Result of the last login attempt, so the form can show a message. */
data class LoginState(val pending: Boolean = false, val error: LoginError? = null)

/**
 * Owns the session: boots against the build-time instance, restores the
 * encrypted Supabase session, and loads the profile and modules through the
 * Core API. Everything the UI does is one method here, so previews and tests
 * never build their own clients.
 */
class AppViewModel(application: Application) : AndroidViewModel(application) {
    private val prefs = PrefsStringStore(application)
    private val instanceStore = InstanceStore(prefs, BuildConfig.DEFAULT_INSTANCE_URL)
    private val sessionStore = EncryptedStringStore(
        KeystoreSecretCipher(),
        prefs,
        "session",
    )
    private val supabaseFactory = SupabaseFactory(sessionStore)

    private val _state = MutableStateFlow<AppState>(AppState.Loading)
    val state: StateFlow<AppState> = _state.asStateFlow()

    private val _login = MutableStateFlow(LoginState())
    val login: StateFlow<LoginState> = _login.asStateFlow()

    private val updater = Updater(application)
    private val updateThrottle = UpdateThrottle(prefs)

    private val _update = MutableStateFlow<UpdateState>(UpdateState.None)
    val update: StateFlow<UpdateState> = _update.asStateFlow()

    private val _invite = MutableStateFlow(InviteState())
    val invite: StateFlow<InviteState> = _invite.asStateFlow()

    private var pendingLink: InvitationLink? = null

    /** Instances the chooser offers: the build default plus the saved ones. */
    private val _instances = MutableStateFlow(instanceStore.known())
    val instances: StateFlow<List<String>> = _instances.asStateFlow()

    private var supabase: SupabaseClient? = null
    private var client: ApiClient? = null

    init {
        refresh()
    }

    /** Retry from a failure screen, or after changing the instance. */
    /**
     * Asks the instance for its latest Android build. Silent on failure: an
     * updater that cannot check is not worth a screen.
     */
    fun checkForUpdate(manual: Boolean = false) {
        val api = client ?: return
        // Automatic checks are throttled; the Settings button always asks.
        if (!manual && !updateThrottle.shouldCheck()) return
        updateThrottle.markChecked()
        if (manual) _update.value = UpdateState.Checking
        viewModelScope.launch {
            runCatching { api.androidApp() }
                .onSuccess { release ->
                    _update.value = if (release.versionCode > BuildConfig.VERSION_CODE) {
                        UpdateState.Available(release.versionName, release.apkUrl)
                    } else {
                        if (manual) UpdateState.UpToDate else UpdateState.None
                    }
                }
                .onFailure {
                    // The automatic check is silent; a manual one must answer.
                    if (manual) _update.value = UpdateState.Failed
                }
        }
    }

    /** Downloads the new APK and hands it to the system installer. */
    fun installUpdate() {
        val available = _update.value as? UpdateState.Available ?: return
        _update.value = UpdateState.Downloading
        updater.downloadAndInstall(available.apkUrl, instanceStore.current()) { result ->
            _update.value = result.fold(
                onSuccess = { UpdateState.Installing },
                onFailure = { UpdateState.Failed },
            )
        }
    }

    /** The signed-in API client, for module screens (null before boot). */
    fun api(): ApiClient? = client

    /** The active instance, for screens that are not signed in yet. */
    fun currentInstance(): String = instanceStore.current()

    fun refresh() {
        viewModelScope.launch { boot() }
    }

    /** Entry point for an invitation deep link, from either activity callback. */
    fun onInviteLink(raw: String) {
        val link = InvitationLink.parse(raw) ?: return
        pendingLink = link
        _invite.value = InviteState()
        _state.value = AppState.NeedsInvite(link)
    }

    fun cancelInvite() {
        pendingLink = null
        _invite.value = InviteState()
        refresh()
    }

    /**
     * Redeems the invitation on the link's own instance, then signs the new
     * account in and loads the shell. The instance is remembered, so the next
     * launch opens there.
     */
    fun acceptInvite(email: String, password: String, displayName: String?) {
        val link = pendingLink ?: return
        _invite.value = InviteState(pending = true)
        viewModelScope.launch {
            try {
                val api = apiFor(link.instance)
                api.redeemInvitation(
                    link.token,
                    RedeemRequest(
                        email = email.trim(),
                        password = password,
                        displayName = displayName?.trim()?.takeIf { it.isNotEmpty() },
                    ),
                )
                val instance = api.instance()
                val auth = instance.auth ?: throw ApiException("auth_unavailable", 503)
                val supabaseClient = supabaseFactory.create(auth.supabaseUrl, auth.supabaseAnonKey)
                supabase = supabaseClient
                supabaseClient.auth.awaitInitialization()
                supabaseClient.auth.signInWith(Email) {
                    this.email = email.trim()
                    this.password = password
                }
                val me = api.me()
                val modules = api.myModules().modules
                val widgets = runCatching { api.dashboard("app").widgets }.getOrDefault(emptyList())
                instanceStore.save(link.instance)
                _instances.value = instanceStore.known()
                pendingLink = null
                _invite.value = InviteState()
                _state.value = AppState.SignedIn(link.instance, me, modules, widgets)
                registerPush(link.instance, supabaseClient)
            } catch (error: ApiException) {
                _invite.value = InviteState(error = inviteError(error))
            } catch (_: Exception) {
                _invite.value = InviteState(error = InviteError.GENERIC)
            }
        }
    }

    fun login(email: String, password: String) {
        val api = client ?: return
        _login.value = LoginState(pending = true)
        viewModelScope.launch {
            try {
                val auth = supabase ?: error("Supabase client is not ready")
                auth.auth.signInWith(Email) {
                    this.email = email.trim()
                    this.password = password
                }
                val me = api.me()
                val modules = api.myModules().modules
                val widgets = runCatching { api.dashboard("app").widgets }.getOrDefault(emptyList())
                _login.value = LoginState()
                _state.value = AppState.SignedIn(instanceStore.current(), me, modules, widgets)
                registerPush(instanceStore.current(), supabase)
            } catch (error: Exception) {
                _login.value = LoginState(error = loginError(error))
            }
        }
    }

    fun signOut() {
        viewModelScope.launch {
            runCatching { supabase?.auth?.signOut() }
            sessionStore.clear()
            _login.value = LoginState()
            awaitLogin()
        }
    }

    /** Registers this installation for push once there is a session. */
    private fun registerPush(instance: String, supabaseClient: SupabaseClient?) {
        val jwt = supabaseClient?.auth?.currentSessionOrNull()?.accessToken
        if (jwt == null) {
            Log.w("Push", "no session token yet; skipping FCM registration")
            return
        }
        FcmRegistrar(getApplication()).configure(instance, jwt) { result ->
            result.exceptionOrNull()?.let { Log.w("Push", "FCM registration failed", it) }
        }
    }

    /** Theme or locale: PATCH /me and refresh the cached profile. */
    fun updateProfile(theme: String? = null, locale: String? = null) {
        val api = client ?: return
        val current = _state.value as? AppState.SignedIn ?: return
        viewModelScope.launch {
            try {
                val user = api.patchMe(PatchMeRequest(theme = theme, locale = locale))
                _state.value = current.copy(user = user)
            } catch (_: ApiException) {
                // Keep the old value: the picker re-renders from the state.
            }
        }
    }

    /**
     * Adds an instance to the chooser without switching to it. Returns the
     * normalised URL, or null when the build cannot accept it.
     */
    fun rememberInstance(raw: String): String? {
        val normalized = ServerUrl.normalize(raw, requireHttps = !BuildConfig.DEBUG) ?: return null
        instanceStore.remember(normalized)
        _instances.value = instanceStore.known()
        return normalized
    }

    /** Points the app at another instance and starts signed out. */
    fun changeInstance(raw: String): Boolean {
        val normalized = ServerUrl.normalize(raw, requireHttps = !BuildConfig.DEBUG) ?: return false
        viewModelScope.launch {
            runCatching { supabase?.auth?.signOut() }
            sessionStore.clear()
            client?.close()
            client = null
            supabase = null
            instanceStore.save(normalized)
            _instances.value = instanceStore.known()
            boot()
        }
        return true
    }

    private suspend fun boot() {
        _state.value = AppState.Loading
        // Pin on first boot so an update never moves the install to another
        // instance just because the new build compiled a different default.
        val base = instanceStore.pinDefault()
        try {
            val api = apiFor(base)
            val instance = api.instance()
            val auth = instance.auth ?: throw ApiException("auth_unavailable", 503)
            val supabaseClient = supabaseFactory.create(auth.supabaseUrl, auth.supabaseAnonKey)
            supabase = supabaseClient
            supabaseClient.auth.awaitInitialization()
            // Before the session branch: a fresh install must be able to update
            // from the login screen, without signing in first.
            checkForUpdate()
            if (supabaseClient.auth.currentSessionOrNull() == null) {
                _state.value = AppState.NeedsLogin(base)
                return
            }
            val me = api.me()
            val modules = api.myModules().modules
            val widgets = runCatching { api.dashboard("app").widgets }.getOrDefault(emptyList())
            _state.value = AppState.SignedIn(base, me, modules, widgets)
            registerPush(base, supabase)
        } catch (error: ApiException) {
            _state.value = AppState.Failure(failureReason(error))
        } catch (_: Exception) {
            _state.value = AppState.Failure(FailureReason.UNKNOWN)
        }
    }

    private suspend fun awaitLogin() {
        _state.value = AppState.NeedsLogin(instanceStore.current())
    }

    private fun apiFor(base: String): ApiClient {
        client?.close()
        val api = ApiClient(
            baseUrl = base,
            engine = OkHttp.create(),
            token = { supabase?.auth?.currentSessionOrNull()?.accessToken },
            refresh = {
                val auth = supabase ?: return@ApiClient false
                runCatching {
                    auth.auth.refreshCurrentSession()
                    true
                }.getOrDefault(false)
            },
        )
        client = api
        return api
    }

    private fun failureReason(error: ApiException): FailureReason = when {
        error.network -> FailureReason.NETWORK
        error.code == "auth_unavailable" -> FailureReason.AUTH_UNAVAILABLE
        else -> FailureReason.UNKNOWN
    }

    private fun inviteError(error: ApiException): InviteError = when {
        error.code == "invitation_expired" -> InviteError.EXPIRED
        error.code == "invitation_used" -> InviteError.USED
        error.code == "not_found" -> InviteError.NOT_FOUND
        error.code == "email_mismatch" -> InviteError.EMAIL_MISMATCH
        error.network -> InviteError.NETWORK
        else -> InviteError.GENERIC
    }

    private fun loginError(error: Exception): LoginError {
        val text = error.message.orEmpty()
        return when {
            text.contains("Invalid login", ignoreCase = true) -> LoginError.WRONG_CREDENTIALS
            text.contains("Email not confirmed", ignoreCase = true) -> LoginError.EMAIL_UNCONFIRMED
            else -> LoginError.GENERIC
        }
    }

    override fun onCleared() {
        client?.close()
        super.onCleared()
    }
}
