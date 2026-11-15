package com.rferic.zero27apps.ui.i18n

import androidx.compose.runtime.staticCompositionLocalOf

/**
 * The copy in the language of the device. Screens read it with
 * `LocalStrings.current`; the provider lives in [com.rferic.zero27apps.ui.AppRoot].
 */
val LocalStrings = staticCompositionLocalOf { AppStrings.en }
