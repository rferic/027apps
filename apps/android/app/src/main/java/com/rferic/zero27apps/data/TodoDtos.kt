package com.rferic.zero27apps.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * NotNow (the `todo` module). A group holds post-its; each user also has a
 * personal group with one member. A task is pending or done and has one holder
 * or none: free tasks are taken, held ones are completed by their holder only.
 */

@Serializable
data class TodoGroupDto(
    val id: String,
    val name: String,
    val kind: String = "group",
    @SerialName("ownerId") val ownerId: String? = null,
    val timezone: String = "Europe/Madrid",
    val powerEnabled: Boolean = false,
    val powerPeriod: String = "infinite",
    val seasonNumber: Int = 1,
    val seasonStartedOn: String = "",
    val memberCount: Int = 0,
    val pendingCount: Int = 0,
) {
    val personal: Boolean get() = kind == "personal"
}

@Serializable
data class TodoGroupsResponse(val groups: List<TodoGroupDto> = emptyList())

@Serializable
data class TodoGroupResponse(val group: TodoGroupDto? = null)

@Serializable
data class TodoMemberDto(
    val userId: String,
    val displayName: String = "",
    val role: String = "member",
)

@Serializable
data class TodoMembersResponse(val members: List<TodoMemberDto> = emptyList())

@Serializable
data class TodoTaskDto(
    val id: String,
    val groupId: String,
    val title: String,
    val notes: String? = null,
    val categoryId: String? = null,
    val power: Int? = null,
    val assigneeId: String? = null,
    val assigneeName: String = "",
    val state: String = "pending",
    val recurrence: String = "none",
    val keepAssignee: Boolean = false,
    val dueOn: String? = null,
    val periodStart: String? = null,
    val periodEnd: String? = null,
    val completedAt: String? = null,
) {
    val done: Boolean get() = state == "done"
    val free: Boolean get() = assigneeId == null
    val periodic: Boolean get() = recurrence != "none"
}

@Serializable
data class TodoTasksResponse(
    val tasks: List<TodoTaskDto> = emptyList(),
    val nextCursor: String? = null,
)

@Serializable
data class TodoTaskResponse(val task: TodoTaskDto? = null)

/** One period of a recurring task, or the day a one-off was done. */
@Serializable
data class TodoOccurrenceDto(
    val id: String,
    val periodStart: String = "",
    val periodEnd: String = "",
    val outcome: String = "missed",
    val completedAt: String? = null,
    val completedByName: String = "",
)

@Serializable
data class TodoTaskDetailResponse(
    val task: TodoTaskDto? = null,
    val occurrences: List<TodoOccurrenceDto> = emptyList(),
)

@Serializable
data class TodoCategoryDto(
    val id: String,
    val name: String,
    val emoji: String = "📌",
    val color: String = "slate",
    val sortOrder: Int = 0,
)

@Serializable
data class TodoCategoriesResponse(val categories: List<TodoCategoryDto> = emptyList())

@Serializable
data class TodoRequestDto(
    val id: String,
    val groupId: String,
    val taskId: String,
    val requesterId: String? = null,
    val state: String = "pending",
    val createdAt: String = "",
    val expiresAt: String = "",
    val resolvedAt: String? = null,
    val taskTitle: String = "",
    val groupName: String = "",
    val requesterName: String = "",
)

@Serializable
data class TodoRequestsResponse(val requests: List<TodoRequestDto> = emptyList())

@Serializable
data class TodoRequestResponse(val request: TodoRequestDto? = null)

@Serializable
data class TodoPowerRow(
    val userId: String? = null,
    val displayName: String = "",
    val points: Int = 0,
    val tasksDone: Int = 0,
    val position: Int = 0,
)

@Serializable
data class TodoBoardDto(
    val seasonNumber: Int = 1,
    val period: String = "infinite",
    val startedOn: String = "",
    val rows: List<TodoPowerRow> = emptyList(),
)

@Serializable
data class TodoBoardResponse(val board: TodoBoardDto? = null)

@Serializable
data class TodoSeasonDto(
    val number: Int,
    val period: String = "infinite",
    val startedOn: String = "",
    val closedOn: String? = null,
    val rows: List<TodoPowerRow> = emptyList(),
)

@Serializable
data class TodoSeasonsResponse(val seasons: List<TodoSeasonDto> = emptyList())

@Serializable
data class TodoSeasonResponse(val season: TodoSeasonDto? = null)

/** Bodies the app sends; the server validates them again with zod. */
@Serializable
data class TodoCreateTaskBody(
    val title: String,
    val notes: String? = null,
    @SerialName("category_id") val categoryId: String? = null,
    val power: Int? = null,
    @SerialName("assignee_id") val assigneeId: String? = null,
    @SerialName("due_on") val dueOn: String? = null,
    val recurrence: String = "none",
    @SerialName("keep_assignee") val keepAssignee: Boolean = false,
)

@Serializable
data class TodoUpdateTaskBody(
    val title: String? = null,
    val notes: String? = null,
    @SerialName("category_id") val categoryId: String? = null,
    val power: Int? = null,
    @SerialName("due_on") val dueOn: String? = null,
)

@Serializable
data class TodoCreateGroupBody(
    val name: String,
    val timezone: String? = null,
    @SerialName("power_enabled") val powerEnabled: Boolean? = null,
    @SerialName("power_period") val powerPeriod: String? = null,
)

@Serializable
data class TodoUpdateGroupBody(
    val name: String? = null,
    val timezone: String? = null,
    @SerialName("power_enabled") val powerEnabled: Boolean? = null,
    @SerialName("power_period") val powerPeriod: String? = null,
)

@Serializable
data class TodoAddMemberBody(@SerialName("user_id") val userId: String)

/** The Core's user list, used to pick somebody to add to a group. */
@Serializable
data class TodoCandidateDto(
    val id: String,
    @SerialName("display_name") val displayName: String = "",
    val role: String = "user",
)

@Serializable
data class TodoCandidatesResponse(val users: List<TodoCandidateDto> = emptyList())
