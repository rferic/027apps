package com.rferic.zero27apps.ui.components

/**
 * The emojis NotNow offers in its forms. They are everyday family things, not a
 * full keyboard: the text field still accepts any emoji the phone can type.
 *
 * The groups and their order mirror `packages/todo/admin/categories/page.tsx`
 * so the app and the panel offer the same palette.
 */
data class EmojiGroup(val label: EmojiLabel, val emojis: List<String>)

enum class EmojiLabel { HOME, KITCHEN, FAMILY, PAPERS, HEALTH, TRAVEL }

object EmojiCatalog {
    val groups: List<EmojiGroup> = listOf(
        EmojiGroup(
            EmojiLabel.HOME,
            listOf("🏠", "🛋️", "🛏️", "🧹", "🧽", "🧺", "🧼", "🚿", "🪣", "💡", "🔌", "🪴"),
        ),
        EmojiGroup(
            EmojiLabel.KITCHEN,
            listOf("🛒", "🍽️", "🍳", "🥘", "🧴", "🧻", "🥛", "🍞", "🥦", "🍎", "☕", "🗑️"),
        ),
        EmojiGroup(
            EmojiLabel.FAMILY,
            listOf("👨‍👩‍👧", "🧒", "🎒", "📚", "✏️", "🧸", "🍼", "🐕", "🐈", "🐟", "⚽", "🎨"),
        ),
        EmojiGroup(
            EmojiLabel.PAPERS,
            listOf("📄", "🧾", "💶", "🏦", "📅", "✉️", "📦", "🖨️", "🗂️", "🔑", "⏰", "🔧"),
        ),
        EmojiGroup(
            EmojiLabel.HEALTH,
            listOf("💊", "🩺", "🏥", "🦷", "🏃", "🚴", "🏊", "🧘", "🚑", "☀️", "❄️", "🌧️"),
        ),
        EmojiGroup(
            EmojiLabel.TRAVEL,
            listOf("🚗", "🚌", "🚲", "⛽", "🧳", "✈️", "🎁", "🎉", "🎂", "🎬", "🎮", "🎵"),
        ),
    )
}
