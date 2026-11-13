package com.rferic.zero27apps.ui

import com.rferic.zero27apps.data.ModuleDto
import com.rferic.zero27apps.data.UserDto
import com.rferic.zero27apps.ui.theme.ThemePreference

/** What the shell is showing; the whole app renders from this one value. */
sealed interface AppState {
    data object Loading : AppState

    /** Signed out: the instance is known, the session is not. */
    data class NeedsLogin(val instance: String) : AppState

    data class SignedIn(
        val instance: String,
        val user: UserDto,
        val modules: List<ModuleDto>,
    ) : AppState

    data class Failure(val message: String) : AppState
}

fun String.toThemePreference(): ThemePreference = when (this) {
    "light" -> ThemePreference.LIGHT
    "dark" -> ThemePreference.DARK
    else -> ThemePreference.SYSTEM
}
