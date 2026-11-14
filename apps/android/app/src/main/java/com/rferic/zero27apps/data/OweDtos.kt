package com.rferic.zero27apps.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** OweNo DTOs; the module's API answers snake_case for rows and camelCase inside shares. */

@Serializable
data class OweGroupDto(
    val id: String,
    val name: String,
    val currency: String,
    val archived: Boolean = false,
    @SerialName("created_by") val createdBy: String? = null,
    val members: Int = 0,
    val role: String = "active",
)

@Serializable
data class OweGroupList(val groups: List<OweGroupDto> = emptyList())

@Serializable
data class OweMemberDto(
    val id: String,
    @SerialName("display_name") val displayName: String,
    val state: String = "active",
    @SerialName("user_id") val userId: String? = null,
    val kind: String = "user",
    val blocked: Boolean = false,
)

@Serializable
data class OweGroupDetail(
    val group: OweGroupDto,
    val members: List<OweMemberDto> = emptyList(),
)

@Serializable
data class OweMovementDto(
    val id: String,
    val kind: String,
    val description: String,
    @SerialName("amount_minor") val amountMinor: Long,
    val currency: String,
    @SerialName("paid_by") val paidBy: String,
    @SerialName("occurred_on") val occurredOn: String,
    @SerialName("category_id") val categoryId: String? = null,
    val shares: List<OweShareDto> = emptyList(),
)

@Serializable
data class OweShareDto(
    val memberId: String,
    @SerialName("amount_minor") val amountMinor: Long,
)

@Serializable
data class OweMovementList(val movements: List<OweMovementDto> = emptyList())

@Serializable
data class OweBalanceDto(
    @SerialName("member_id") val memberId: String,
    @SerialName("display_name") val displayName: String,
    @SerialName("amount_minor") val amountMinor: Long,
)

@Serializable
data class OweBalanceList(val balances: List<OweBalanceDto> = emptyList())

@Serializable
data class OweTransferDto(
    val from: String,
    val to: String,
    @SerialName("amount_minor") val amountMinor: Long,
)

@Serializable
data class OweSettlementDto(
    val exact: Boolean = true,
    val transfers: List<OweTransferDto> = emptyList(),
)

@Serializable
data class OweCreateGroupBody(val name: String, val currency: String)

@Serializable
data class OweCreateMovementBody(
    val kind: String,
    val description: String,
    @SerialName("amount_minor") val amountMinor: Long,
    @SerialName("occurred_on") val occurredOn: String,
    @SerialName("paid_by") val paidBy: String,
    @SerialName("category_id") val categoryId: String? = null,
    val participants: List<OweParticipantBody>,
)

@Serializable
data class OweParticipantBody(
    @SerialName("member_id") val memberId: String,
    @SerialName("amount_minor") val amountMinor: Long? = null,
)

@Serializable
data class OweGroupResponse(val group: OweGroupDto)

@Serializable
data class OweMovementResponse(val movement: OweMovementDto)

@Serializable
data class OweIdentityDto(
    val id: String,
    @SerialName("display_name") val displayName: String,
)

@Serializable
data class OweIdentityList(val identities: List<OweIdentityDto> = emptyList())

@Serializable
data class OweAddMemberBody(
    @SerialName("display_name") val displayName: String,
    @SerialName("invitee_id") val inviteeId: String? = null,
    val active: Boolean? = null,
)

@Serializable
data class OweMemberResponse(val member: OweMemberDto)

@Serializable
data class OweImportErrorDto(val line: Int = 0, val message: String = "")

@Serializable
data class OweImportSampleDto(
    val line: Int = 0,
    @SerialName("occurred_on") val occurredOn: String = "",
    val description: String = "",
    @SerialName("amount_minor") val amountMinor: Long = 0,
    val kind: String = "expense",
    val payer: String = "",
    val derived: Boolean = false,
    val duplicate: Boolean = false,
)

@Serializable
data class OweImportPreviewDto(
    val movements: Int = 0,
    val payments: Int = 0,
    val derived: Int = 0,
    val skipped: Int = 0,
    val errors: List<OweImportErrorDto> = emptyList(),
    val currencies: List<String> = emptyList(),
    val unresolved: List<String> = emptyList(),
    val duplicates: Int = 0,
    val sample: List<OweImportSampleDto> = emptyList(),
)

@Serializable
data class OweImportResultDto(
    val created: Int = 0,
    @SerialName("skipped_duplicates") val skippedDuplicates: Int = 0,
    val errors: Int = 0,
    val categories: Int = 0,
)

@Serializable
data class OweImportPreviewBody(val csv: String)

@Serializable
data class OweImportCommitBody(
    val csv: String,
    val mapping: Map<String, String>? = null,
    @SerialName("confirm_duplicates") val confirmDuplicates: Boolean? = null,
)

@Serializable
data class OweCategoryDto(val id: String, val name: String)

@Serializable
data class OweCategoryList(val categories: List<OweCategoryDto> = emptyList())
