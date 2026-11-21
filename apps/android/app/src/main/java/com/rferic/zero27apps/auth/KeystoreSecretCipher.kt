package com.rferic.zero27apps.auth

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * AES-256-GCM with a key that never leaves the Android keystore. Each blob
 * carries its own random IV (`iv || ciphertext`, 12-byte IV, 128-bit tag).
 * If the key is gone (restored backup, cleared credentials) the session cannot
 * be decrypted and [decrypt] throws; the caller drops it and signs out.
 */
class KeystoreSecretCipher(private val alias: String = "027apps_session") : SecretCipher {
    /**
     * A key can be invalidated behind our back: the device credential changed,
     * a backup was restored, or the app was reinstalled over a stale entry. The
     * keystore then throws [KeyPermanentlyInvalidatedException] on every write,
     * which used to leave the app unable to persist a session ever again (the
     * user was signed out on every launch). Dropping the dead entry and minting
     * a new key fixes it; the session it was protecting is already unreadable.
     */
    override fun encrypt(plain: ByteArray): ByteArray = try {
        encryptWith(key(), plain)
    } catch (_: KeyPermanentlyInvalidatedException) {
        forget()
        encryptWith(key(), plain)
    }

    private fun encryptWith(key: SecretKey, plain: ByteArray): ByteArray {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, key)
        val iv = cipher.iv
        return iv + cipher.doFinal(plain)
    }

    override fun decrypt(data: ByteArray): ByteArray {
        if (data.size <= IV_SIZE) throw IllegalStateException("session blob is truncated")
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(TAG_BITS, data, 0, IV_SIZE))
        return cipher.doFinal(data, IV_SIZE, data.size - IV_SIZE)
    }

    /** Drops a dead key entry so [key] mints a fresh one. */
    private fun forget() {
        runCatching {
            KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }.deleteEntry(alias)
        }
    }

    private fun key(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        // An entry that cannot be read (invalidated or from another install)
        // counts as absent: it is deleted and regenerated below.
        val existing = runCatching { keyStore.getEntry(alias, null) as? KeyStore.SecretKeyEntry }
            .getOrNull()
        existing?.let { return it.secretKey }
        forget()
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
        generator.init(
            KeyGenParameterSpec.Builder(
                alias,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build(),
        )
        return generator.generateKey()
    }

    private companion object {
        const val ANDROID_KEYSTORE = "AndroidKeyStore"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val IV_SIZE = 12
        const val TAG_BITS = 128
    }
}
