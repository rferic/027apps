package com.rferic.zero27apps.auth

import com.rferic.zero27apps.StringStore
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

private class FakeStore : StringStore {
    val values = mutableMapOf<String, String>()

    override fun get(key: String): String? = values[key]
    override fun put(key: String, value: String) {
        values[key] = value
    }

    override fun remove(key: String) {
        values.remove(key)
    }
}

/** Reverses the bytes and marks them, so a round-trip is provable by eye. */
private class FakeCipher : SecretCipher {
    override fun encrypt(plain: ByteArray): ByteArray = plain.reversedArray() + 0x7F
    override fun decrypt(data: ByteArray): ByteArray {
        require(data.last() == 0x7F.toByte()) { "not our blob" }
        return data.dropLast(1).toByteArray().reversedArray()
    }
}

class EncryptedStringStoreTest {
    private val key = "session"
    private val prefs = FakeStore()
    private val store = EncryptedStringStore(FakeCipher(), prefs, key)

    @Test
    fun `round-trips a payload without leaving it in clear text`() {
        store.save("""{"access_token":"secret-token"}""")

        val raw = prefs.values.getValue(key)
        assertFalse(raw.contains("access_token"))
        assertFalse(raw.contains("secret-token"))
        assertEquals("""{"access_token":"secret-token"}""", store.load())
    }

    @Test
    fun `answers null when nothing was stored`() {
        assertNull(store.load())
    }

    @Test
    fun `drops an unreadable blob instead of failing every launch`() {
        prefs.put(key, "bm90LW91ci1ibG9i")

        assertNull(store.load())
        assertFalse(prefs.values.containsKey(key))
    }

    @Test
    fun `deleteSession removes the blob`() {
        store.save("value")
        store.clear()
        assertTrue(prefs.values.isEmpty())
    }
}
