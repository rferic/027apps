package com.rferic.zero27apps

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

class InstanceStoreTest {
    private val default = "https://027apps.ericrf.com"

    @Test
    fun `returns the build default when nothing is stored`() {
        val store = InstanceStore(FakeStore(), default)

        assertEquals(default, store.current())
        assertFalse(store.isOverridden())
    }

    @Test
    fun `keeps an override for the next launch`() {
        val prefs = FakeStore()
        val store = InstanceStore(prefs, default)
        store.save("http://192.168.1.108:3003")

        assertEquals("http://192.168.1.108:3003", store.current())
        assertTrue(store.isOverridden())
        assertEquals("http://192.168.1.108:3003", prefs.values[InstanceStore.CURRENT])
    }

    @Test
    fun `known starts with the build default and keeps what the user added`() {
        val store = InstanceStore(FakeStore(), default)
        store.remember("http://192.168.1.108:3003")
        store.remember("https://staging.example.test")

        assertEquals(
            listOf(default, "http://192.168.1.108:3003", "https://staging.example.test"),
            store.known(),
        )
    }

    @Test
    fun `remember adds an instance without switching to it`() {
        val store = InstanceStore(FakeStore(), default)
        store.remember("http://192.168.1.108:3003")

        assertEquals(default, store.current())
        assertTrue(store.known().contains("http://192.168.1.108:3003"))
    }

    @Test
    fun `forget removes an instance and falls back to the default`() {
        val prefs = FakeStore()
        val store = InstanceStore(prefs, default)
        store.save("http://192.168.1.108:3003")

        store.forget("http://192.168.1.108:3003")

        assertEquals(default, store.current())
        assertFalse(store.known().contains("http://192.168.1.108:3003"))
    }

    @Test
    fun `storing the default drops the override`() {
        val prefs = FakeStore()
        val store = InstanceStore(prefs, default)
        store.save("http://192.168.1.108:3003")
        store.save(default)

        assertEquals(default, store.current())
        assertNull(prefs.values[InstanceStore.CURRENT])
    }
}
