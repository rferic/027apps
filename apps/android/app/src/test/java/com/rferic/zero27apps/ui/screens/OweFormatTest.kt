package com.rferic.zero27apps.ui.screens

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class OweFormatTest {
    @Test
    fun `money uses the profile locale and its currency`() {
        val positive = formatMinor(3210, "EUR", "es")
        assertTrue(positive.contains("32,10"))
        assertTrue(positive.contains("€"))
        assertTrue(formatMinor(-3210, "EUR", "es").startsWith("-"))
    }

    @Test
    fun `calendar days render in the profile locale`() {
        val formatted = formatDay("2026-11-14", "es")
        assertNotEquals("2026-11-14", formatted)
        assertTrue(formatted.contains("2026"))
    }
}
