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

    // The notification has to say what is being asked for: a bare "New
    // invitation request" left the administrator guessing which row it meant.
    @Test
    fun `invitation request names the seat count and never the asker`() {
        val data = mapOf("key" to "push.invitation_requested", "module" to "027apps", "seats" to "2")
        assertEquals(
            "Solicitud de 2 invitaciones",
            PushText.body(data, masked = false, locale = "es", fallback = "Novedad"),
        )
        assertEquals(
            "Request for 2 invitations",
            PushText.body(data, masked = false, locale = "en", fallback = "Novedad"),
        )
        assertEquals(
            "Solicitud de 1 invitación",
            PushText.body(data + ("seats" to "1"), masked = false, locale = "es", fallback = "Novedad"),
        )
        assertEquals(
            false,
            PushText.body(data + ("actor" to "Eric"), masked = false, locale = "es", fallback = "Novedad").contains("Eric"),
        )
    }

    @Test
    fun `an invitation push without a seat count keeps the generic sentence`() {
        val data = mapOf("key" to "push.invitation_requested", "module" to "027apps")
        assertEquals(
            "Nueva solicitud de invitación",
            PushText.body(data, masked = false, locale = "es", fallback = "Novedad"),
        )
    }

    @Test
    fun `resolved push distinguishes approved from rejected and names granted seats`() {
        val approved = mapOf(
            "key" to "push.invitation_request_resolved",
            "module" to "027apps",
            "state" to "approved",
            "seats" to "3",
        )
        val rejected = mapOf(
            "key" to "push.invitation_request_resolved",
            "module" to "027apps",
            "state" to "rejected",
            "seats" to "3",
        )
        assertEquals(
            "Solicitud aprobada · 3 plazas",
            PushText.body(approved, masked = false, locale = "es", fallback = "Novedad"),
        )
        assertEquals("Solicitud rechazada", PushText.body(rejected, masked = false, locale = "es", fallback = "Novedad"))
    }

    @Test
    fun `an expense push still renders amount and description`() {
        val text = PushText.body(data, masked = false, locale = "es", fallback = "Novedad")
        assertEquals(true, text.contains("Cena"))
        assertEquals(true, text.contains("20"))
    }
}
