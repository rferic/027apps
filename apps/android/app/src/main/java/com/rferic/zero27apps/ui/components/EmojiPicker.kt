package com.rferic.zero27apps.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rferic.zero27apps.ui.theme.LocalPalette

/**
 * The frequent emojis the mockup asks for, inserted into the title at the cursor
 * (spec §10): a group called `🏠 Casa` or a task called `💡💡 Cambiar la
 * bombilla` are typed like any other text, and the keyboard is still there for
 * any other emoji.
 */
private val FREQUENT = listOf(
    "🏠", "🛒", "🎒", "📄", "💡", "🗑️", "🧾", "🧴", "🚗", "📌",
    "🧹", "🍳", "🐕", "💊", "📚", "🎁", "☎️", "🔧",
)

@Composable
fun EmojiPicker(onPick: (String) -> Unit) {
    val palette = LocalPalette.current
    Row(
        Modifier.horizontalScroll(rememberScrollState()).padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        FREQUENT.forEach { emoji ->
            Box(
                Modifier
                    .background(palette.surface, RoundedCornerShape(9.dp))
                    .border(1.dp, palette.border, RoundedCornerShape(9.dp))
                    .clickable { onPick(emoji) }
                    .padding(horizontal = 7.dp, vertical = 4.dp),
            ) { Text(emoji, fontSize = 16.sp) }
        }
    }
}
