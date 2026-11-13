package com.rferic.zero27apps.ui

import com.rferic.zero27apps.auth.InvitationLink
import com.rferic.zero27apps.data.ModuleDto
import com.rferic.zero27apps.data.UserDto
import com.rferic.zero27apps.ui.theme.ThemePreference

/** What the shell is showing; the whole app renders from this one value. */
sealed interface AppState {
    data object Loading : AppState

    /** Signed out: the instance is known, the session is not. */
    data class NeedsLogin(val instance: String) : AppState

    /** An invitation link was opened: ask for the account to redeem it. */
    data class NeedsInvite(val link: InvitationLink) : AppState

    data class SignedIn(
        val instance: String,
        val user: UserDto,
        val modules: List<ModuleDto>,
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

/** Result of the last invitation attempt. */
enum class InviteError { EXPIRED, USED, NOT_FOUND, EMAIL_MISMATCH, NETWORK, GENERIC }

data class InviteState(val pending: Boolean = false, val error: InviteError? = null)
