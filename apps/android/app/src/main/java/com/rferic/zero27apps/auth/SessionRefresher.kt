package com.rferic.zero27apps.auth

import com.rferic.zero27apps.data.RefreshResult
import io.github.jan.supabase.auth.user.UserSession
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Renews the session at most once at a time, and only when it is worth it.
 *
 * Supabase rotates the refresh token on every renewal: presenting the previous
 * one again, outside its short reuse window, reads as a stolen token and ends
 * the **whole** session (GoTrue answers `refresh_token_already_used` and revokes
 * every token of the family). The boot, a 401 retry and the SDK's own timer used
 * to ask for a renewal independently, so two of them could leave with the same
 * token and one of them killed the session the other was using.
 *
 * Everything goes through this lock now, and the session is re-read inside it:
 * a caller that waited for another renewal finds a fresh token and does nothing.
 */
class SessionRefresher(
    private val session: () -> UserSession?,
    private val refresh: suspend () -> Unit,
) {
    private val mutex = Mutex()

    /**
     * `Refreshed` also means "the session is usable": nothing had to be done.
     * Only a rejected refresh token ([RefreshResult.NoSession]) ends the session;
     * a network failure leaves it untouched for the next attempt.
     */
    suspend fun ensure(nowMillis: Long = System.currentTimeMillis()): RefreshResult = mutex.withLock {
        val current = session() ?: return@withLock RefreshResult.NoSession
        if (!SessionExpiry.needsRefresh(current, nowMillis)) return@withLock RefreshResult.Refreshed
        runCatching { refresh() }.fold(
            onSuccess = { RefreshResult.Refreshed },
            onFailure = { error ->
                if (error is CancellationException) throw error
                refreshOutcome(error)
            },
        )
    }
}
