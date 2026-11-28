package com.rferic.zero27apps

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.widget.Toast
import androidx.core.app.NotificationCompat
import com.rferic.zero27apps.auth.EncryptedStringStore
import com.rferic.zero27apps.auth.KeystoreSecretCipher
import com.rferic.zero27apps.auth.StoredSession
import com.rferic.zero27apps.data.ApiClient
import com.rferic.zero27apps.data.RefreshResult
import com.rferic.zero27apps.prefs.PrefsStringStore
import com.rferic.zero27apps.ui.i18n.AppStrings
import io.ktor.client.engine.okhttp.OkHttp
import java.util.Locale
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * The two buttons a request notification carries (spec §5.2/§10): answer the
 * request without opening the app first. The inbox stays the source of truth;
 * this only saves the trip. Without a network the receiver says so and the
 * request remains in the inbox, untouched.
 */
class TodoRequestActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val requestId = intent.getStringExtra(EXTRA_REQUEST) ?: return
        val accept = intent.getBooleanExtra(EXTRA_ACCEPT, false)
        val notificationId = intent.getIntExtra(EXTRA_NOTIFICATION, 0)
        val pending = goAsync()
        val appContext = context.applicationContext
        CoroutineScope(Dispatchers.IO).launch {
            val strings = AppStrings.forLanguage(Locale.getDefault().language)
            var answered = false
            val message = try {
                answer(appContext, requestId, accept)
                answered = true
                if (accept) strings.todoRequestAccepted else strings.todoRequestDenied
            } catch (_: Throwable) {
                strings.tryAgain
            }
            if (answered && notificationId != 0) {
                val manager = appContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                manager.cancel(notificationId)
            }
            // Toasts need the main looper; the answer itself ran off it.
            withContext(Dispatchers.Main) {
                Toast.makeText(appContext, message, Toast.LENGTH_SHORT).show()
            }
            pending.finish()
        }
    }

    private suspend fun answer(context: Context, requestId: String, accept: Boolean) {
        val prefs = PrefsStringStore(context)
        val instance = InstanceStore(prefs, BuildConfig.DEFAULT_INSTANCE_URL).current()
        val sessionStore = EncryptedStringStore(KeystoreSecretCipher(), prefs, "session")
        // No Supabase client here: this runs next to the open app, and a second
        // client renewing the same refresh token is what makes Supabase revoke
        // the session. The tap sends the token the app stored and nothing else;
        // if it is expired the toast asks to try again from the app.
        val api = ApiClient(
            baseUrl = instance,
            engine = OkHttp.create(),
            token = { StoredSession.accessToken(sessionStore) },
            refresh = { RefreshResult.NoSession },
            protectionBypass = BuildConfig.VERCEL_PROTECTION_BYPASS,
        )
        try {
            if (accept) api.todoAcceptRequest(requestId) else api.todoDenyRequest(requestId)
        } finally {
            api.close()
        }
    }

    companion object {
        const val EXTRA_REQUEST = "request_id"
        const val EXTRA_ACCEPT = "accept"
        const val EXTRA_NOTIFICATION = "notification_id"

        /** The Accept and Deny buttons, one unique PendingIntent per request. */
        fun actions(context: Context, requestId: String, notificationId: Int): Array<NotificationCompat.Action> {
            fun action(accept: Boolean, label: String): NotificationCompat.Action {
                val intent = Intent(context, TodoRequestActionReceiver::class.java)
                    .putExtra(EXTRA_REQUEST, requestId)
                    .putExtra(EXTRA_ACCEPT, accept)
                    .putExtra(EXTRA_NOTIFICATION, notificationId)
                val pending = PendingIntent.getBroadcast(
                    context,
                    (requestId + accept).hashCode(),
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                )
                return NotificationCompat.Action.Builder(0, label, pending).build()
            }
            val strings = AppStrings.forLanguage(Locale.getDefault().language)
            return arrayOf(action(true, strings.todoAccept), action(false, strings.todoDeny))
        }
    }
}
