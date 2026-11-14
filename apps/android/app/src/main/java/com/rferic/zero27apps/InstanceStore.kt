package com.rferic.zero27apps

import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json

/**
 * Remembers the instances this install has used, and which one is active. The
 * build-time instance is always first and cannot be removed, so a tester can
 * always come back to production after adding a LAN stack.
 */
class InstanceStore(
    private val store: StringStore,
    private val defaultUrl: String,
) {
    private val json = Json { ignoreUnknownKeys = true }

    fun current(): String = store.get(CURRENT) ?: defaultUrl

    fun isOverridden(): Boolean = store.get(CURRENT) != null

    /** The build default plus every instance the user added, in that order. */
    fun known(): List<String> {
        val saved = decode(store.get(KNOWN))
        return (listOf(defaultUrl) + saved + listOf(current())).distinct()
    }

    /** Adds the instance to the list without switching to it. */
    fun remember(url: String) {
        if (url == defaultUrl) return
        val next = (known() + url).distinct()
        store.put(KNOWN, json.encodeToString(ListSerializer(String.serializer()), next))
    }

    /** Switches the active instance (and remembers it). */
    fun save(url: String) {
        remember(url)
        if (url == defaultUrl) store.remove(CURRENT) else store.put(CURRENT, url)
    }

    /**
     * Writes the instance this install is using the first time it boots. An
     * update installs a build whose compiled default may be another instance
     * (the LAN APK and the published one disagree); pinning keeps the user where
     * they were instead of silently moving them to production.
     */
    fun pinDefault(): String {
        val current = store.get(CURRENT) ?: defaultUrl
        store.put(CURRENT, current)
        return current
    }

    /** Removes a saved instance; the active one falls back to the default. */
    fun forget(url: String) {
        if (url == defaultUrl) return
        val next = known().filterNot { it == url }
        store.put(
            KNOWN,
            json.encodeToString(ListSerializer(String.serializer()), next.filterNot { it == defaultUrl }),
        )
        if (current() == url) store.remove(CURRENT)
    }

    private fun decode(raw: String?): List<String> {
        if (raw.isNullOrBlank()) return emptyList()
        return runCatching {
            json.decodeFromString(ListSerializer(String.serializer()), raw)
        }.getOrDefault(emptyList())
    }

    companion object {
        const val CURRENT = "instance_url"
        const val KNOWN = "instance_history"
    }
}
