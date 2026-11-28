package com.rferic.zero27apps

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.rferic.zero27apps.prefs.PrefsStringStore
import com.rferic.zero27apps.ui.i18n.AppStrings
import java.util.Locale

/** Displays data-only FCM messages; the server sends a key, never localized text. */
class PushMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        FcmRegistrar(applicationContext).registerToken(token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val data = message.data
        val locale = Locale.getDefault().language
        val strings = AppStrings.forLanguage(locale)
        val masked = PrefsStringStore(applicationContext).get("privacy.masked") == "true"
        val title = PushText.title(data["module"])
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "027Apps events", NotificationManager.IMPORTANCE_DEFAULT),
        )
        // An invitation push opens the invitation screen; every other push still
        // opens the group it names. The server only sends the request push to
        // administrators, so no role check is needed here.
        val isInvitation = data["key"] == "push.invitation_requested" ||
            data["key"] == "push.invitation_request_resolved"
        val isTodo = data["key"]?.startsWith(TODO_PREFIX) == true
        val open = Intent(this, MainActivity::class.java)
            .putExtra("start", when {
                isInvitation -> "invite"
                isTodo -> "todo_group"
                else -> "owe_group"
            })
        data["target"]?.let { open.putExtra("group", it) }
        // One PendingIntent per group: with a fixed request code every
        // notification reused the first group's intent and opened the wrong one.
        val requestCode = data["target"]?.hashCode() ?: 0
        val intent = PendingIntent.getActivity(
            this,
            requestCode,
            open,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(PushText.body(data, masked, locale, strings.pushEvent))
            .setContentIntent(intent)
            .setAutoCancel(true)
        // A request is answered from the notification (spec §5.2); the inbox
        // remains the place to find it when the push was missed.
        val notificationId = System.currentTimeMillis().toInt()
        val requestId = data["request_id"]
        if (data["key"] == TODO_REQUEST && !requestId.isNullOrBlank()) {
            TodoRequestActionReceiver.actions(this, requestId, notificationId).forEach(builder::addAction)
        }
        manager.notify(notificationId, builder.build())
    }

    private companion object {
        const val CHANNEL_ID = "027apps.events"
        /** Every NotNow event starts here; the app localizes by its full key. */
        const val TODO_PREFIX = "push.todo_"
        const val TODO_REQUEST = "push.todo_request_created"
    }
}
