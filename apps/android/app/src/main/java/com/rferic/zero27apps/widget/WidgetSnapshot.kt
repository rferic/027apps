package com.rferic.zero27apps.widget

import android.content.Context
import com.rferic.zero27apps.auth.EncryptedStringStore
import com.rferic.zero27apps.auth.KeystoreSecretCipher
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
    val owedToYouMinor: Long = 0,
    val youOweMinor: Long = 0,
    val groups: List<WidgetGroup> = emptyList(),
    /** Newest movement, so the card has something to say when the balance is zero. */
    val lastGroup: String? = null,
    val lastDescription: String? = null,
    val lastAmountMinor: Long = 0,
    val lastDate: String? = null,
    val locale: String = "en",
    val updatedAt: Long = 0,
)

class WidgetSnapshotStore(context: Context) {
    // The snapshot carries names and balances: it is encrypted with the same
    // Keystore key as the session, so a backup of the preferences file leaks nothing.
    private val store = EncryptedStringStore(
        KeystoreSecretCipher(),
        PrefsStringStore(context.applicationContext),
        KEY,
    )
    private val json = Json { ignoreUnknownKeys = true }

    fun read(): WidgetSnapshot {
        val raw = store.load() ?: return WidgetSnapshot()
        return runCatching { json.decodeFromString<WidgetSnapshot>(raw) }.getOrDefault(WidgetSnapshot())
    }

    fun write(snapshot: WidgetSnapshot) {
        store.save(json.encodeToString(WidgetSnapshot.serializer(), snapshot))
    }

    fun clear() {
        store.clear()
    }

    private companion object {
        const val KEY = "owe_widget"
    }
}
