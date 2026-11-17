package com.rferic.zero27apps.ui.screens

import com.rferic.zero27apps.data.OweCategoryDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The expense form offers one category, not a horizontal wall of chips: the
 * picker lists what can still be used and the field names whatever is chosen,
 * including a category archived after the expense was saved.
 */
class OweCategoryTest {
    private val categories = listOf(
        OweCategoryDto(id = "food", name = "Comida"),
        OweCategoryDto(id = "old", name = "Antigua", archived = true),
    )

    @Test
    fun `the picker offers only categories that can still be used`() {
        assertEquals(listOf("food"), selectableCategories(categories).map { it.id })
    }

    @Test
    fun `the chosen category resolves even when it was archived`() {
        assertEquals("Comida", chosenCategoryName(categories, "food"))
        assertEquals("Antigua", chosenCategoryName(categories, "old"))
    }

    @Test
    fun `no category and unknown ids fall back to the empty label`() {
        assertNull(chosenCategoryName(categories, null))
        assertNull(chosenCategoryName(categories, "missing"))
    }

    @Test
    fun `archiving a fresh pick clears it but an expense keeps its own category`() {
        assertNull(categoryAfterArchive("food", "food", null))
        assertNull(categoryAfterArchive("food", "food", "other"))
        assertEquals("food", categoryAfterArchive("food", "food", "food"))
        assertEquals("food", categoryAfterArchive("food", "other", "other"))
        assertNull(categoryAfterArchive(null, "food", null))
    }

    @Test
    fun `typing narrows the list ignoring case and accents`() {
        val all = listOf(
            OweCategoryDto(id = "food", name = "Alimentos"),
            OweCategoryDto(id = "flight", name = "Avión"),
            OweCategoryDto(id = "rent", name = "Alquiler"),
            OweCategoryDto(id = "old", name = "Antigua", archived = true),
        )
        val usable = selectableCategories(all)
        assertEquals(listOf("flight"), categoriesMatching(usable, "avion").map { it.id })
        assertEquals(listOf("flight"), categoriesMatching(usable, "AVIÓN").map { it.id })
        assertEquals(listOf("food", "rent"), categoriesMatching(usable, "al").map { it.id })
        assertEquals(usable, categoriesMatching(usable, "  "))
        assertTrue(categoriesMatching(usable, "ant").isEmpty())
        assertTrue(categoriesMatching(usable, "zzz").isEmpty())
    }
}
