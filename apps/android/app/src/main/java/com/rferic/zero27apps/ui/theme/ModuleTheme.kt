package com.rferic.zero27apps.ui.theme

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.graphics.Color

/**
 * A module's primary colour, named in its manifest. The names are the ones the
 * manifest schema accepts; the app owns the hex value, so a module never ships
 * arbitrary colours and dark mode stays coherent.
 */
fun moduleAccent(name: String?): Color = when (name?.lowercase()) {
    "teal" -> Color(0xFF0F766E)
    "blue" -> Color(0xFF1D4ED8)
    "indigo" -> Color(0xFF4338CA)
    "violet" -> Color(0xFF6D28D9)
    "rose" -> Color(0xFFBE123C)
    "amber" -> Color(0xFFB45309)
    "orange" -> Color(0xFFC2410C)
    "slate" -> Color(0xFF334155)
    "green" -> Color(0xFF15803D)
    else -> Color(0xFF0F7A63)
}

/** The palette of one module: its accent drives buttons, links and the wash. */
@Composable
fun ModuleTheme(colorName: String?, content: @Composable () -> Unit) {
    val base = LocalPalette.current
    val accent = moduleAccent(colorName)
    CompositionLocalProvider(
        LocalPalette provides base.copy(
            accent = accent,
            accentForeground = base.background,
            successSubtle = accent.copy(alpha = 0.12f),
        ),
        content = content,
    )
}
