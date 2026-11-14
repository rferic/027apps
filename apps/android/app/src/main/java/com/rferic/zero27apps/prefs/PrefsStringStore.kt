package com.rferic.zero27apps.prefs

import android.content.Context
import com.rferic.zero27apps.StringStore

/**
 * `SharedPreferences` adapter. The values it holds are either public (the
 * instance URL) or already encrypted (the session blob), never a token.
 */
class PrefsStringStore(context: Context, name: String = "027apps") : StringStore {
    private val prefs = context.getSharedPreferences(name, Context.MODE_PRIVATE)

    override fun get(key: String): String? = prefs.getString(key, null)

    override fun put(key: String, value: String) {
        prefs.edit().putString(key, value).apply()
    }

    override fun remove(key: String) {
        prefs.edit().remove(key).apply()
    }
}
