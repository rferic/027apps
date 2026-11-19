package com.rferic.zero27apps.auth

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class JoinLinkTest {
    private val code = "027_join_abcdefghijklmnop"

    @Test
    fun `reads an https join link from any instance`() {
        val link = JoinLink.parse("https://027apps.ericrf.com/join/$code")
        assertEquals(code, link?.code)
        assertEquals("https://027apps.ericrf.com", link?.instance)

        val selfHosted = JoinLink.parse("https://mi-casa.example.test/join/$code")
        assertEquals("https://mi-casa.example.test", selfHosted?.instance)
    }

    @Test
    fun `reads the app scheme and takes the instance from the query`() {
        val link = JoinLink.parse(
            "zero27apps-dev://join/$code?instance=http%3A%2F%2F192.168.1.108%3A3003",
        )
        assertEquals(code, link?.code)
        assertEquals("http://192.168.1.108:3003", link?.instance)
    }

    @Test
    fun `falls back to production when the scheme carries no instance`() {
        val link = JoinLink.parse("027apps://join/$code")
        assertEquals("https://027apps.ericrf.com", link?.instance)
    }

    @Test
    fun `rejects an invitation token, http and a wrong host`() {
        assertNull(JoinLink.parse("zero27apps://join/027_inv_abcdefgh?instance=https%3A%2F%2Fok.test"))
        assertNull(JoinLink.parse("http://027apps.ericrf.com/join/$code"))
        assertNull(JoinLink.parse("zero27apps://other/$code"))
        assertNull(JoinLink.parse("not a link"))
    }

    @Test
    fun `rejects a missing or malformed code`() {
        assertNull(JoinLink.parse("https://027apps.ericrf.com/join/"))
        assertNull(JoinLink.parse("https://027apps.ericrf.com/join/027_join_"))
    }

    @Test
    fun `rejects an instance that this build would not accept`() {
        assertNull(JoinLink.parse("027apps-dev://join/$code?instance=ftp%3A%2F%2Fbad"))
    }
}
