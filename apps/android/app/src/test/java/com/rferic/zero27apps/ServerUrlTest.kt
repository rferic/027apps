package com.rferic.zero27apps

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ServerUrlTest {
    @Test
    fun `trims trailing slashes and keeps https`() {
        assertEquals("https://example.vercel.app", ServerUrl.normalize("https://example.vercel.app/"))
        assertEquals("https://example.vercel.app", ServerUrl.normalize("  https://example.vercel.app//  "))
    }

    @Test
    fun `keeps an explicit port`() {
        assertEquals("https://example.test:8443", ServerUrl.normalize("https://example.test:8443"))
    }

    @Test
    fun `rejects non http schemes`() {
        assertNull(ServerUrl.normalize("ftp://x"))
        assertNull(ServerUrl.normalize("javascript:alert(1)"))
        assertNull(ServerUrl.normalize(""))
    }

    @Test
    fun `release requires https`() {
        assertNull(ServerUrl.normalize("http://example.com", requireHttps = true))
        assertNull(ServerUrl.normalize("http://192.168.1.108:3003", requireHttps = true))
    }

    @Test
    fun `debug accepts http only for local and private hosts`() {
        assertEquals("http://192.168.1.108:3003", ServerUrl.normalize("http://192.168.1.108:3003", requireHttps = false))
        assertEquals("http://localhost:3003", ServerUrl.normalize("http://localhost:3003", requireHttps = false))
        assertEquals("http://10.0.2.2:3003", ServerUrl.normalize("http://10.0.2.2:3003", requireHttps = false))
        assertEquals("http://172.16.5.4", ServerUrl.normalize("http://172.16.5.4", requireHttps = false))
        assertNull(ServerUrl.normalize("http://example.com", requireHttps = false))
        assertNull(ServerUrl.normalize("http://11.0.0.1", requireHttps = false))
    }

    @Test
    fun `rejects userinfo, query, fragment and paths`() {
        assertNull(ServerUrl.normalize("https://user:pass@example.com"))
        assertNull(ServerUrl.normalize("https://example.com?x=1"))
        assertNull(ServerUrl.normalize("https://example.com#frag"))
        assertNull(ServerUrl.normalize("https://example.com/panel"))
    }

    @Test
    fun `rejects an empty or malformed host`() {
        assertNull(ServerUrl.normalize("https://"))
        assertNull(ServerUrl.normalize("not a url"))
    }
}
