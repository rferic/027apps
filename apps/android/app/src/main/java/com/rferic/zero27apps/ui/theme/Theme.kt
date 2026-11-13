package com.rferic.zero27apps.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.text.selection.LocalTextSelectionColors
import androidx.compose.foundation.text.selection.TextSelectionColors
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

/** The user's preference; `system` follows the device. */
enum class ThemePreference { SYSTEM, LIGHT, DARK }

/** Identity D tokens the Material scheme has no slot for (border, success…). */
val LocalPalette = staticCompositionLocalOf { Tokens.light }

/** Which palette is active, for the few assets that ship two drawings. */
val LocalIsDark = staticCompositionLocalOf { false }

private fun scheme(palette: Palette) = lightColorScheme(
    primary = palette.primary,
    onPrimary = palette.primaryForeground,
    background = palette.background,
    onBackground = palette.foreground,
    surface = palette.surface,
    onSurface = palette.foreground,
    surfaceVariant = palette.muted,
    onSurfaceVariant = palette.mutedForeground,
    secondary = palette.accent,
    onSecondary = palette.primaryForeground,
    error = palette.destructive,
    onError = palette.destructiveForeground,
    outline = palette.border,
)

private fun darkScheme(palette: Palette) = darkColorScheme(
    primary = palette.primary,
    onPrimary = palette.primaryForeground,
    background = palette.background,
    onBackground = palette.foreground,
    surface = palette.surface,
    onSurface = palette.foreground,
    surfaceVariant = palette.muted,
    onSurfaceVariant = palette.mutedForeground,
    secondary = palette.accent,
    onSecondary = palette.primaryForeground,
    error = palette.destructive,
    onError = palette.destructiveForeground,
    outline = palette.border,
)

/**
 * The app theme: one place that maps the tokens onto Material and exposes the
 * extra roles through [LocalPalette]. No screen picks a colour of its own.
 */
@Composable
fun Zero27AppsTheme(
    preference: ThemePreference = ThemePreference.SYSTEM,
    content: @Composable () -> Unit,
) {
    val dark = when (preference) {
        ThemePreference.SYSTEM -> isSystemInDarkTheme()
        ThemePreference.LIGHT -> false
        ThemePreference.DARK -> true
    }
    val palette = if (dark) Tokens.dark else Tokens.light
    CompositionLocalProvider(
        LocalPalette provides palette,
        LocalIsDark provides dark,
        LocalTextSelectionColors provides TextSelectionColors(
            handleColor = palette.accent,
            backgroundColor = palette.accent.copy(alpha = 0.3f),
        ),
    ) {
        MaterialTheme(colorScheme = if (dark) darkScheme(palette) else scheme(palette), content = content)
    }
}

/** Marker for tests/previews that need a colour without the theme. */
internal fun previewColor(palette: Palette): Color = palette.accent
