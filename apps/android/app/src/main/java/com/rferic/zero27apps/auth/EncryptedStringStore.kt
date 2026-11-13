package com.rferic.zero27apps.auth

import com.rferic.zero27apps.StringStore
import java.util.Base64

/**
 * Encrypts one string before it reaches [StringStore]. The stored value is
 * Base64 of `iv || ciphertext`; nothing readable is left on disk, so a backup
 * of the preferences file does not leak the session. A value that cannot be
 * decrypted is deleted instead of crashing the launch.
 */
class EncryptedStringStore(
    private val cipher: SecretCipher,
    private val store: StringStore,
    private val key: String,
) {
    fun save(plain: String) {
        val encrypted = cipher.encrypt(plain.encodeToByteArray())
        store.put(key, Base64.getEncoder().encodeToString(encrypted))
    }

    fun load(): String? {
        val stored = store.get(key) ?: return null
        return try {
            cipher.decrypt(Base64.getDecoder().decode(stored)).decodeToString()
        } catch (_: Exception) {
            // Wrong key, truncated blob or a restored backup: drop it and start
            // signed out instead of failing every launch.
            store.remove(key)
            null
        }
    }

    fun clear() = store.remove(key)
}
