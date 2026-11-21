package com.rferic.zero27apps.ui.screens

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * The pending-link label: hours and minutes for a day-scale link, minutes alone
 * under an hour. It used to truncate to whole hours, so a one-hour link read
 * "0 h" the second it was minted.
 */
class InviteExpiryTest {
    private val hoursMinutes = "Expires in {hours} h {minutes} min"
    private val hours = "Expires in {hours} h"
    private val minutes = "Expires in {minutes} min"

    private fun label(remainingMillis: Long): String =
        expiryLabel(remainingMillis, hoursMinutes, hours, minutes)

    @Test
    fun `a fresh 48 hour link reads 48 h, not 47 h 59 min`() {
        assertEquals("Expires in 48 h", label(48 * 3_600_000L - 1_000))
    }

    @Test
    fun `an hour long link reads 1 h instead of 0 h`() {
        assertEquals("Expires in 1 h", label(3_600_000L - 1_000))
        assertEquals("Expires in 1 h", label(3_600_000L))
    }

    @Test
    fun `hours carry their remaining minutes`() {
        assertEquals("Expires in 47 h 30 min", label(47 * 3_600_000L + 30 * 60_000L))
        assertEquals("Expires in 2 h 5 min", label(2 * 3_600_000L + 5 * 60_000L))
    }

    @Test
    fun `under an hour reads only minutes`() {
        assertEquals("Expires in 45 min", label(45 * 60_000L))
        assertEquals("Expires in 59 min", label(59 * 60_000L))
    }

    @Test
    fun `last seconds and an already expired link never print zero`() {
        assertEquals("Expires in 1 min", label(1_000))
        assertEquals("Expires in 1 min", label(-5_000))
        assertEquals("Expires in 1 min", label(0))
    }

    @Test
    fun `a week long link stays in hours`() {
        assertEquals("Expires in 168 h", label(168 * 3_600_000L))
    }
}
