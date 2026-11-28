package com.rferic.zero27apps.auth

import io.github.jan.supabase.auth.user.UserSession

/**
 * When a session is old enough to renew.
 *
 * The SDK renews a session once it is inside the last 30% of its lifetime
 * (`SESSION_REFRESH_THRESHOLD`); the app makes the same decision itself instead
 * of renewing on every launch. A token that is still good does not need a new
 * one, and every rotation it skips is one fewer chance of two renewals leaving
 * at the same time (see [SessionRefresher]).
 */
object SessionExpiry {
    /** Renew once less than 30% of the session's lifetime is left. */
    private const val THRESHOLD = 0.3

    fun needsRefresh(session: UserSession, nowMillis: Long = System.currentTimeMillis()): Boolean {
        val lifetime = session.expiresIn.coerceAtLeast(1L) * 1000L
        val renewAt = session.expiresAt.toEpochMilliseconds() - (lifetime * (1 - THRESHOLD)).toLong()
        return renewAt <= nowMillis
    }
}
