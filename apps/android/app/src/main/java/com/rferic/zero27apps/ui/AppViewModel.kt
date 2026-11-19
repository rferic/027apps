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
import com.rferic.zero27apps.auth.JoinLink
import com.rferic.zero27apps.auth.MigrationLink
import com.rferic.zero27apps.auth.sessionIdOf
import com.rferic.zero27apps.auth.KeystoreSecretCipher
import com.rferic.zero27apps.auth.SupabaseFactory
import com.rferic.zero27apps.auth.refreshOutcome
import com.rferic.zero27apps.data.ApiClient
import com.rferic.zero27apps.data.ApiException
import com.rferic.zero27apps.data.PatchMeRequest
import com.rferic.zero27apps.data.RedeemRequest
import com.rferic.zero27apps.data.RefreshResult
import io.github.jan.supabase.auth.OtpType
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
import kotlinx.coroutines.delay
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
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

    private val _migration = MutableStateFlow(MigrationState())
    val migration: StateFlow<MigrationState> = _migration.asStateFlow()

    /** The `/join/<code>` deep-link exchange, in flight or failed. */
    private val _joinLink = MutableStateFlow(JoinLinkState())
    val joinLink: StateFlow<JoinLinkState> = _joinLink.asStateFlow()

    /** The invitation screen's state machine, in a plain class the tests can drive. */
    private val inviteStore = InviteMembersStore(
        scope = viewModelScope,
        api = { if (_state.value is AppState.SignedIn) client else null },
        isAdmin = {
            val role = (_state.value as? AppState.SignedIn)?.user?.role
            role == "admin" || role == "super_admin"
        },
        instanceBase = { instanceStore.current() },
    )
    val inviteMembers: StateFlow<InviteMembersState> = inviteStore.state
    val joinCode: StateFlow<JoinCodeState> = inviteStore.joinCode
    val createdLink: StateFlow<String?> = inviteStore.createdLink

    private var pendingLink: InvitationLink? = null
    /** The boot in flight; a deep link cancels it so it cannot overwrite the invite. */
    private var bootJob: Job? = null
    private var migrationWatchJob: Job? = null

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

    /** Email of the current Supabase session, for the migration QR card. */
    fun currentEmail(): String? = supabase?.auth?.currentUserOrNull()?.email

    /** The active instance, for screens that are not signed in yet. */
    fun currentInstance(): String = instanceStore.current()

    fun refresh() {
        bootJob?.cancel()
        bootJob = viewModelScope.launch { boot() }
    }

    /** Entry point for an invitation deep link, from either activity callback. */
    fun onInviteLink(raw: String) {
        val link = InvitationLink.parse(raw) ?: return
        handleInvite(link)
    }

    /**
     * Entry point for a `/join/<code>` link. The exchange is the user opening
     * the QR, never a prefetch; it turns the code into a 15-minute invitation
     * and then walks the same path as [onInviteLink]. False means the link was
     * not a join link and the caller should try the invitation parser.
     */
    fun onJoinLink(raw: String): Boolean {
        val link = JoinLink.parse(raw) ?: return false
        bootJob?.cancel()
        _joinLink.value = JoinLinkState(loading = true)
        viewModelScope.launch {
            try {
                val exchanged = apiFor(link.instance).exchangeJoinCode(link.code)
                _joinLink.value = JoinLinkState()
                handleInvite(InvitationLink(exchanged.token, link.instance))
            } catch (error: ApiException) {
                _joinLink.value = JoinLinkState(error = joinLinkError(error))
            } catch (error: Exception) {
                if (error is kotlinx.coroutines.CancellationException) throw error
                _joinLink.value = JoinLinkState(
                    error = if (error.isNetworkFailure()) JoinLinkError.NETWORK else JoinLinkError.GENERIC,
                )
            }
        }
        return true
    }

    /** The join-code exchange failed: close the notice and stay on the shell. */
    fun dismissJoinLink() {
        _joinLink.value = JoinLinkState()
    }

    private fun handleInvite(link: InvitationLink) {
        // The link wins over a boot that is still resolving the session.
        bootJob?.cancel()
        val current = _state.value
        if (hasStoredSession()) {
            // Accepting would replace this session behind the person's back: ask
            // first. The preview is fetched before the dialog so the question is
            // written in the invitation's language, like the form behind it.
            // On a cold start the email is unknown; the dialog says "a session".
            pendingLink = link
            val account = supabase?.auth?.currentUserOrNull()?.email
                ?: (current as? AppState.SignedIn)?.user?.displayName
                ?: ""
            viewModelScope.launch {
                val preview = runCatching {
                    apiFor(link.instance).invitationPreview(link.token)
                }.getOrNull()
                _invite.value = InviteState(confirmSwitch = account, preview = preview)
            }
            return
        }
        openInvite(link)
    }

    /** The confirmation dialog: sign the open session out and continue. */
    fun confirmInviteSwitch() {
        val link = pendingLink ?: return
        viewModelScope.launch {
            endSession(revoked = false)
            openInvite(link)
        }
    }

    private fun openInvite(link: InvitationLink) {
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

    /** The invitation preview failed (usually offline); try it again. */
    fun retryInvitePreview() {
        val link = pendingLink ?: return
        _invite.value = InviteState(loading = true)
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
     * Old phone: mints a 60-second QR and polls its state while the screen is
     * open. A used code means the new phone entered; the old session is then
     * revoked server-side by the new phone.
     */
    fun startMigration() {
        val api = client ?: return
        if (_state.value !is AppState.SignedIn) return
        migrationWatchJob?.cancel()
        // Keep the code on screen while the renewal is in flight: the previous
        // one stays valid until its own TTL, so there is nothing to hide.
        _migration.value = _migration.value.copy(loading = true, error = null)
        viewModelScope.launch {
            try {
                val created = api.createDeviceTransfer()
                _migration.value = MigrationState(
                    token = created.token,
                    transferId = created.transfer.id,
                    expiresAt = created.transfer.expiresAt,
                )
                watchMigration(api, created.transfer.id)
            } catch (error: Exception) {
                if (error is kotlinx.coroutines.CancellationException) throw error
                _migration.value = MigrationState(
                    error = if (error.isNetworkFailure()) MigrationError.NETWORK else MigrationError.GENERIC,
                )
            }
        }
    }

    private fun watchMigration(api: ApiClient, id: String) {
        migrationWatchJob?.cancel()
        migrationWatchJob = viewModelScope.launch {
            while (true) {
                delay(2_000)
                val status = runCatching { api.deviceTransferStatus(id) }.getOrNull() ?: continue
                _migration.value = _migration.value.copy(state = status.state)
                if (status.state != "pending") break
            }
            // A used code means the new phone is in. This one forgets the
            // session now instead of waiting for the token to be rejected: a
            // phone left signed in would keep its widget and its data visible.
            if (_migration.value.state == "used") {
                migrationWatchJob = null
                endSession(revoked = true)
            }
        }
    }

    /** Leaving the QR screen stops polling and forgets the code. */
    fun stopMigration() {
        migrationWatchJob?.cancel()
        migrationWatchJob = null
        _migration.value = MigrationState()
    }

    /**
     * New phone: a `/migrate` deep link accepts directly; a signed-in app
     * refuses. False means the link was not a migration one and the caller
     * should try the invitation parser.
     */
    fun onMigrationLink(raw: String): Boolean {
        val link = MigrationLink.parse(raw) ?: return false
        beginMigration(link)
        return true
    }

    /**
     * Scanner entry. A QR is a user action, but the host is not visible on it:
     * the same confirmation as an external link applies before moving the
     * account to a different instance.
     */
    fun onScannedMigration(link: MigrationLink) {
        beginMigration(link)
    }

    private fun beginMigration(link: MigrationLink) {
        if (hasStoredSession()) {
            _migration.value = MigrationState(error = MigrationError.SIGNED_IN, pendingLink = link)
            return
        }
        if (link.instance != instanceStore.current()) {
            _migration.value = MigrationState(confirmInstance = link.instance, pendingLink = link)
            return
        }
        // The link wins over a boot that is still resolving the session.
        bootJob?.cancel()
        acceptMigration(link)
    }

    /** The scan flow and the confirmation dialog land here; both are explicit. */
    fun confirmMigrationLink() {
        val link = _migration.value.pendingLink ?: return
        _migration.value = MigrationState()
        acceptMigration(link)
    }

    /**
     * A session on disk counts even while `boot()` is still running: on a cold
     * start the state is `Loading`, and a link processed in that window used to
     * clear the stored session before the app noticed it existed.
     */
    private fun hasStoredSession(): Boolean =
        _state.value is AppState.SignedIn ||
            runCatching { sessionStore.load() != null }.getOrDefault(false)

    /**
     * New phone: exchange the code for a Supabase magic-link hash, verify it,
     * open the shell, register this device, revoke the other devices and sign
     * the old phone's sessions out. No password and no refresh token travel.
     */
    fun acceptMigration(link: MigrationLink) {
        bootJob?.cancel()
        if (hasStoredSession()) {
            _migration.value = MigrationState(error = MigrationError.SIGNED_IN)
            return
        }
        _migration.value = MigrationState(loading = true)
        viewModelScope.launch {
            try {
                val api = apiFor(link.instance)
                val exchanged = api.exchangeDeviceTransfer(link.token)
                if (instanceStore.current() != link.instance) {
                    supabase = null
                }
                val instance = api.instance()
                val auth = instance.auth ?: throw ApiException("auth_unavailable", 503)
                val supabaseClient = supabaseFactory.create(auth.supabaseUrl, auth.supabaseAnonKey)
                supabase = supabaseClient
                supabaseClient.auth.awaitInitialization()
                supabaseClient.auth.verifyEmailOtp(
                    OtpType.Email.MAGIC_LINK,
                    exchanged.tokenHash,
                )
                api.resetSessionState()
                val me = api.me()
                val modules = api.myModules().modules
                val widgets = runCatching { api.dashboard("app").widgets }.getOrDefault(emptyList())
                instanceStore.save(link.instance)
                _instances.value = instanceStore.known()
                _migration.value = MigrationState(email = exchanged.email)
                _state.value = AppState.SignedIn(link.instance, me, modules, widgets)

                // The old phone is expelled only after this one is fully in:
                // the new push device stays, the others are revoked and the old
                // sessions are signed out.
                val deviceId = registerPushAndWait(link.instance, supabaseClient)
                // Without a device id (no Play Services, FCM off) the old
                // phone still has to stop receiving push.
                runCatching { api.revokeOtherDevices(deviceId) }
                // The old phone's session is ended **on the server**: a real
                // migration showed the client-side signOut(OTHERS) leaving the
                // old refresh token alive. The session id in this JWT is what
                // keeps our own session out of the delete.
                val sessionId = sessionIdOf(supabaseClient.auth.currentSessionOrNull()?.accessToken)
                if (sessionId != null) runCatching { api.revokeOtherSessions(sessionId) }
                runCatching { supabaseClient.auth.signOut(SignOutScope.OTHERS) }
            } catch (error: ApiException) {
                _migration.value = MigrationState(
                    error = when {
                        // A code that is unknown, used or expired is a 404 by
                        // design; a revoked session is a 401.
                        error.status == 404 || error.status == 401 -> MigrationError.AUTH
                        error.network -> MigrationError.NETWORK
                        else -> MigrationError.GENERIC
                    },
                )
            } catch (error: Exception) {
                if (error is kotlinx.coroutines.CancellationException) throw error
                _migration.value = MigrationState(
                    error = if (error.isNetworkFailure()) MigrationError.NETWORK else MigrationError.GENERIC,
                )
            }
        }
    }

    /** Registers this install and waits for the server device id (push may fail). */
    private suspend fun registerPushAndWait(
        instance: String,
        client: SupabaseClient?,
    ): String? = suspendCancellableCoroutine { continuation ->
        val jwt = client?.auth?.currentSessionOrNull()?.accessToken
        if (jwt == null) {
            continuation.resume(null)
            return@suspendCancellableCoroutine
        }
        FcmRegistrar(getApplication()).configure(instance, jwt) { result ->
            if (continuation.isActive) {
                continuation.resume(
                    if (result.isSuccess) FcmRegistrar(getApplication()).deviceId() else null,
                )
            }
        }
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
                // Always the link's instance: `client` may belong to another one
                // after the person changed instances, and signing in there would
                // report a perfectly good password as wrong.
                if (instanceStore.current() != link.instance) {
                    sessionStore.clear()
                    supabase = null
                }
                val api = apiFor(link.instance)

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
     * The migration dialog's "sign out and scan": the person accepted losing
     * this session, so the code they opened is redeemed right after.
     */
    fun signOutAndMigrate() {
        val link = _migration.value.pendingLink ?: return
        viewModelScope.launch {
            endSession(revoked = false)
            _migration.value = MigrationState()
            acceptMigration(link)
        }
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
            FcmRegistrar(getApplication()).revoke(
                supabase?.auth?.currentSessionOrNull()?.accessToken,
            )
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

    // --- Invitations (sprint 18: quota, QR and requests) ---------------------

    /** Loads the invitation screen: quota, invitations, invitees and requests. */
    fun loadInvitations() = inviteStore.load()

    /** `POST /me/invitations`: mints a link and hands its full URL to the screen to copy. */
    fun createInviteLink() = inviteStore.createLink()

    /** Consumes the link the screen copied, so a re-open does not copy it twice. */
    fun consumeCreatedLink() = inviteStore.consumeCreatedLink()

    /** `DELETE /me/invitations/{id}`: revokes one of the caller's pending invitations. */
    fun revokeInvitation(id: String) = inviteStore.revoke(id)

    /** `POST /me/invitation-requests`: ask the administrator for more seats. */
    fun requestQuota(amount: Int, reason: String?) = inviteStore.request(amount, reason)

    /** `POST /me/invitation-requests/{id}/cancel`: withdraw a pending request. */
    fun cancelRequest(id: String) = inviteStore.cancelRequest(id)

    /** `POST /me/join-codes`: mints a 90-second QR code; the screen renews it. */
    fun createJoinCode() = inviteStore.createJoinCode()

    /** Leaving the QR screen forgets the code; the token is never persisted. */
    fun stopJoinCode() = inviteStore.stopJoinCode()

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

    /**
     * Forgets a saved instance. The active one cannot be removed: the picker
     * hides the action for it, and the store would silently fall back.
     */
    fun forgetInstance(url: String): Boolean {
        if (url == instanceStore.current()) return false
        instanceStore.forget(url)
        _instances.value = instanceStore.known()
        return true
    }

    /** Points the app at another instance and starts signed out. */
    fun changeInstance(raw: String): Boolean {
        val normalized = ServerUrl.normalize(raw, requireHttps = !BuildConfig.DEBUG) ?: return false
        viewModelScope.launch {
            FcmRegistrar(getApplication()).revoke(
                supabase?.auth?.currentSessionOrNull()?.accessToken,
            )
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
        // A pending invitation wins over the session boot: a boot that finishes
        // after the link must not replace the invite screen with the shell.
        if (pendingLink != null) return
        _state.value = AppState.Loading
        try {
            bootInternal()
        } finally {
            pendingLink?.let { link ->
                if (_state.value !is AppState.NeedsInvite) {
                    _state.value = AppState.NeedsInvite(link)
                }
            }
        }
    }

    private suspend fun bootInternal() {
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

    private fun joinLinkError(error: ApiException): JoinLinkError = when {
        error.code == "join_code_used" -> JoinLinkError.USED
        error.code == "invitation_quota_exhausted" -> JoinLinkError.QUOTA_EXHAUSTED
        // An unknown or expired code is a `not_found` by design.
        error.code == "not_found" -> JoinLinkError.EXPIRED
        error.code == "rate_limited" -> JoinLinkError.RATE_LIMITED
        error.network -> JoinLinkError.NETWORK
        else -> JoinLinkError.GENERIC
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
