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
    /** Anonymous invitation: the name the invitee typed, used for the profile. */
    val name: String? = null,
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
    /**
     * Null on an anonymous member invitation (`requires_identity`): the invitee
     * fills name and email in the form, and the server only learns them at
     * redemption.
     */
    val email: String? = null,
    val name: String? = null,
    @SerialName("requires_identity") val requiresIdentity: Boolean = false,
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

// --- Invitations (sprint 18: club quota, QR and requests) ------------------

/** The caller's live quota (spec §6.2): seats from the level plus grants. */
@Serializable
data class InvitationQuotaDto(
    val level: Int? = null,
    val base: Int = 0,
    val granted: Int = 0,
    val used: Int = 0,
    val reserved: Int = 0,
    val remaining: Int = 0,
    val unlimited: Boolean = false,
    @SerialName("pending_request") val pendingRequest: PendingInvitationRequestDto? = null,
)

@Serializable
data class PendingInvitationRequestDto(
    val id: String = "",
    val amount: Int = 0,
    @SerialName("created_at") val createdAt: String = "",
)

/** A pending member/QR link; the token is never listed, so there is no path. */
@Serializable
data class MemberInvitationDto(
    val id: String = "",
    val state: String = "pending",
    val source: String = "member",
    @SerialName("expires_at") val expiresAt: String = "",
    val path: String? = null,
    @SerialName("created_at") val createdAt: String = "",
)

@Serializable
data class InviteeDto(
    val id: String = "",
    @SerialName("display_name") val displayName: String = "",
    val level: Int? = null,
    val state: String = "active",
    @SerialName("joined_at") val joinedAt: String = "",
)

/** One of the caller's recent quota requests, resolved or not. */
@Serializable
data class InvitationRequestDto(
    val id: String = "",
    val amount: Int = 0,
    val reason: String? = null,
    val state: String = "pending",
    @SerialName("granted_amount") val grantedAmount: Int? = null,
    @SerialName("resolution_reason") val resolutionReason: String? = null,
    @SerialName("resolved_at") val resolvedAt: String? = null,
    @SerialName("created_at") val createdAt: String = "",
)

@Serializable
data class MeInvitationsResponse(
    val quota: InvitationQuotaDto = InvitationQuotaDto(),
    val invitations: List<MemberInvitationDto> = emptyList(),
    val invitees: List<InviteeDto> = emptyList(),
    val requests: List<InvitationRequestDto> = emptyList(),
)

/** `POST /me/invitations`: the token is returned exactly once, in the path. */
@Serializable
data class CreatedInvitationResponse(
    val token: String = "",
    val path: String = "",
)

/** `POST /me/join-codes`: a 90-second rotating code for the QR. */
@Serializable
data class JoinCodeDto(
    val id: String = "",
    val code: String = "",
    @SerialName("expires_at") val expiresAt: String = "",
    val path: String = "",
)

/** `POST /join-codes/{code}/exchange`: the code becomes a 15-minute invitation. */
@Serializable
data class JoinCodeExchangeDto(
    val token: String = "",
    val path: String = "",
)

@Serializable
data class RequestInvitationQuotaBody(
    val amount: Int,
    val reason: String? = null,
)

@Serializable
data class InvitationRequestResponse(val request: InvitationRequestDto)

/** One admin read-only request row (`GET /invitation-requests`). */
@Serializable
data class AdminInvitationRequestDto(
    val id: String = "",
    val requester: RequestRequesterDto = RequestRequesterDto(),
    val amount: Int = 0,
    val reason: String? = null,
    val state: String = "pending",
    @SerialName("created_at") val createdAt: String = "",
)

@Serializable
data class RequestRequesterDto(
    val id: String = "",
    @SerialName("display_name") val displayName: String = "",
    val level: Int? = null,
)

@Serializable
data class AdminInvitationRequestsResponse(
    val requests: List<AdminInvitationRequestDto> = emptyList(),
)
