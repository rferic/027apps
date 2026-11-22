package com.rferic.zero27apps

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging
import com.rferic.zero27apps.auth.EncryptedStringStore
import com.rferic.zero27apps.auth.KeystoreSecretCipher
import com.rferic.zero27apps.data.vercelProtectionBypass
import com.rferic.zero27apps.prefs.PrefsStringStore
import java.net.HttpURLConnection
import java.net.URL

/** Registers this installation with the instance and keeps its FCM token fresh. */
class FcmRegistrar(private val context: Context) {
    private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    // The session JWT never lands in clear text, not even for the FCM callback.
    private val secrets = EncryptedStringStore(
        KeystoreSecretCipher(),
        PrefsStringStore(context, PREFS),
        "session_token",
    )
    private val mainHandler = Handler(Looper.getMainLooper())

    var instanceUrl: String?
        get() = prefs.getString("instance_url", null)
        private set(value) = prefs.edit().putString("instance_url", value).apply()

    var sessionToken: String?
        get() = secrets.load()
        private set(value) {
            if (value == null) secrets.clear() else secrets.save(value)
        }

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

    /** Forgets the session material on sign-out or an instance change. */
    /**
     * Signing out or switching instance must stop the pushes: the server still
     * had the token and kept sending a former account's groups to this phone.
     * It runs before the session is dropped, so the JWT is still valid.
     */
    /** The server device id of this install, when push registration succeeded. */
    fun deviceId(): String? = prefs.getString("device_id", null)

    /**
     * `accessToken` is the live Supabase token: the one kept from `configure`
     * expires after 15 minutes, and sending it would leave the device
     * registered forever. Falls back to the stored one when none is given.
     */
    fun revoke(accessToken: String? = null) {
        val baseUrl = instanceUrl
        val jwt = accessToken ?: sessionToken
        val deviceId = prefs.getString("device_id", null)
        val token = prefs.getString("push_token", null)
        if (baseUrl != null && jwt != null) {
            Thread {
                runCatching {
                    if (deviceId != null) {
                        request("DELETE", "$baseUrl/api/v1/devices/$deviceId?sessions=local", jwt, null)
                    }
                }.onFailure { Log.w(TAG, "Could not revoke this device", it) }
                // A local instance has no FCM config, so Firebase is never
                // initialised here: calling it anyway killed the process (an
                // uncaught exception in a plain thread) on every local logout.
                runCatching {
                    if (FirebaseApp.getApps(context).isNotEmpty()) {
                        FirebaseMessaging.getInstance().deleteToken()
                    }
                }.onFailure { Log.w(TAG, "Could not delete the FCM token", it) }
            }.start()
        }
        if (token != null) prefs.edit().remove("push_token").apply()
        clear()
    }

    fun clear() {
        secrets.clear()
        prefs.edit().remove("instance_url").remove("device_id").apply()
    }

    /** The server returns `{ device: { id } }`; keep it for the revoke call. */
    private fun rememberDeviceId(body: String) {
        val id = Regex("\"id\"\\s*:\\s*\"([0-9a-fA-F-]{36})\"").find(body)?.groupValues?.get(1)
        if (id != null) prefs.edit().putString("device_id", id).apply()
        else prefs.edit().remove("device_id").apply()
    }

    /**
     * Called by Firebase when the installation token rotates. The stored JWT may
     * have expired by then, so a failure keeps the token pending: the next app
     * start registers it with a fresh session instead of losing the device.
     */
    fun registerToken(token: String) {
        val baseUrl = instanceUrl ?: return
        val jwt = sessionToken ?: return
        Thread {
            runCatching {
                request("POST", "$baseUrl/api/v1/devices", jwt, FcmConfig.deviceJson(token))
                prefs.edit().remove("pending_token").apply()
            }.onFailure { error ->
                Log.w(TAG, "Could not refresh the FCM token", error)
                prefs.edit().putString("pending_token", token).apply()
            }
        }.start()
    }

    /** A token Firebase rotated while the session was not usable yet, if any. */
    fun pendingToken(): String? = prefs.getString("pending_token", null)

    private fun registerDevice(token: String, callback: (Result<String>) -> Unit) {
        val baseUrl = instanceUrl ?: return
        val jwt = sessionToken ?: return
        Thread {
            try {
                val body = request("POST", "$baseUrl/api/v1/devices", jwt, FcmConfig.deviceJson(token))
                prefs.edit().remove("pending_token").apply()
                rememberDeviceId(body)
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
            // A protected preview blocks every request without this header,
            // including the instance read that starts push registration.
            vercelProtectionBypass(url)?.let {
                connection.setRequestProperty("x-vercel-protection-bypass", it)
            }
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
