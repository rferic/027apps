package com.rferic.zero27apps.auth

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.createSupabaseClient

/**
 * One Supabase client per instance. The auth plugin is wired to the encrypted
 * session manager and to automatic refresh, so the app keeps the session across
 * launches without ever writing a token in clear text.
 */
class SupabaseFactory(private val sessionStore: EncryptedStringStore) {
    fun create(supabaseUrl: String, anonKey: String): SupabaseClient =
        createSupabaseClient(supabaseUrl, anonKey) {
            install(Auth) {
                sessionManager = EncryptedSessionManager(sessionStore)
                alwaysAutoRefresh = true
            }
        }
}
