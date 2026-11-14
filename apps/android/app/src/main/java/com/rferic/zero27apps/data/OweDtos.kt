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
