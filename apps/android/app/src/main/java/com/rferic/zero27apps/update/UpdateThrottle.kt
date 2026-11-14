package com.rferic.zero27apps.update

import com.rferic.zero27apps.StringStore

/**
 * How often the app looks for a newer build on its own. Six hours is enough for
 * a family instance: releases are rare, and every check is a request against the
 * instance. The manual "check for updates" in Settings ignores this.
 */
class UpdateThrottle(
    private val store: StringStore,
    private val intervalMs: Long = DEFAULT_INTERVAL_MS,
    private val now: () -> Long = System::currentTimeMillis,
) {
    fun shouldCheck(): Boolean {
        val last = store.get(KEY)?.toLongOrNull() ?: return true
        return now() - last >= intervalMs
    }

    fun markChecked() {
        store.put(KEY, now().toString())
    }

    companion object {
        const val KEY = "update_checked_at"
        const val DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000L
    }
}
