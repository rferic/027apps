package com.rferic.zero27apps.auth

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class InvitationLinkTest {
    private val token = "027_inv_abcdefghijklmnop"

    @Test
    fun `reads an https App Link from any instance`() {
        val link = InvitationLink.parse("https://027apps.ericrf.com/invite/$token")
        assertEquals(token, link?.token)
        assertEquals("https://027apps.ericrf.com", link?.instance)

        val selfHosted = InvitationLink.parse("https://mi-casa.example.test/invite/$token")
        assertEquals("https://mi-casa.example.test", selfHosted?.instance)
    }

    @Test
    fun `reads the app scheme and takes the instance from the query`() {
        val link = InvitationLink.parse(
            "027apps-dev://invite/$token?instance=http%3A%2F%2F192.168.1.108%3A3003",
        )
        assertEquals(token, link?.token)
        assertEquals("http://192.168.1.108:3003", link?.instance)
    }

    @Test
    fun `falls back to production when the scheme carries no instance`() {
        val link = InvitationLink.parse("027apps://invite/$token")
        assertEquals("https://027apps.ericrf.com", link?.instance)
    }

    @Test
    fun `rejects plain http and a wrong host`() {
        assertNull(InvitationLink.parse("http://027apps.ericrf.com/invite/$token"))
        assertNull(InvitationLink.parse("027apps://other/$token"))
    }

    @Test
    fun `rejects a missing or malformed token`() {
        assertNull(InvitationLink.parse("https://027apps.ericrf.com/invite/"))
        assertNull(InvitationLink.parse("https://027apps.ericrf.com/invite/short"))
        assertNull(InvitationLink.parse("https://027apps.ericrf.com/invite/027_inv_"))
        assertNull(InvitationLink.parse("not a link"))
    }

    @Test
    fun `rejects an instance that this build would not accept`() {
        assertNull(
            InvitationLink.parse("027apps-dev://invite/$token?instance=ftp%3A%2F%2Fbad"),
        )
        assertNull(
            InvitationLink.parse("027apps-dev://invite/$token?instance=https%3A%2F%2Fok.test%2Fpanel"),
        )
    }
}
