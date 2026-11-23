package com.rferic.zero27apps.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Editing the email on an anonymous invitation must leave the "existing
 * account" branch behind: otherwise the form keeps asking for that account's
 * current password and the next submit tries to sign in the new address
 * instead of redeeming a new account.
 */
class InviteStateTest {
    @Test
    fun `editing the identity clears the existing-account branch and its error`() {
        val state = InviteState(signInRequired = true, error = InviteError.EXISTING_SIGNIN_REQUIRED)

        val edited = state.withEditedIdentity()

        assertFalse(edited.signInRequired)
        assertNull(edited.error)
    }

    @Test
    fun `a form that never saw the notice is returned unchanged`() {
        val state = InviteState()

        assertEquals(state, state.withEditedIdentity())
    }
}
