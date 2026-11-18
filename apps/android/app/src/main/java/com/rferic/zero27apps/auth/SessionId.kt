package com.rferic.zero27apps.auth

import java.util.Base64
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * The session id Supabase puts in the access token's `session_id` claim. The
 * SDK does not expose it, and phone migration needs it to revoke the other
 * sessions on the server without guessing which one is ours.
 */
fun sessionIdOf(accessToken: String?): String? {
    val token = accessToken ?: return null
    val payload = token.split(".").getOrNull(1) ?: return null
    return runCatching {
        val json = String(Base64.getUrlDecoder().decode(payload), Charsets.UTF_8)
        Json.parseToJsonElement(json).jsonObject["session_id"]?.jsonPrimitive?.content
    }.getOrNull()
}
