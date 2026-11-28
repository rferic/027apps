package com.rferic.zero27apps.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rferic.zero27apps.ui.i18n.LocalStrings
import com.rferic.zero27apps.ui.i18n.Strings
import com.rferic.zero27apps.ui.theme.LocalPalette

/**
 * A scrollable palette of everyday emojis, inserted into the title at the
 * cursor (spec §10): a group called `🏠 Casa` or a task called
 * `💡💡 Cambiar la bombilla`. The keyboard still types any other emoji.
 *
 * The chips use the semantic surface/border tokens, so light and dark themes
 * swap together with the rest of the app; the glyphs keep their own colour.
 */
@Composable
fun EmojiPicker(onPick: (String) -> Unit) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    Column(
        Modifier
            .fillMaxWidth()
            .heightIn(max = 224.dp)
            .verticalScroll(rememberScrollState())
            .padding(vertical = 2.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        EmojiCatalog.groups.forEachIndexed { index, group ->
            Text(
                groupLabel(group.label, strings),
                color = palette.mutedForeground,
                fontSize = 10.5.sp,
                fontWeight = FontWeight.Medium,
                modifier = Modifier.padding(top = if (index == 0) 0.dp else 6.dp, bottom = 2.dp),
            )
            group.emojis.chunked(6).forEach { line ->
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    line.forEach { emoji -> EmojiChip(emoji, onPick) }
                }
            }
        }
    }
}

@Composable
private fun EmojiChip(emoji: String, onPick: (String) -> Unit) {
    val palette = LocalPalette.current
    Box(
        Modifier
            .size(42.dp)
            .background(palette.surface, RoundedCornerShape(11.dp))
            .border(1.dp, palette.border, RoundedCornerShape(11.dp))
            .semantics { role = Role.Button }
            .clickable { onPick(emoji) },
        contentAlignment = Alignment.Center,
    ) {
        Text(emoji, fontSize = 19.sp)
    }
}

private fun groupLabel(label: EmojiLabel, strings: Strings): String = when (label) {
    EmojiLabel.HOME -> strings.emojiHome
    EmojiLabel.KITCHEN -> strings.emojiKitchen
    EmojiLabel.FAMILY -> strings.emojiFamily
    EmojiLabel.PAPERS -> strings.emojiPapers
    EmojiLabel.HEALTH -> strings.emojiHealth
    EmojiLabel.TRAVEL -> strings.emojiTravel
}
