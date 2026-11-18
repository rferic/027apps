package com.rferic.zero27apps.auth

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MigrationLinkTest {
    private val token = "027_mig_abcdefghijklmnop"

    @Test
    fun `reads the https migration link from any instance`() {
        val link = MigrationLink.parse("https://027apps.ericrf.com/migrate/$token")
        assertEquals(token, link?.token)
        assertEquals("https://027apps.ericrf.com", link?.instance)
    }

    @Test
    fun `reads the app scheme and takes the instance from the query`() {
        val link = MigrationLink.parse(
            "zero27apps-dev://migrate/$token?instance=http%3A%2F%2F192.168.1.108%3A3003",
        )
        assertEquals(token, link?.token)
        assertEquals("http://192.168.1.108:3003", link?.instance)
    }

    @Test
    fun `accepts a short token the server would accept`() {
        val link = MigrationLink.parse("zero27apps://migrate/027_mig_a?instance=https%3A%2F%2Fok.test")
        assertEquals("027_mig_a", link?.token)
    }

    @Test
    fun `rejects an invitation token, http and a wrong host`() {
        assertNull(MigrationLink.parse("zero27apps://migrate/027_inv_abcdefgh?instance=https%3A%2F%2Fok.test"))
        assertNull(MigrationLink.parse("http://027apps.ericrf.com/migrate/$token"))
        assertNull(MigrationLink.parse("zero27apps://other/$token"))
        assertNull(MigrationLink.parse("not a link"))
    }
}
