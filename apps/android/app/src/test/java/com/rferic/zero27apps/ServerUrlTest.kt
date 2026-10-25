package com.rferic.zero27apps

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ServerUrlTest {
    @Test
    fun `normalize trims trailing slash`() {
        assertEquals(
            "https://mi-instancia.vercel.app",
            ServerUrl.normalize("https://mi-instancia.vercel.app/"),
        )
    }

    @Test
    fun `normalize rejects non http schemes`() {
        assertNull(ServerUrl.normalize("ftp://x"))
    }

    @Test
    fun `normalize keeps valid url unchanged`() {
        assertEquals("https://x", ServerUrl.normalize("https://x"))
    }
}
