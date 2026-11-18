package com.rferic.zero27apps.auth

import java.util.Base64
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** The migration needs the session id the SDK keeps inside the JWT. */
class SessionIdTest {
    private fun jwt(payload: String): String {
        val encoder = Base64.getUrlEncoder().withoutPadding()
        return listOf(
            encoder.encodeToString("""{"alg":"none"}""".toByteArray()),
            encoder.encodeToString(payload.toByteArray()),
            "signature",
        ).joinToString(".")
    }

    @Test
    fun `reads the session id from the access token`() {
        val token = jwt("""{"sub":"u-1","session_id":"8f14e45f-ceea-467f-a1b0-000000000001"}""")

        assertEquals("8f14e45f-ceea-467f-a1b0-000000000001", sessionIdOf(token))
    }

    @Test
    fun `returns null when the claim or the token is missing`() {
        assertNull(sessionIdOf(null))
        assertNull(sessionIdOf(""))
        assertNull(sessionIdOf("not-a-jwt"))
        assertNull(sessionIdOf(jwt("""{"sub":"u-1"}""")))
    }

    @Test
    fun `ignores a payload that is not JSON`() {
        assertNull(sessionIdOf(jwt("not json")))
    }
}
