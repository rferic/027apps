package com.rferic.zero27apps.auth

import io.github.jan.supabase.auth.SessionManager
import io.github.jan.supabase.auth.user.UserSession
import kotlinx.serialization.json.Json

/**
 * Supabase session persistence over [EncryptedStringStore]: the library hands
 * us a [UserSession] and we store its JSON encrypted with the keystore key.
 * `encodeDefaults` keeps every field the library expects when it reads it back;
 * `ignoreUnknownKeys` lets a newer library add fields without a migration.
 */
class EncryptedSessionManager(
    store: EncryptedStringStore,
) : SessionManager {
    private val store = store
    private val json = Json {
        encodeDefaults = true
        ignoreUnknownKeys = true
    }

    override suspend fun saveSession(session: UserSession) {
        store.save(json.encodeToString(UserSession.serializer(), session))
    }

    override suspend fun loadSession(): UserSession {
        val plain = store.load() ?: throw IllegalStateException("No stored session")
        return try {
            json.decodeFromString(UserSession.serializer(), plain)
        } catch (error: Exception) {
            store.clear()
            throw IllegalStateException("Stored session is unreadable", error)
        }
    }

    override suspend fun deleteSession() = store.clear()
}
