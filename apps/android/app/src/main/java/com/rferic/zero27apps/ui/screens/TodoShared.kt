package com.rferic.zero27apps.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rferic.zero27apps.ui.theme.LocalPalette

/**
 * The small pieces NotNow repeats on every screen: a selectable pill, a quiet
 * tag and the little outlined action. They live together so the group, task,
 * request and power panes stay the same shape.
 */

@Composable
fun TodoPill(label: String, selected: Boolean, onClick: () -> Unit) {
    val palette = LocalPalette.current
    Box(
        Modifier
            .background(if (selected) palette.accent else palette.surface, RoundedCornerShape(999.dp))
            .border(1.dp, palette.border, RoundedCornerShape(999.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 5.dp),
    ) {
        Text(
            label,
            color = if (selected) palette.accentForeground else palette.mutedForeground,
            fontSize = 11.5.sp,
            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
        )
    }
}

@Composable
fun TodoTag(text: String, color: Color) {
    Text(text, color = color, fontSize = 10.5.sp)
}

@Composable
fun TodoAction(label: String, onClick: () -> Unit) {
    val palette = LocalPalette.current
    Box(
        Modifier
            .background(palette.surface, RoundedCornerShape(9.dp))
            .border(1.dp, palette.border, RoundedCornerShape(9.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 9.dp, vertical = 5.dp),
    ) { Text(label, color = palette.accent, fontSize = 11.5.sp, fontWeight = FontWeight.Medium) }
}

/** A row of actions under a card, wrapping to a second line when they do not fit. */
@Composable
fun TodoActionRow(vararg actions: Pair<String, () -> Unit>) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        actions.forEach { (label, action) -> TodoAction(label, action) }
    }
}

@Composable
fun TodoSectionLabel(text: String) {
    val palette = LocalPalette.current
    Text(
        text,
        color = palette.mutedForeground,
        fontSize = 11.sp,
        fontWeight = FontWeight.Medium,
        modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
    )
}

/** Inserts `emoji` where the cursor is (or replaces the selection), nothing else. */
fun insertAtSelection(current: TextFieldValue, emoji: String): TextFieldValue {
    val text = current.text
    val start = current.selection.start.coerceIn(0, text.length)
    val end = current.selection.end.coerceIn(0, text.length)
    val next = text.replaceRange(start, end, emoji)
    return TextFieldValue(next, TextRange(start + emoji.length))
}
