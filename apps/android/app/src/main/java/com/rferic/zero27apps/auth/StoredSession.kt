package com.rferic.zero27apps.auth

import io.github.jan.supabase.auth.user.UserSession
import kotlinx.serialization.json.Json

/**
 * The stored session, read without a Supabase client.
 *
 * Background work (the home widget, a notification action) must never build its
 * own client: the SDK loads the session, may renew it on load, and saves what it
 * got. Two clients over the same encrypted blob then take turns rotating the
 * same refresh token, and Supabase answers the second use with
 * `refresh_token_already_used`, which revokes the whole session and signs the
 * user out on the next launch. A background reader has no business rotating
 * anything: it sends the token it finds, and if it is gone or expired it just
 * draws less.
 */
object StoredSession {
    private val json = Json {
        encodeDefaults = true
        ignoreUnknownKeys = true
    }

    /** The session as it sits on disk; null when there is none or it is unreadable. */
    fun read(store: EncryptedStringStore): UserSession? {
        val plain = store.load() ?: return null
        return runCatching { json.decodeFromString(UserSession.serializer(), plain) }.getOrNull()
    }

    /**
     * The access token while it is still worth sending. Null once the session is
     * close to expiry: a background reader cannot renew it, so it would only
     * collect a 401.
     */
    fun accessToken(store: EncryptedStringStore, nowMillis: Long = System.currentTimeMillis()): String? {
        val session = read(store) ?: return null
        return if (SessionExpiry.needsRefresh(session, nowMillis)) null else session.accessToken
    }
}
