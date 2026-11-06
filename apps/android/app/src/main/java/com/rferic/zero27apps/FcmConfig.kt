package com.rferic.zero27apps

/** Public Firebase configuration exposed by GET /api/v1/instance. */
data class FcmConfig(
    val projectId: String,
    val appId: String,
    val apiKey: String,
    val senderId: String,
) {
    /** Persisted so a cold start (including one spawned by FCM) can init Firebase. */
    fun toPrefs(): Map<String, String> = mapOf(
        KEY_PROJECT_ID to projectId,
        KEY_APP_ID to appId,
        KEY_API_KEY to apiKey,
        KEY_SENDER_ID to senderId,
    )

    companion object {
        const val KEY_PROJECT_ID = "fcm_project_id"
        const val KEY_APP_ID = "fcm_app_id"
        const val KEY_API_KEY = "fcm_api_key"
        const val KEY_SENDER_ID = "fcm_sender_id"

        private fun readString(json: String, key: String): String? {
            val pattern = Regex("\\\"${Regex.escape(key)}\\\"\\s*:\\s*\\\"((?:[^\\\"\\\\]|\\\\.)*)\\\"")
            return pattern.find(json)?.groupValues?.get(1)
        }

        fun fromInstanceJson(json: String): FcmConfig? {
            val projectId = readString(json, "notifications.push.fcm_project_id") ?: return null
            val appId = readString(json, "notifications.push.fcm_app_id") ?: return null
            val apiKey = readString(json, "notifications.push.fcm_api_key") ?: return null
            val senderId = readString(json, "notifications.push.fcm_sender_id") ?: return null
            return FcmConfig(projectId, appId, apiKey, senderId)
        }

        fun fromPrefs(values: Map<String, String?>): FcmConfig? {
            return FcmConfig(
                values[KEY_PROJECT_ID] ?: return null,
                values[KEY_APP_ID] ?: return null,
                values[KEY_API_KEY] ?: return null,
                values[KEY_SENDER_ID] ?: return null,
            )
        }

        fun deviceJson(pushToken: String): String {
            val escaped = pushToken.replace("\\", "\\\\").replace("\"", "\\\"")
            return "{\"platform\":\"android\",\"push_token\":\"$escaped\"}"
        }

        fun notificationTitle(data: Map<String, String>): String = data["key"] ?: "push.event"
    }
}
