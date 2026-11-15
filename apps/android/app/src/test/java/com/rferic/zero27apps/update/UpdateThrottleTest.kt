package com.rferic.zero27apps.update

import com.rferic.zero27apps.StringStore
import org.junit.Assert.assertFalse
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

class UpdateThrottleTest {
    private var now = 1_000_000L
    private val store = FakeStore()
    private val throttle = UpdateThrottle(store, intervalMs = 6 * 60 * 60 * 1000L) { now }

    @Test
    fun `checks the first time`() {
        assertTrue(throttle.shouldCheck())
    }

    @Test
    fun `waits six hours after a check`() {
        throttle.markChecked()
        now += 60 * 60 * 1000L
        assertFalse(throttle.shouldCheck())

        now += 5 * 60 * 60 * 1000L
        assertTrue(throttle.shouldCheck())
    }

    @Test
    fun `a corrupt timestamp checks again`() {
        store.put(UpdateThrottle.KEY, "not-a-number")
        assertTrue(throttle.shouldCheck())
    }
}
