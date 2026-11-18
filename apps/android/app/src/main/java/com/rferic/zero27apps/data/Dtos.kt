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
    val branding: ModuleBrandingDto = ModuleBrandingDto(),
)

@Serializable
data class ModuleBrandingDto(
    val color: String = "emerald",
    val icon: String? = null,
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
    /** Only for a new account; an existing one signs in first (D21). */
    val password: String? = null,
)

@Serializable
data class RedeemUserDto(
    val id: String = "",
    val email: String = "",
    @SerialName("display_name") val displayName: String = "",
    val role: String = "user",
)

@Serializable
data class RedeemResponse(
    @SerialName("invitation_id") val invitationId: String = "",
    val user: RedeemUserDto = RedeemUserDto(),
)

/** Public invitation preview (A2): the form is rendered from this, not the link. */
@Serializable
data class InvitationPreviewDto(
    val state: String = "pending",
    val email: String = "",
    val name: String = "",
    val role: String = "user",
    @SerialName("role_applies") val roleApplies: Boolean = false,
    @SerialName("account_exists") val accountExists: Boolean = false,
    val locale: String = "en",
    @SerialName("expires_at") val expiresAt: String = "",
    @SerialName("inviter_name") val inviterName: String? = null,
    @SerialName("instance_name") val instanceName: String = "027Apps",
    val timezone: String = "UTC",
)

@Serializable
data class InvitationPreviewResponse(val invitation: InvitationPreviewDto)

@Serializable
data class AndroidReleaseDto(
    @SerialName("version_code") val versionCode: Int,
    @SerialName("version_name") val versionName: String,
    val tag: String = "",
    @SerialName("apk_url") val apkUrl: String,
    val sha256: String? = null,
)

@Serializable
data class DeviceTransferCreatedDto(
    @SerialName("transfer") val transfer: DeviceTransferIdDto,
    val token: String = "",
    val path: String = "",
)

@Serializable
data class DeviceTransferIdDto(
    val id: String = "",
    @SerialName("expires_at") val expiresAt: String = "",
)

@Serializable
data class DeviceTransferStatusDto(
    val id: String = "",
    val state: String = "pending",
    @SerialName("expires_at") val expiresAt: String = "",
    @SerialName("used_at") val usedAt: String? = null,
)

@Serializable
data class DeviceTransferStatusResponse(val transfer: DeviceTransferStatusDto)

/** The exchange returns a magic-link hash, never a session or refresh token. */
@Serializable
data class DeviceTransferExchangeDto(
    @SerialName("transfer_id") val transferId: String = "",
    val email: String = "",
    @SerialName("token_hash") val tokenHash: String = "",
    @SerialName("expires_at") val expiresAt: String = "",
)

@Serializable
data class RevokeOtherSessionsRequest(@SerialName("keep_session_id") val keepSessionId: String)

@Serializable
data class RevokeOthersResponse(val revoked: Int = 0)
