package com.rferic.zero27apps.ui.screens

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * A settlement pays one person the whole amount. Editing reuses the same shape
 * the create path sends, so the server never sees a split settlement.
 */
class OweSettlementEditTest {
    @Test
    fun `a settlement has one receiver with the whole amount`() {
        val shares = settlementParticipants("member-b", 1234)

        assertEquals(1, shares.size)
        assertEquals("member-b", shares.single().memberId)
        assertEquals(1234L, shares.single().amountMinor)
    }
}
