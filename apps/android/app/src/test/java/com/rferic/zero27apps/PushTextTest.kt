package com.rferic.zero27apps

import org.junit.Assert.assertEquals
import org.junit.Test

class PushTextTest {
    private val data = mapOf(
        "description" to "Cena",
        "group" to "Casa",
        "actor" to "Ana",
        "amount" to "2000",
        "currency" to "EUR",
    )

    @Test
    fun `shows the amount when amounts are visible`() {
        val text = PushText.body(data, masked = false, locale = "es", fallback = "Novedad")
        assertEquals(true, text.contains("Cena"))
        assertEquals(true, text.contains("Casa"))
        assertEquals(true, text.contains("20"))
    }

    @Test
    fun `hides the amount when the privacy switch is on`() {
        val text = PushText.body(data, masked = true, locale = "es", fallback = "Novedad")
        assertEquals(false, text.contains("20,00"))
        assertEquals(true, text.contains("Cena"))
    }

    @Test
    fun `falls back to the localized sentence without context`() {
        assertEquals("Novedad", PushText.body(emptyMap(), masked = false, locale = "es", fallback = "Novedad"))
    }
}
