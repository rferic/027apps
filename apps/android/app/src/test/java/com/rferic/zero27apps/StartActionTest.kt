package com.rferic.zero27apps

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class StartActionTest {
    @Test
    fun `invite opens the invitation screen`() {
        assertEquals(StartTarget.INVITE, StartAction.targetOf("invite"))
    }

    @Test
    fun `owe actions open the owe-no module`() {
        assertEquals(StartTarget.OWE_EXPENSE, StartAction.targetOf("owe_expense"))
        assertEquals(StartTarget.OWE_GROUP, StartAction.targetOf("owe_group"))
    }

    @Test
    fun `unknown and missing actions are not recognized`() {
        assertNull(StartAction.targetOf("modules"))
        assertNull(StartAction.targetOf("settings"))
        assertNull(StartAction.targetOf(null))
        assertNull(StartAction.targetOf("not-an-action"))
    }

    @Test
    fun `the invitation action is accepted and forwarded by the activity`() {
        assertTrue("a push tap must reach the invitation screen", "invite" in StartAction.accepted)
    }
}
