package com.rferic.zero27apps.ui.theme

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb

/**
 * Identity D palette, mirrored from `apps/admin/tokens.json`. This is the only
 * Kotlin file with hex values: every screen consumes [Zero27AppsTheme] colours.
 * The translucent tokens are pre-blended over the surface they sit on, because
 * the Compose colours used by the app are opaque.
 */
data class Palette(
    val background: Color,
    val surface: Color,
    val muted: Color,
    val mutedForeground: Color,
    val foreground: Color,
    val primary: Color,
    val primaryForeground: Color,
    val accent: Color,
    val accentForeground: Color,
    val brand: Color,
    val border: Color,
    val destructive: Color,
    val destructiveForeground: Color,
    val success: Color,
    val successSubtle: Color,
) {
    /** The same tokens as ARGB ints, for the parity test against the JSON. */
    fun argb(): Map<String, Int> = mapOf(
        "background" to background.toArgb(),
        "surface" to surface.toArgb(),
        "muted" to muted.toArgb(),
        "muted-foreground" to mutedForeground.toArgb(),
        "foreground" to foreground.toArgb(),
        "primary" to primary.toArgb(),
        "primary-foreground" to primaryForeground.toArgb(),
        "accent" to accent.toArgb(),
        "accent-foreground" to accentForeground.toArgb(),
        "brand" to brand.toArgb(),
        "border" to border.toArgb(),
        "destructive" to destructive.toArgb(),
        "destructive-foreground" to destructiveForeground.toArgb(),
        "success" to success.toArgb(),
        "success-subtle" to successSubtle.toArgb(),
    )
}

object Tokens {
    val light = Palette(
        background = Color(0xFFF6F7F8),
        surface = Color(0xFFFFFFFF),
        muted = Color(0xFFECEEF0),
        mutedForeground = Color(0xFF5B6472),
        foreground = Color(0xFF17191C),
        primary = Color(0xFF17191C),
        primaryForeground = Color(0xFFFFFFFF),
        accent = Color(0xFF09795F),
        accentForeground = Color(0xFFFFFFFF),
        brand = Color(0xFF0F9B7D),
        border = Color(0xFFE3E5E8),
        destructive = Color(0xFFBE123C),
        destructiveForeground = Color(0xFFFFFFFF),
        success = Color(0xFF15803D),
        successSubtle = Color(0xFFE4F8EC),
    )

    val dark = Palette(
        background = Color(0xFF08090A),
        surface = Color(0xFF0E0F11),
        muted = Color(0xFF1A1B1E),
        mutedForeground = Color(0xFF8A8F98),
        foreground = Color(0xFFF7F8F8),
        primary = Color(0xFFF7F8F8),
        primaryForeground = Color(0xFF08090A),
        accent = Color(0xFF1CC29F),
        accentForeground = Color(0xFF05231C),
        brand = Color(0xFF1CC29F),
        border = Color(0xFF1E1F20),
        destructive = Color(0xFFFB7185),
        destructiveForeground = Color(0xFF2A0A10),
        success = Color(0xFF4ADE80),
        successSubtle = Color(0xFF102318),
    )
}
