package com.rferic.zero27apps

/**
 * Small port over `SharedPreferences` so [InstanceStore] is testable without
 * Android. Only the instance override lives here; the session has its own
 * encrypted store.
 */
interface StringStore {
    fun get(key: String): String?
    fun put(key: String, value: String)
    fun remove(key: String)
}

/**
 * Remembers a non-default instance. Empty means "the one this build targets":
 * [defaultUrl] comes from `BuildConfig.DEFAULT_INSTANCE_URL`, so the first
 * launch never asks for a URL and a tester can point it at the LAN.
 */
class InstanceStore(
    private val store: StringStore,
    private val defaultUrl: String,
) {
    fun current(): String = store.get(KEY) ?: defaultUrl

    fun isOverridden(): Boolean = store.get(KEY) != null

    fun save(url: String) {
        if (url == defaultUrl) store.remove(KEY) else store.put(KEY, url)
    }

    /** Called when switching instance: the session belongs to the old one. */
    fun clear() {
        store.remove(KEY)
    }

    companion object {
        const val KEY = "instance_url"
    }
}
