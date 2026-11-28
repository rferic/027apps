package com.rferic.zero27apps.ui.screens

import com.rferic.zero27apps.data.OweMemberDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** Two members called the same are told apart by the email under the name. */
class OweMemberEmailTest {
    private fun member(name: String, email: String? = null) =
        OweMemberDto(id = "member-1", displayName = name, email = email)

    @Test
    fun `a selector shows the account email under the name`() {
        assertEquals("ana@example.com", memberSubtitle(member("Ana", "ana@example.com")))
        assertEquals("Ana · ana@example.com", memberLabel(member("Ana", "ana@example.com")))
    }

    @Test
    fun `a fictitious member has no second line`() {
        assertNull(memberSubtitle(member("Marta")))
        assertNull(memberSubtitle(member("Marta", "   ")))
        assertEquals("Marta", memberLabel(member("Marta")))
    }

    @Test
    fun `the account lists used to invite or link show the email too`() {
        assertEquals(
            "ana@example.com",
            identitySubtitle(
                com.rferic.zero27apps.data.OweIdentityDto(
                    id = "account-1",
                    displayName = "Ana",
                    email = "ana@example.com",
                ),
            ),
        )
    }
}
