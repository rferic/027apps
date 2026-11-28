package com.rferic.zero27apps.auth

import com.rferic.zero27apps.data.RefreshResult
import io.github.jan.supabase.auth.user.UserSession
import java.io.IOException
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.delay
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test
import kotlin.time.Instant

class SessionRefresherTest {
    private fun session(expiresAtMillis: Long, expiresIn: Long = 900) = UserSession(
        accessToken = "access",
        refreshToken = "refresh",
        expiresIn = expiresIn,
        tokenType = "bearer",
        expiresAt = Instant.fromEpochMilliseconds(expiresAtMillis),
    )

    @Test
    fun `a session with life left is not renewed`() = runTest {
        var renewals = 0
        val refresher = SessionRefresher({ session(10_000_000) }) { renewals++ }

        assertEquals(RefreshResult.Refreshed, refresher.ensure(nowMillis = 9_000_000))
        assertEquals(0, renewals)
    }

    @Test
    fun `an expiring session is renewed once for every caller at the same time`() = runTest {
        var current = session(1_000_000)
        var renewals = 0
        val refresher = SessionRefresher({ current }) {
            renewals++
            delay(100)
            current = session(5_000_000)
        }

        val results = List(5) { async { refresher.ensure(nowMillis = 1_000_000) } }.awaitAll()

        // Five callers, one rotation: the rest find the renewed session inside
        // the lock and do nothing.
        assertEquals(1, renewals)
        assertEquals(List(5) { RefreshResult.Refreshed }, results)
    }

    @Test
    fun `no stored session ends the session without asking the server`() = runTest {
        var renewals = 0
        val refresher = SessionRefresher({ null }) { renewals++ }

        assertEquals(RefreshResult.NoSession, refresher.ensure())
        assertEquals(0, renewals)
    }

    @Test
    fun `a network failure keeps the session for the next attempt`() = runTest {
        val refresher = SessionRefresher({ session(0) }) { throw IOException("offline") }

        assertEquals(RefreshResult.Network, refresher.ensure(nowMillis = 1))
    }
}
