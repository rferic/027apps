package com.rferic.zero27apps.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

/**
 * DTOs of the Core API the app consumes (v1). Every field the app does not need
 * is left out on purpose: the parser ignores unknown keys, so the server can
 * grow without breaking old clients.
 */

@Serializable
data class InstanceResponse(
    val version: String,
    @SerialName("requires_setup") val requiresSetup: Boolean = false,
    @SerialName("setup_incomplete") val setupIncomplete: Boolean = false,
    val auth: AuthConfig? = null,
    @SerialName("settings_public") val settingsPublic: Map<String, JsonElement> = emptyMap(),
)

@Serializable
data class AuthConfig(
    @SerialName("supabase_url") val supabaseUrl: String,
    @SerialName("supabase_anon_key") val supabaseAnonKey: String,
)

@Serializable
data class UserDto(
    val id: String,
    @SerialName("display_name") val displayName: String,
    val locale: String = "en",
    val timezone: String = "UTC",
    val theme: String = "system",
    val role: String = "user",
    @SerialName("deactivated_at") val deactivatedAt: String? = null,
)

@Serializable
data class MeResponse(val user: UserDto)

@Serializable
data class ModuleDto(
    val key: String,
    val name: String,
    val version: String = "0.0.0",
    val state: String = "active",
    @SerialName("is_public") val isPublic: Boolean = false,
    @SerialName("manifest_digest") val manifestDigest: String = "",
)

@Serializable
data class MyModulesResponse(
    val modules: List<ModuleDto> = emptyList(),
    val total: Int = 0,
    val limit: Int = 20,
    val offset: Int = 0,
)

@Serializable
data class ErrorEnvelope(val error: ErrorBody)

@Serializable
data class ErrorBody(
    val code: String,
    val message: String = "",
)

@Serializable
data class PatchMeRequest(
    @SerialName("display_name") val displayName: String? = null,
    val locale: String? = null,
    val theme: String? = null,
)

@Serializable
data class RedeemRequest(
    val email: String,
    val password: String,
    @SerialName("display_name") val displayName: String? = null,
)

@Serializable
data class RedeemResponse(
    val invitation_id: String = "",
)
