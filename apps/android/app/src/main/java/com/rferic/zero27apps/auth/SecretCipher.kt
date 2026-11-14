package com.rferic.zero27apps.auth

/** Symmetric cipher for the session blob; the Android implementation is [KeystoreSecretCipher]. */
interface SecretCipher {
    fun encrypt(plain: ByteArray): ByteArray
    fun decrypt(data: ByteArray): ByteArray
}
