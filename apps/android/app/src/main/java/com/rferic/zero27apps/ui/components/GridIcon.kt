package com.rferic.zero27apps.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import kotlin.math.roundToInt

/** The 2×2 tile glyph the mockup uses for "Módulos" (material-icons has none). */
@Composable
fun GridIcon(tint: Color, modifier: Modifier = Modifier) {
    Canvas(modifier = modifier) {
        val gap = size.minDimension * 0.14f
        val cell = (size.minDimension - gap) / 2f
        val radius = CornerRadius(cell * 0.32f)
        for (row in 0..1) {
            for (column in 0..1) {
                drawRoundRect(
                    color = tint,
                    topLeft = Offset(column * (cell + gap), row * (cell + gap)),
                    size = Size(cell, cell),
                    cornerRadius = radius,
                )
            }
        }
    }
}
