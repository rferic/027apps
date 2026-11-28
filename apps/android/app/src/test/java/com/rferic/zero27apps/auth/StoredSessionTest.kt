package com.rferic.zero27apps.auth

import com.rferic.zero27apps.StringStore
import io.github.jan.supabase.auth.user.UserSession
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import kotlin.time.Instant

private class MemoryStore : StringStore {
    val values = mutableMapOf<String, String>()

    override fun get(key: String): String? = values[key]
    override fun put(key: String, value: String) {
        values[key] = value
    }

    override fun remove(key: String) {
        values.remove(key)
    }
}

/** Marks the bytes so a round-trip is provable without a real Keystore. */
private class MarkingCipher : SecretCipher {
    override fun encrypt(plain: ByteArray): ByteArray = plain.reversedArray() + 0x7F
    override fun decrypt(data: ByteArray): ByteArray {
        require(data.last() == 0x7F.toByte()) { "not our blob" }
        return data.dropLast(1).toByteArray().reversedArray()
    }
}

class StoredSessionTest {
    private val store = EncryptedStringStore(MarkingCipher(), MemoryStore(), "session")
    private val json = Json {
        encodeDefaults = true
        ignoreUnknownKeys = true
    }

    private fun saveSession(expiresIn: Long, expiresAtMillis: Long) {
        val session = UserSession(
            accessToken = "access-token",
            refreshToken = "refresh-token",
            expiresIn = expiresIn,
            tokenType = "bearer",
            expiresAt = Instant.fromEpochMilliseconds(expiresAtMillis),
        )
        store.save(json.encodeToString(UserSession.serializer(), session))
    }

    @Test
    fun `reads the session the app stored`() {
        saveSession(expiresIn = 900, expiresAtMillis = 10_000_000)

        assertEquals("refresh-token", StoredSession.read(store)?.refreshToken)
        assertEquals("access-token", StoredSession.accessToken(store, nowMillis = 9_000_000))
    }

    @Test
    fun `an expired token is not worth sending`() {
        saveSession(expiresIn = 900, expiresAtMillis = 10_000_000)

        assertNull(StoredSession.accessToken(store, nowMillis = 10_000_000))
    }

    @Test
    fun `no stored session reads as nothing`() {
        assertNull(StoredSession.read(store))
        assertNull(StoredSession.accessToken(store))
    }
}
