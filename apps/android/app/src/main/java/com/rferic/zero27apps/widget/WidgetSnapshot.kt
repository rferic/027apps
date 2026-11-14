package com.rferic.zero27apps.widget

import android.content.Context
import com.rferic.zero27apps.prefs.PrefsStringStore
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class WidgetGroup(
    val name: String,
    val amountMinor: Long,
)

/**
 * What the home widget paints. It is written by [OweWidgetWorker] and read by
 * the widget itself, so drawing never touches the network or the session.
 */
@Serializable
data class WidgetSnapshot(
    val signedIn: Boolean = false,
    val currency: String = "EUR",
    val netMinor: Long = 0,
    val groups: List<WidgetGroup> = emptyList(),
    val locale: String = "en",
    val updatedAt: Long = 0,
)

class WidgetSnapshotStore(context: Context) {
    private val store = PrefsStringStore(context.applicationContext)
    private val json = Json { ignoreUnknownKeys = true }

    fun read(): WidgetSnapshot {
        val raw = store.get(KEY) ?: return WidgetSnapshot()
        return runCatching { json.decodeFromString<WidgetSnapshot>(raw) }.getOrDefault(WidgetSnapshot())
    }

    fun write(snapshot: WidgetSnapshot) {
        store.put(KEY, json.encodeToString(WidgetSnapshot.serializer(), snapshot))
    }

    fun clear() {
        store.remove(KEY)
    }

    private companion object {
        const val KEY = "owe_widget"
    }
}
