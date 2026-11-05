package com.rferic.zero27apps

/** Public Firebase configuration exposed by GET /api/v1/instance. */
data class FcmConfig(
    val projectId: String,
    val appId: String,
    val apiKey: String,
    val senderId: String,
) {
    companion object {
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

        fun deviceJson(pushToken: String): String {
            val escaped = pushToken.replace("\\", "\\\\").replace("\"", "\\\"")
            return "{\"platform\":\"android\",\"push_token\":\"$escaped\"}"
        }

        fun notificationTitle(data: Map<String, String>): String = data["key"] ?: "push.event"
    }
}
