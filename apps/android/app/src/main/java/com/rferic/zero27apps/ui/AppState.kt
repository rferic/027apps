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
    /** The server refused the form: name, email or password out of range. */
    VALIDATION,
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
    /** Signed in as this account: accepting needs a sign-out the person confirms. */
    val confirmSwitch: String? = null,
    /**
     * The email typed on an anonymous invitation already has an account (D11).
     * The form switches to asking for that account's current password instead
     * of a new one, and the invitation stays pending.
     */
    val signInRequired: Boolean = false,
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

/** Why loading the invitation screen failed; mapped to localised copy. */
enum class InviteMembersError { NETWORK, RATE_LIMITED, QUOTA, GENERIC }

/**
 * The invitation screen's data, loaded from `GET /me/invitations` and the admin
 * list when the caller is an administrator. The quota drives the bar and the
 * Invite/Ask decision; the rest is the direct invitees, the pending links and
 * the caller's own recent requests.
 */
data class InviteMembersState(
    val loading: Boolean = false,
    val quota: com.rferic.zero27apps.data.InvitationQuotaDto? = null,
    val invitations: List<com.rferic.zero27apps.data.MemberInvitationDto> = emptyList(),
    val invitees: List<com.rferic.zero27apps.data.InviteeDto> = emptyList(),
    val requests: List<com.rferic.zero27apps.data.InvitationRequestDto> = emptyList(),
    /** Read-only list for an administrator; empty for everyone else. */
    val adminRequests: List<com.rferic.zero27apps.data.AdminInvitationRequestDto> = emptyList(),
    val error: InviteMembersError? = null,
)

/**
 * The shareable link on screen. `regenerated` is true when it was re-issued for
 * a pending invitation: the previous link no longer works, and the dialog says
 * so.
 */
data class InvitationShareLink(val url: String, val regenerated: Boolean = false)

/** The rotating QR join code, minted and renewed by the view model. */
enum class InviteJoinError { NETWORK, QUOTA_EXHAUSTED, RATE_LIMITED, GENERIC }

data class JoinCodeState(
    val loading: Boolean = false,
    val code: String? = null,
    val path: String? = null,
    val expiresAt: String? = null,
    val error: InviteJoinError? = null,
)

/** Why a scanned `/join/<code>` link could not be exchanged. */
enum class JoinLinkError { EXPIRED, USED, QUOTA_EXHAUSTED, RATE_LIMITED, NETWORK, WRONG_INSTANCE, GENERIC }

data class JoinLinkState(
    val loading: Boolean = false,
    val error: JoinLinkError? = null,
)
