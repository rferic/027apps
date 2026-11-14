package com.rferic.zero27apps

/**
 * Small port over `SharedPreferences` so the stores are testable without
 * Android. Values are either public (the instance list) or already encrypted
 * (the session blob).
 */
interface StringStore {
    fun get(key: String): String?
    fun put(key: String, value: String)
    fun remove(key: String)
}
