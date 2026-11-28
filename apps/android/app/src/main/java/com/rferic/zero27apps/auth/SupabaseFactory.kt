package com.rferic.zero27apps.auth

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.realtime.Realtime

/**
 * One Supabase client per instance. The auth plugin is wired to the encrypted
 * session manager and to automatic refresh, so the app keeps the session across
 * launches without ever writing a token in clear text.
 *
 * The app's view model is its **only** owner. A second client over the same
 * stored session renews the same refresh token on its own account, and Supabase
 * revokes the whole session when it sees a rotated token presented again. The
 * widget and the notification actions read the token through [StoredSession]
 * instead of building a client.
 */
class SupabaseFactory(private val sessionStore: EncryptedStringStore) {
    fun create(supabaseUrl: String, anonKey: String): SupabaseClient =
        createSupabaseClient(supabaseUrl, anonKey) {
            install(Auth) {
                sessionManager = EncryptedSessionManager(sessionStore)
                alwaysAutoRefresh = true
            }
            install(Realtime)
        }
}
