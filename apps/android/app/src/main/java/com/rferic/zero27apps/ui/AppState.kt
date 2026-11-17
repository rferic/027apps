package com.rferic.zero27apps.ui

import com.rferic.zero27apps.auth.InvitationLink
import com.rferic.zero27apps.data.InvitationPreviewDto
import com.rferic.zero27apps.data.ModuleDto
import com.rferic.zero27apps.data.WidgetDto
import com.rferic.zero27apps.data.UserDto
import com.rferic.zero27apps.ui.theme.ThemePreference

/** What the shell is showing; the whole app renders from this one value. */
sealed interface AppState {
    data object Loading : AppState

    /** Signed out: the instance is known, the session is not. */
    data class NeedsLogin(
        val instance: String,
        val notice: LoginNotice? = null,
    ) : AppState

    /** An invitation link was opened: ask for the account to redeem it. */
    data class NeedsInvite(val link: InvitationLink) : AppState

    data class SignedIn(
        val instance: String,
        val user: UserDto,
        val modules: List<ModuleDto>,
        /** Widgets the modules contribute to the app's home, already ordered. */
        val widgets: List<WidgetDto> = emptyList(),
    ) : AppState

    data class Failure(val reason: FailureReason) : AppState
}

fun String.toThemePreference(): ThemePreference = when (this) {
    "light" -> ThemePreference.LIGHT
    "dark" -> ThemePreference.DARK
    else -> ThemePreference.SYSTEM
}

/** Why the app could not boot; the screen turns it into localised copy. */
enum class FailureReason { NETWORK, AUTH_UNAVAILABLE, UNKNOWN }

/** A one-line explanation on the login screen after an involuntary logout. */
enum class LoginNotice { SESSION_REVOKED, INVITATION_ACCEPTED }

/** Result of the last invitation preview or redemption attempt. */
enum class InviteError {
    EXPIRED,
    USED,
    NOT_FOUND,
    NETWORK,
    WRONG_CREDENTIALS,
    EXISTING_SIGNIN_REQUIRED,
    RATE_LIMITED,
    CONFLICT,
    GENERIC,
}

data class InviteState(
    /** The preview is being fetched from the link's instance. */
    val loading: Boolean = false,
    /** Public contract of the invitation; the form renders from it. */
    val preview: InvitationPreviewDto? = null,
    /** A redemption is in flight. */
    val pending: Boolean = false,
    val error: InviteError? = null,
)

/** Old<->new phone migration (QR); the screens render from this one value. */
enum class MigrationError { NETWORK, GENERIC, SIGNED_IN, AUTH }

data class MigrationState(
    val loading: Boolean = false,
    /** New phone: a code was exchanged or a migration is in flight. */
    val email: String? = null,
    /** A link points at another instance; the person must confirm it first. */
    val confirmInstance: String? = null,
    val pendingLink: com.rferic.zero27apps.auth.MigrationLink? = null,
    /** Old phone: the QR being shown. */
    val token: String? = null,
    val transferId: String? = null,
    val expiresAt: String? = null,
    /** pending | used | expired, polled by the old phone. */
    val state: String = "pending",
    val error: MigrationError? = null,
)
