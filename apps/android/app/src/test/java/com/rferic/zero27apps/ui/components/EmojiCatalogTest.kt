package com.rferic.zero27apps.ui.components

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The palette is content: a duplicate or an entry too long for the category
 * column would only show up when somebody taps it.
 */
class EmojiCatalogTest {
    @Test
    fun `every group is a real group of emojis`() {
        assertTrue(EmojiCatalog.groups.size >= 6)
        for (group in EmojiCatalog.groups) {
            assertTrue("${group.label} needs emojis", group.emojis.size >= 8)
            for (emoji in group.emojis) {
                assertTrue(emoji.isNotBlank())
                // The category column counts code points (1..8), and an emoji is
                // one of them: the family glyph is five, the sun with its
                // variation selector is two.
                assertTrue(
                    "$emoji is longer than the column allows",
                    emoji.codePointCount(0, emoji.length) <= 8,
                )
            }
        }
    }

    @Test
    fun `the same emoji is never offered twice`() {
        val all = EmojiCatalog.groups.flatMap { it.emojis }
        assertEquals(all.size, all.toSet().size)
        assertTrue(all.size >= 60)
    }
}
