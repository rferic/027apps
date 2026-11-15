package com.rferic.zero27apps.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.material3.IconButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.rferic.zero27apps.ui.i18n.LocalStrings
import com.rferic.zero27apps.ui.privacy.LocalPrivacyMasked
import com.rferic.zero27apps.ui.theme.LocalPalette

/** The app-wide "hide amounts" switch, set once at the shell. */
val LocalTogglePrivacy = compositionLocalOf<() -> Unit> { {} }

/**
 * One eye, in the same place on every screen: open means amounts are visible,
 * crossed out means they are masked. Drawn with the palette, never an emoji.
 */
@Composable
fun PrivacyEye(modifier: Modifier = Modifier) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    val masked = LocalPrivacyMasked.current
    val toggle = LocalTogglePrivacy.current
    IconButton(
        onClick = toggle,
        modifier = modifier.semantics {
            contentDescription = if (masked) strings.showAmounts else strings.hideAmounts
        },
    ) {
        Canvas(Modifier.size(22.dp)) {
            val stroke = Stroke(width = size.minDimension * 0.08f)
            val w = size.width
            val h = size.height
            // Two arcs make the almond outline of an eye.
            drawArc(
                color = palette.foreground,
                startAngle = 200f,
                sweepAngle = 140f,
                useCenter = false,
                topLeft = Offset(w * 0.02f, h * 0.33f),
                size = Size(w * 0.96f, h * 0.34f),
                style = stroke,
            )
            drawArc(
                color = palette.foreground,
                startAngle = 20f,
                sweepAngle = 140f,
                useCenter = false,
                topLeft = Offset(w * 0.02f, h * 0.33f),
                size = Size(w * 0.96f, h * 0.34f),
                style = stroke,
            )
            drawCircle(
                color = palette.foreground,
                radius = size.minDimension * 0.13f,
                center = Offset(w / 2, h / 2),
            )
            if (masked) {
                drawLine(
                    color = palette.destructive,
                    start = Offset(w * 0.14f, h * 0.82f),
                    end = Offset(w * 0.86f, h * 0.18f),
                    strokeWidth = size.minDimension * 0.09f,
                )
            }
        }
    }
}
