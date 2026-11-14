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
    fun `parseMinor accepts comma and dot, rejects junk`() {
        assertEquals(1234L, parseMinor("12,34"))
        assertEquals(1234L, parseMinor("12.34"))
        assertEquals(1200L, parseMinor("12"))
        assertEquals(null, parseMinor("12,345"))
        assertEquals(null, parseMinor("abc"))
        assertEquals(null, parseMinor("0"))
    }

    @Test
    fun `equal shares add up to the total`() {
        val shares = (0 until 3).map { equalShare(1000, 3, it) }
        assertEquals(1000L, shares.sum())
        assertEquals(334L, shares[0])
        val subset = (0 until 2).map { equalShare(1000, 2, it) }
        assertEquals(1000L, subset.sum())
    }

    @Test
    fun `calendar days render in the profile locale`() {
        val formatted = formatDay("2026-11-14", "es")
        assertNotEquals("2026-11-14", formatted)
        assertTrue(formatted.contains("2026"))
    }
}
