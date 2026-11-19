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

    @Test
    fun `invitation request push uses the localized generic text`() {
        val data = mapOf("key" to "push.invitation_requested", "module" to "027apps", "actor" to "Eric", "places" to "5")
        assertEquals(
            "Nueva solicitud de invitación",
            PushText.body(data, masked = false, locale = "es", fallback = "Novedad"),
        )
        assertEquals(
            "New invitation request",
            PushText.body(data, masked = false, locale = "en", fallback = "Novedad"),
        )
        // No names and no seat counts in the notification.
        assertEquals(false, PushText.body(data, masked = false, locale = "es", fallback = "Novedad").contains("Eric"))
        assertEquals(false, PushText.body(data, masked = false, locale = "es", fallback = "Novedad").contains("5"))
    }

    @Test
    fun `resolved push distinguishes approved from rejected`() {
        val approved = mapOf("key" to "push.invitation_request_resolved", "module" to "027apps", "state" to "approved")
        val rejected = mapOf("key" to "push.invitation_request_resolved", "module" to "027apps", "state" to "rejected")
        assertEquals("Solicitud aprobada", PushText.body(approved, masked = false, locale = "es", fallback = "Novedad"))
        assertEquals("Solicitud rechazada", PushText.body(rejected, masked = false, locale = "es", fallback = "Novedad"))
    }

    @Test
    fun `an expense push still renders amount and description`() {
        val text = PushText.body(data, masked = false, locale = "es", fallback = "Novedad")
        assertEquals(true, text.contains("Cena"))
        assertEquals(true, text.contains("20"))
    }
}
