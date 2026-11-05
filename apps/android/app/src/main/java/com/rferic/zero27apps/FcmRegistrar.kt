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
    private val prefs = context.getSharedPreferences("fcm_runtime", Context.MODE_PRIVATE)
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
        val baseUrl = ServerUrl.normalize(rawInstanceUrl)
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

    private fun initializeFirebase(config: FcmConfig) {
        if (FirebaseApp.getApps(context).isNotEmpty()) return
        val options = FirebaseOptions.Builder()
            .setApplicationId(config.appId)
            .setApiKey(config.apiKey)
            .setProjectId(config.projectId)
            .setGcmSenderId(config.senderId)
            .build()
        FirebaseApp.initializeApp(context, options)
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

    private companion object {
        const val TAG = "FcmRegistrar"
    }
}
