package com.rferic.zero27apps.ui

import android.app.Application
import android.util.Log
import androidx.glance.appwidget.updateAll
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.rferic.zero27apps.BuildConfig
import com.rferic.zero27apps.InstanceStore
import com.rferic.zero27apps.ServerUrl
import com.rferic.zero27apps.auth.EncryptedStringStore
import com.rferic.zero27apps.auth.InvitationLink
import com.rferic.zero27apps.auth.KeystoreSecretCipher
import com.rferic.zero27apps.auth.SupabaseFactory
import com.rferic.zero27apps.auth.refreshOutcome
import com.rferic.zero27apps.data.ApiClient
import com.rferic.zero27apps.data.ApiException
import com.rferic.zero27apps.data.PatchMeRequest
import com.rferic.zero27apps.data.RedeemRequest
import com.rferic.zero27apps.data.RefreshResult
import io.github.jan.supabase.auth.SignOutScope
import com.rferic.zero27apps.prefs.PrefsStringStore
import com.rferic.zero27apps.update.UpdateThrottle
import com.rferic.zero27apps.update.Updater
import com.rferic.zero27apps.FcmRegistrar
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.ktor.client.engine.okhttp.OkHttp
import kotlinx.coroutines.Job
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
    private companion object {
        const val PRIVACY_KEY = "privacy.masked"
        const val LOCATION_KEY = "shell.location"
    }

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
    /** The eye: only amounts are masked; the choice is remembered (default open). */
    private val _privacyMasked = MutableStateFlow(prefs.get(PRIVACY_KEY) == "true")
    val privacyMasked: StateFlow<Boolean> = _privacyMasked.asStateFlow()

    private val _update = MutableStateFlow<UpdateState>(UpdateState.None)
    val update: StateFlow<UpdateState> = _update.asStateFlow()

    private val _invite = MutableStateFlow(InviteState())
    val invite: StateFlow<InviteState> = _invite.asStateFlow()

    private var pendingLink: InvitationLink? = null
    /** The boot in flight; a deep link cancels it so it cannot overwrite the invite. */
    private var bootJob: Job? = null

    /** Instances the chooser offers: the build default plus the saved ones. */
    private val _instances = MutableStateFlow(instanceStore.known())
    val instances: StateFlow<List<String>> = _instances.asStateFlow()

    private var supabase: SupabaseClient? = null
    private var client: ApiClient? = null
    private var revalidating = false

    init {
        refresh()
    }

    /** Retry from a failure screen, or after changing the instance. */
    /**
     * Asks the instance for its latest Android build. Silent on failure: an
     * updater that cannot check is not worth a screen.
     */
    private var bootCheckDone = false

    fun checkForUpdate(manual: Boolean = false) {
        val api = client ?: return
        // The first check of a launch always runs, so a new build shows up as
        // soon as the app opens; later automatic checks keep the six-hour throttle.
        val firstOfLaunch = !manual && !bootCheckDone
        if (!manual && !firstOfLaunch && !updateThrottle.shouldCheck()) return
        bootCheckDone = true
        updateThrottle.markChecked()
        if (manual) _update.value = UpdateState.Checking
        viewModelScope.launch {
            runCatching { api.androidApp() }
                .onSuccess { release ->
                    _update.value = if (release.versionCode > BuildConfig.VERSION_CODE) {
                        UpdateState.Available(release.versionName, release.apkUrl, release.sha256)
                    } else {
                        // A successful check always leaves the row settled: no button
                        // inviting a second check seconds later.
                        UpdateState.UpToDate
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
        updater.downloadAndInstall(available.apkUrl, instanceStore.current(), available.sha256) { result ->
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
        bootJob?.cancel()
        bootJob = viewModelScope.launch { boot() }
    }

    /** Entry point for an invitation deep link, from either activity callback. */
    fun onInviteLink(raw: String) {
        val link = InvitationLink.parse(raw) ?: return
        // The link wins over a boot that is still resolving the session.
        bootJob?.cancel()
        pendingLink = link
        _invite.value = InviteState(loading = true)
        _state.value = AppState.NeedsInvite(link)
        viewModelScope.launch {
            try {
                val preview = apiFor(link.instance).invitationPreview(link.token)
                _invite.value = InviteState(preview = preview)
            } catch (error: ApiException) {
                _invite.value = InviteState(error = inviteError(error))
            } catch (error: Exception) {
                if (error is kotlinx.coroutines.CancellationException) throw error
                _invite.value = InviteState(error = InviteError.GENERIC)
            }
        }
    }

    fun cancelInvite() {
        pendingLink = null
        _invite.value = InviteState()
        refresh()
    }

    /**
     * Redeems the invitation on the link's own instance and opens the shell.
     *
     * Session first (D21): an existing account signs in with its current
     * password **before** the redemption, so a wrong password never consumes
     * the invitation. A new account redeems first and signs in afterwards; if
     * that sign-in fails the account still exists and the user is sent to login
     * once, never a second redemption.
     */
    fun acceptInvite(password: String) {
        val link = pendingLink ?: return
        val preview = _invite.value.preview ?: return
        if (preview.state != "pending" || _invite.value.pending) return
        _invite.value = _invite.value.copy(pending = true, error = null)

        viewModelScope.launch {
            try {
                val api = client ?: apiFor(link.instance)
                // A session from another instance is never reused or switched silently.
                if (instanceStore.current() != link.instance) {
                    sessionStore.clear()
                    supabase = null
                }

                if (preview.accountExists) {
                    val supabaseClient = try {
                        signInForInvite(api, preview.email, password)
                    } catch (error: Exception) {
                        if (error is kotlinx.coroutines.CancellationException) throw error
                        _invite.value = InviteState(
                            preview = preview,
                            error = when {
                                isWrongCredentials(error) -> InviteError.WRONG_CREDENTIALS
                                error.isNetworkFailure() -> InviteError.NETWORK
                                else -> InviteError.GENERIC
                            },
                        )
                        return@launch
                    }
                    api.resetSessionState()
                    api.redeemInvitation(link.token, RedeemRequest(email = preview.email))
                    openInvitationSession(api, link, supabaseClient)
                    return@launch
                }

                api.redeemInvitation(
                    link.token,
                    RedeemRequest(email = preview.email, password = password),
                )
                val supabaseClient = try {
                    signInForInvite(api, preview.email, password)
                } catch (error: Exception) {
                    if (error is kotlinx.coroutines.CancellationException) throw error
                    // The account exists: a failed sign-in is a login notice, not
                    // another redemption attempt.
                    _invite.value = InviteState()
                    instanceStore.save(link.instance)
                    _instances.value = instanceStore.known()
                    _state.value = AppState.NeedsLogin(
                        link.instance,
                        LoginNotice.INVITATION_ACCEPTED,
                    )
                    return@launch
                }
                api.resetSessionState()
                openInvitationSession(api, link, supabaseClient)
            } catch (error: ApiException) {
                _invite.value = InviteState(preview = preview, error = inviteError(error))
            } catch (error: Exception) {
                if (error is kotlinx.coroutines.CancellationException) throw error
                _invite.value = InviteState(
                    preview = preview,
                    error = if (error.isNetworkFailure()) InviteError.NETWORK else InviteError.GENERIC,
                )
            }
        }
    }

    /** Creates the link instance's Supabase client and signs in with its password. */
    private suspend fun signInForInvite(
        api: ApiClient,
        email: String,
        password: String,
    ): SupabaseClient {
        val instance = api.instance()
        val auth = instance.auth ?: throw ApiException("auth_unavailable", 503)
        val supabaseClient = supabaseFactory.create(auth.supabaseUrl, auth.supabaseAnonKey)
        supabase = supabaseClient
        supabaseClient.auth.awaitInitialization()
        supabaseClient.auth.signInWith(Email) {
            this.email = email
            this.password = password
        }
        return supabaseClient
    }

    /** Loads the shell after a redemption and remembers the link's instance. */
    private suspend fun openInvitationSession(
        api: ApiClient,
        link: InvitationLink,
        supabaseClient: SupabaseClient,
    ) {
        val me = api.me()
        val modules = api.myModules().modules
        val widgets = runCatching { api.dashboard("app").widgets }.getOrDefault(emptyList())
        instanceStore.save(link.instance)
        _instances.value = instanceStore.known()
        pendingLink = null
        _invite.value = InviteState()
        _state.value = AppState.SignedIn(link.instance, me, modules, widgets)
        registerPush(link.instance, supabaseClient)
    }

    fun login(email: String, password: String) {
        _login.value = LoginState(pending = true)
        viewModelScope.launch {
            try {
                val api = ensureAuth()
                val auth = supabase ?: error("Supabase client is not ready")
                auth.auth.signInWith(Email) {
                    this.email = email.trim()
                    this.password = password
                }
                api.resetSessionState()
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

    /**
     * The login screen can outlive the clients (a logout, an instance change or
     * a session that ended while the app was open). Rebuilds whatever is
     * missing for the current instance instead of signing in against nothing.
     */
    private suspend fun ensureAuth(): ApiClient {
        client?.let { api -> if (supabase != null) return api }
        val api = client ?: apiFor(instanceStore.current())
        val instance = api.instance()
        val auth = instance.auth ?: throw ApiException("auth_unavailable", 503)
        val created = supabaseFactory.create(auth.supabaseUrl, auth.supabaseAnonKey)
        supabase = created
        created.auth.awaitInitialization()
        return api
    }

    fun signOut() {
        viewModelScope.launch { endSession(revoked = false) }
    }

    /**
     * Ends the session in this device only. `revoked` explains it on the login
     * screen: the account was deactivated, deleted or its device revoked, so
     * the user did not log out.
     *
     * The API and Supabase clients belong to the instance, not to the session:
     * they stay alive so the login screen can sign in again. Closing them here
     * left `login()` without a client and it returned in silence.
     */
    private suspend fun endSession(revoked: Boolean) {
        if (!revoked) {
            // Revoke the device while the session is still valid: otherwise the
            // server keeps pushing a signed-out account's groups to this phone.
            FcmRegistrar(getApplication()).revoke()
            runCatching { supabase?.auth?.signOut(SignOutScope.LOCAL) }
        }
        // Either way this device forgets the session, in memory and on disk.
        // After a revocation a network sign-out would only fail against the
        // dead token, so `clearSession` does the local part without the round trip.
        runCatching { supabase?.auth?.clearSession() }
        sessionStore.clear()
        clearWidget()
        prefs.remove(LOCATION_KEY)
        _login.value = LoginState()
        awaitLogin(if (revoked) LoginNotice.SESSION_REVOKED else null)
    }

    /**
     * Coming back to the app is when a revoked session should disappear: the
     * Core already rejects a deactivated profile on every request, but a screen
     * that fetches nothing would keep showing old data until the next launch.
     */
    fun revalidateSession() {
        if (revalidating) return
        if (_state.value !is AppState.SignedIn) return
        val api = client ?: return
        revalidating = true
        viewModelScope.launch {
            try {
                api.me()
            } catch (_: ApiException) {
                // A network failure keeps the session; a revoked one already
                // ended it through the ApiClient callback.
            } finally {
                revalidating = false
            }
        }
    }

    fun lastUpdateCheckAt(): Long? = updateThrottle.lastCheckAt()

    /** Where the shell was: "home", "modules", "settings" or "module:<key>". */
    fun lastLocation(): String? = prefs.get(LOCATION_KEY)

    fun rememberLocation(value: String) {
        prefs.put(LOCATION_KEY, value)
    }

    fun togglePrivacy() {
        val next = !_privacyMasked.value
        _privacyMasked.value = next
        prefs.put(PRIVACY_KEY, next.toString())
        // The launcher widget follows the same switch, without waiting for the timer.
        com.rferic.zero27apps.widget.OweWidgetWorker.refreshNow(getApplication())
    }

    /** The live client, so a screen can subscribe to its realtime channel. */
    fun supabase(): SupabaseClient? = supabase

    /** The session token, for authenticated image requests (module icons). */
    fun accessToken(): String? = supabase?.auth?.currentSessionOrNull()?.accessToken

    /** Last push registration outcome, shown in Ajustes when it fails. */
    private val _pushStatus = MutableStateFlow<String?>(null)
    val pushStatus: StateFlow<String?> = _pushStatus.asStateFlow()

    /** Retries the push registration from Ajustes. */
    fun retryPush() {
        val instance = instanceStore.current()
        registerPush(instance, supabase)
    }

    /** Registers this installation for push once there is a session. */
    private fun registerPush(instance: String, supabaseClient: SupabaseClient?) {
        val jwt = supabaseClient?.auth?.currentSessionOrNull()?.accessToken
        if (jwt == null) {
            _pushStatus.value = "no_session"
            Log.w("Push", "no session token yet; skipping FCM registration")
            return
        }
        _pushStatus.value = "registering"
        FcmRegistrar(getApplication()).configure(instance, jwt) { result ->
            _pushStatus.value = result.fold(
                onSuccess = { "ok" },
                onFailure = { error ->
                    Log.w("Push", "FCM registration failed", error)
                    error.message ?: error::class.simpleName ?: "failed"
                },
            )
        }
    }

    /** Forgets the widget's data and repaints it, so nothing of the old session stays. */
    private suspend fun clearWidget() {
        val context = getApplication<Application>()
        com.rferic.zero27apps.widget.WidgetSnapshotStore(context).clear()
        // Repaint with the empty snapshot: the launcher kept the old balances.
        runCatching { com.rferic.zero27apps.widget.OweWidget().updateAll(context) }
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
            FcmRegistrar(getApplication()).revoke()
            runCatching { supabase?.auth?.signOut(SignOutScope.LOCAL) }
            sessionStore.clear()
            clearWidget()
            prefs.remove(LOCATION_KEY)
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
            val hadStoredSession = runCatching { sessionStore.load() != null }.getOrDefault(false)
            val supabaseClient = supabaseFactory.create(auth.supabaseUrl, auth.supabaseAnonKey)
            supabase = supabaseClient
            try {
                supabaseClient.auth.awaitInitialization()
            } catch (error: Exception) {
                if (error is kotlinx.coroutines.CancellationException) throw error
                if (refreshOutcome(error) == RefreshResult.NoSession) {
                    sessionStore.clear()
                    _state.value = AppState.NeedsLogin(base, LoginNotice.SESSION_REVOKED)
                } else {
                    _state.value = AppState.Failure(FailureReason.NETWORK)
                }
                return
            }
            // Before the session branch: a fresh install must be able to update
            // from the login screen, without signing in first.
            checkForUpdate()
            if (supabaseClient.auth.currentSessionOrNull() == null) {
                if (hadStoredSession) sessionStore.clear()
                _state.value = AppState.NeedsLogin(
                    base,
                    if (hadStoredSession) LoginNotice.SESSION_REVOKED else null,
                )
                return
            }
            // A revoked refresh token must fail now, not after the first API
            // call; a network error keeps the stored session and offers retry.
            try {
                supabaseClient.auth.refreshCurrentSession()
            } catch (error: Exception) {
                if (error is kotlinx.coroutines.CancellationException) throw error
                if (refreshOutcome(error) == RefreshResult.NoSession) {
                    sessionStore.clear()
                    _state.value = AppState.NeedsLogin(base, LoginNotice.SESSION_REVOKED)
                } else {
                    _state.value = AppState.Failure(FailureReason.NETWORK)
                }
                return
            }
            val me = try {
                api.me()
            } catch (error: ApiException) {
                if (error.code == "unauthorized") {
                    sessionStore.clear()
                    _state.value = AppState.NeedsLogin(base, LoginNotice.SESSION_REVOKED)
                    return
                }
                throw error
            }
            val modules = api.myModules().modules
            val widgets = runCatching { api.dashboard("app").widgets }.getOrDefault(emptyList())
            _state.value = AppState.SignedIn(base, me, modules, widgets)
            registerPush(base, supabase)
        } catch (error: ApiException) {
            _state.value = AppState.Failure(failureReason(error))
        } catch (error: Exception) {
            if (error is kotlinx.coroutines.CancellationException) throw error
            _state.value = AppState.Failure(FailureReason.UNKNOWN)
        }
    }

    private suspend fun awaitLogin(notice: LoginNotice? = null) {
        _state.value = AppState.NeedsLogin(instanceStore.current(), notice)
    }

    private fun apiFor(base: String): ApiClient {
        client?.close()
        val api = ApiClient(
            baseUrl = base,
            engine = OkHttp.create(),
            token = { supabase?.auth?.currentSessionOrNull()?.accessToken },
            refresh = {
                val auth = supabase
                if (auth == null) {
                    RefreshResult.NoSession
                } else {
                    runCatching { auth.auth.refreshCurrentSession() }.fold(
                        onSuccess = { RefreshResult.Refreshed },
                        onFailure = { refreshOutcome(it) },
                    )
                }
            },
            onSessionEnded = { endSession(revoked = true) },
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
        error.code == "existing_account_signin_required" -> InviteError.EXISTING_SIGNIN_REQUIRED
        error.code == "rate_limited" -> InviteError.RATE_LIMITED
        error.code == "conflict" -> InviteError.CONFLICT
        error.network -> InviteError.NETWORK
        else -> InviteError.GENERIC
    }

    /** Supabase Auth says the password is wrong (as opposed to a network error). */
    private fun isWrongCredentials(error: Exception): Boolean {
        val text = error.message.orEmpty()
        return text.contains("Invalid login", ignoreCase = true) ||
            text.contains("invalid_grant", ignoreCase = true) ||
            text.contains("Invalid credentials", ignoreCase = true)
    }

    private fun Exception.isNetworkFailure(): Boolean =
        this is java.io.IOException || cause is java.io.IOException

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
