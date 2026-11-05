package com.rferic.zero27apps

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class FcmConfigTest {
    @Test
    fun `reads the public fcm configuration`() {
        val json = """
            {"settings_public": {
              "notifications.push.fcm_project_id": "demo-project",
              "notifications.push.fcm_app_id": "1:123:android:abc",
              "notifications.push.fcm_api_key": "api-key",
              "notifications.push.fcm_sender_id": "123"
            }}
        """.trimIndent()
        assertEquals(
            FcmConfig("demo-project", "1:123:android:abc", "api-key", "123"),
            FcmConfig.fromInstanceJson(json),
        )
    }

    @Test
    fun `returns null when fcm is not configured`() {
        assertNull(FcmConfig.fromInstanceJson("{\"settings_public\":{}}"))
    }

    @Test
    fun `builds the device registration payload`() {
        assertEquals(
            "{\"platform\":\"android\",\"push_token\":\"token\"}",
            FcmConfig.deviceJson("token"),
        )
    }

    @Test
    fun `uses the event key as the notification title`() {
        assertEquals("push.test", FcmConfig.notificationTitle(mapOf("key" to "push.test")))
        assertEquals("push.event", FcmConfig.notificationTitle(emptyMap()))
    }
}
