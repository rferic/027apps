package com.rferic.zero27apps.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke

/**
 * The password reveal toggle. Drawn by hand because material-icons-core ships no
 * `Visibility` glyph, and pulling the whole extended set for one icon is not
 * worth the download.
 */
@Composable
fun EyeIcon(visible: Boolean, tint: Color, modifier: Modifier = Modifier) {
    Canvas(modifier) {
        val w = size.width
        val h = size.height
        val stroke = Stroke(width = size.minDimension * 0.09f, cap = StrokeCap.Round)
        val eye = Path().apply {
            moveTo(w * 0.06f, h * 0.5f)
            quadraticTo(w * 0.5f, h * 0.10f, w * 0.94f, h * 0.5f)
            quadraticTo(w * 0.5f, h * 0.90f, w * 0.06f, h * 0.5f)
            close()
        }
        drawPath(eye, color = tint, style = stroke)
        if (visible) {
            drawCircle(color = tint, radius = h * 0.15f, center = Offset(w / 2f, h / 2f))
        } else {
            drawLine(
                color = tint,
                start = Offset(w * 0.12f, h * 0.86f),
                end = Offset(w * 0.88f, h * 0.14f),
                strokeWidth = size.minDimension * 0.09f,
                cap = StrokeCap.Round,
            )
        }
    }
}
