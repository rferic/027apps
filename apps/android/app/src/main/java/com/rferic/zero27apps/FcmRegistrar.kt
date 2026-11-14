package com.rferic.zero27apps

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging
import java.net.HttpURLConnection
import java.net.URL

/** Registers this installation with the instance and keeps its FCM token fresh. */
class FcmRegistrar(private val context: Context) {
    private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private val mainHandler = Handler(Looper.getMainLooper())

    var instanceUrl: String?
        get() = prefs.getString("instance_url", null)
        private set(value) = prefs.edit().putString("instance_url", value).apply()

    var sessionToken: String?
        get() = prefs.getString("session_token", null)
        private set(value) = prefs.edit().putString("session_token", value).apply()

    fun configure(
        rawInstanceUrl: String,
        jwt: String,
        callback: (Result<String>) -> Unit,
    ) {
        val baseUrl = ServerUrl.normalize(rawInstanceUrl, requireHttps = !BuildConfig.DEBUG)
        if (baseUrl == null) {
            callback(Result.failure(IllegalArgumentException("Invalid instance URL")))
            return
        }
        if (jwt.isBlank()) {
            callback(Result.failure(IllegalArgumentException("A session token is required")))
            return
        }
        instanceUrl = baseUrl
        sessionToken = jwt

        Thread {
            try {
                val instance = request("GET", "$baseUrl/api/v1/instance", jwt, null)
                val config = FcmConfig.fromInstanceJson(instance)
                    ?: error("FCM public configuration is missing")
                remember(config)
                initializeFirebase(config)
                FirebaseMessaging.getInstance().token
                    .addOnSuccessListener { token -> registerDevice(token, callback) }
                    .addOnFailureListener { error -> callback(Result.failure(error)) }
            } catch (error: Exception) {
                mainHandler.post { callback(Result.failure(error)) }
            }
        }.start()
    }

    /** Called by Firebase when the installation token rotates. */
    fun registerToken(token: String) {
        val baseUrl = instanceUrl ?: return
        val jwt = sessionToken ?: return
        Thread {
            runCatching {
                request("POST", "$baseUrl/api/v1/devices", jwt, FcmConfig.deviceJson(token))
            }.onFailure { Log.w(TAG, "Could not refresh the FCM token", it) }
        }.start()
    }

    private fun registerDevice(token: String, callback: (Result<String>) -> Unit) {
        val baseUrl = instanceUrl ?: return
        val jwt = sessionToken ?: return
        Thread {
            try {
                request("POST", "$baseUrl/api/v1/devices", jwt, FcmConfig.deviceJson(token))
                mainHandler.post { callback(Result.success(token)) }
            } catch (error: Exception) {
                mainHandler.post { callback(Result.failure(error)) }
            }
        }.start()
    }

    /** Keeps the public config so a process started by FCM can initialize Firebase. */
    private fun remember(config: FcmConfig) {
        val editor = prefs.edit()
        config.toPrefs().forEach { (key, value) -> editor.putString(key, value) }
        editor.apply()
    }

    private fun initializeFirebase(config: FcmConfig) {
        initialize(context, config)
    }

    private fun request(method: String, url: String, jwt: String, body: String?): String {
        val connection = URL(url).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.connectTimeout = 10_000
            connection.readTimeout = 10_000
            connection.setRequestProperty("Authorization", "Bearer $jwt")
            if (body != null) {
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                connection.outputStream.use { it.write(body.toByteArray()) }
            }
            val status = connection.responseCode
            val stream = if (status >= 400) connection.errorStream else connection.inputStream
            val text = stream.bufferedReader().use { it.readText() }
            if (status !in 200..299) error("HTTP $status: ${text.take(200)}")
            return text
        } finally {
            connection.disconnect()
        }
    }

    companion object {
        private const val TAG = "FcmRegistrar"
        private const val PREFS = "fcm_runtime"

        /**
         * Called from `Application.onCreate`. FCM can start the process for a
         * data-only message with no Activity, so the default FirebaseApp must be
         * ready before `PushMessagingService` runs.
         */
        fun initializeFromStorage(context: Context): Boolean {
            if (FirebaseApp.getApps(context).isNotEmpty()) return true
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val values = listOf(
                FcmConfig.KEY_PROJECT_ID,
                FcmConfig.KEY_APP_ID,
                FcmConfig.KEY_API_KEY,
                FcmConfig.KEY_SENDER_ID,
            ).associateWith { prefs.getString(it, null) }
            val config = FcmConfig.fromPrefs(values) ?: return false
            return initialize(context, config)
        }

        private fun initialize(context: Context, config: FcmConfig): Boolean {
            if (FirebaseApp.getApps(context).isNotEmpty()) return true
            val options = FirebaseOptions.Builder()
                .setApplicationId(config.appId)
                .setApiKey(config.apiKey)
                .setProjectId(config.projectId)
                .setGcmSenderId(config.senderId)
                .build()
            return FirebaseApp.initializeApp(context, options) != null
        }
    }
}
