package com.rferic.zero27apps.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.json.JsonObject
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
    @SerialName("app_actions") val appActions: List<AppActionDto> = emptyList(),
)

@Serializable
data class AppActionDto(
    val key: String,
    val label: String,
    val icon: String = "box",
    val screen: String = "",
)

@Serializable
data class WidgetDto(
    val key: String,
    val type: String = "summary",
    val surface: String = "app",
    val title: String = "",
    val icon: String = "box",
    val order: Int = 0,
    @SerialName("module_key") val moduleKey: String = "",
    val data: JsonElement? = null,
)

@Serializable
data class DashboardResponse(val widgets: List<WidgetDto> = emptyList())

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
    val details: JsonObject? = null,
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

@Serializable
data class AndroidReleaseDto(
    @SerialName("version_code") val versionCode: Int,
    @SerialName("version_name") val versionName: String,
    val tag: String = "",
    @SerialName("apk_url") val apkUrl: String,
)
