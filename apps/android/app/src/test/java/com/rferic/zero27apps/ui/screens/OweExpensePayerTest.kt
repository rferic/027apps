package com.rferic.zero27apps.ui.screens

import com.rferic.zero27apps.data.OweMemberDto
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Adding an expense is the owner saying "I paid this": the payer starts on the
 * member of whoever opens the form, never on whoever happens to be first.
 */
class OweExpensePayerTest {
    private val other = OweMemberDto(id = "member-other", displayName = "Ana", userId = "user-ana")
    private val me = OweMemberDto(id = "member-me", displayName = "Eric", userId = "user-eric")

    @Test
    fun `a new expense is paid by whoever adds it`() {
        assertEquals("member-me", defaultPayer(listOf(other, me), "member-me"))
    }

    @Test
    fun `a member who left falls back to the first active member`() {
        assertEquals("member-other", defaultPayer(listOf(other), "member-gone"))
    }

    @Test
    fun `an unknown reader keeps the first active member`() {
        assertEquals("member-other", defaultPayer(listOf(other), null))
    }

    @Test
    fun `a payment goes to someone other than whoever pays`() {
        assertEquals("member-other", defaultReceiver(listOf(me, other), "member-me"))
    }

    @Test
    fun `one member alone receives their own payment`() {
        assertEquals("member-me", defaultReceiver(listOf(me), "member-me"))
    }
}
