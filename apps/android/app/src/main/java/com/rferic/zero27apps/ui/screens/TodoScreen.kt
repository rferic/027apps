package com.rferic.zero27apps.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rferic.zero27apps.data.ApiClient
import com.rferic.zero27apps.data.ApiException
import com.rferic.zero27apps.data.TodoBoardDto
import com.rferic.zero27apps.data.TodoCandidateDto
import com.rferic.zero27apps.data.TodoCategoryDto
import com.rferic.zero27apps.data.TodoCreateTaskBody
import com.rferic.zero27apps.data.TodoGroupDto
import com.rferic.zero27apps.data.TodoMemberDto
import com.rferic.zero27apps.data.TodoRequestDto
import com.rferic.zero27apps.data.TodoSeasonDto
import com.rferic.zero27apps.data.TodoTaskDetailResponse
import com.rferic.zero27apps.data.TodoTaskDto
import com.rferic.zero27apps.data.TodoUpdateGroupBody
import com.rferic.zero27apps.data.TodoUpdateTaskBody
import com.rferic.zero27apps.ui.i18n.LocalStrings
import com.rferic.zero27apps.ui.theme.LocalPalette
import kotlinx.coroutines.launch

/** Which part of the module is on screen; back walks up this stack. */
private enum class TodoPane { GROUPS, GROUP, REQUESTS, POWER, SEASON }

/** The new-task dialog: `group` is fixed inside a group, chosen from the "+" otherwise. */
data class TodoTaskFormTarget(val group: TodoGroupDto?)

/**
 * NotNow in the app: groups of post-its, the personal group, requests to take a
 * task and the power season.
 *
 * The rules live in the module's API: this screen only asks for the next action
 * and shows what comes back. A task is pending or done, free or held, and only
 * its holder completes it.
 */
@Composable
fun TodoScreen(
    api: ApiClient,
    userId: String?,
    isAdmin: Boolean,
    onBack: () -> Unit,
    startAction: String? = null,
    onStartConsumed: () -> Unit = {},
    initialGroupId: String? = null,
    onInitialGroupConsumed: () -> Unit = {},
) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    val scope = rememberCoroutineScope()

    var pane by remember { mutableStateOf(TodoPane.GROUPS) }
    var groups by remember { mutableStateOf<List<TodoGroupDto>>(emptyList()) }
    var open by remember { mutableStateOf<TodoGroupDto?>(null) }
    var tasks by remember { mutableStateOf<List<TodoTaskDto>>(emptyList()) }
    var members by remember { mutableStateOf<List<TodoMemberDto>>(emptyList()) }
    var candidates by remember { mutableStateOf<List<TodoCandidateDto>>(emptyList()) }
    var candidatesDenied by remember { mutableStateOf(false) }
    var categories by remember { mutableStateOf<List<TodoCategoryDto>>(emptyList()) }
    var board by remember { mutableStateOf<TodoBoardDto?>(null) }
    var seasons by remember { mutableStateOf<List<TodoSeasonDto>>(emptyList()) }
    var archived by remember { mutableStateOf<TodoSeasonDto?>(null) }
    var requests by remember { mutableStateOf<List<TodoRequestDto>>(emptyList()) }
    var requestTab by remember { mutableStateOf("incoming") }
    var detail by remember { mutableStateOf<TodoTaskDetailResponse?>(null) }
    var taskForm by remember { mutableStateOf<TodoTaskFormTarget?>(null) }
    var groupForm by remember { mutableStateOf(false) }
    var editingGroup by remember { mutableStateOf<TodoGroupDto?>(null) }
    var settingsOpen by remember { mutableStateOf(false) }
    var onlyDone by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    fun fail(cause: Throwable) {
        error = when (cause) {
            is ApiException -> cause.message ?: cause.code
            else -> strings.tryAgain
        }
    }

    fun loadGroups() {
        scope.launch {
            busy = true
            try {
                groups = api.todoGroups()
                categories = runCatching { api.todoCategories() }.getOrDefault(emptyList())
            } catch (cause: Throwable) {
                fail(cause)
            } finally {
                busy = false
            }
        }
    }

    fun refreshGroup(group: TodoGroupDto? = open) {
        val current = group ?: return
        scope.launch {
            try {
                tasks = api.todoTasks(current.id)
                members = runCatching { api.todoMembers(current.id) }.getOrDefault(members)
                board = if (current.powerEnabled) runCatching { api.todoBoard(current.id) }.getOrNull() else null
                val refreshed = runCatching { api.todoGroups() }.getOrNull()
                if (refreshed != null) {
                    groups = refreshed
                    open = refreshed.firstOrNull { it.id == current.id } ?: current
                }
            } catch (cause: Throwable) {
                fail(cause)
            }
        }
    }

    fun openGroup(group: TodoGroupDto) {
        open = group
        pane = TodoPane.GROUP
        onlyDone = false
        scope.launch {
            busy = true
            try {
                tasks = api.todoTasks(group.id)
                members = runCatching { api.todoMembers(group.id) }.getOrDefault(emptyList())
                board = if (group.powerEnabled) runCatching { api.todoBoard(group.id) }.getOrNull() else null
            } catch (cause: Throwable) {
                fail(cause)
            } finally {
                busy = false
            }
        }
    }

    fun openTask(id: String) {
        scope.launch {
            try {
                detail = api.todoTask(id)
            } catch (cause: Throwable) {
                fail(cause)
            }
        }
    }

    fun openRequests(direction: String) {
        requestTab = direction
        pane = TodoPane.REQUESTS
        scope.launch {
            try {
                requests = api.todoRequests(direction)
            } catch (cause: Throwable) {
                fail(cause)
            }
        }
    }

    fun openPower() {
        val group = open ?: return
        pane = TodoPane.POWER
        scope.launch {
            try {
                board = api.todoBoard(group.id)
                seasons = runCatching { api.todoSeasons(group.id) }.getOrDefault(emptyList())
            } catch (cause: Throwable) {
                fail(cause)
            }
        }
    }

    fun loadCandidates() {
        if (candidates.isNotEmpty() || candidatesDenied) return
        scope.launch {
            try {
                candidates = api.todoCandidates()
            } catch (cause: Throwable) {
                if (cause is ApiException && cause.status == 403) candidatesDenied = true else fail(cause)
            }
        }
    }

    LaunchedEffect(api) { loadGroups() }
    LaunchedEffect(initialGroupId) {
        val id = initialGroupId ?: return@LaunchedEffect
        val group = groups.firstOrNull { it.id == id }
        if (group != null) openGroup(group)
        onInitialGroupConsumed()
    }
    LaunchedEffect(startAction) {
        if (startAction == "new_task") {
            taskForm = TodoTaskFormTarget(open)
            onStartConsumed()
        }
    }

    val inDetail = detail != null
    val inAnyDialog = taskForm != null || groupForm || editingGroup != null || settingsOpen
    BackHandler(enabled = pane != TodoPane.GROUPS || inDetail || inAnyDialog) {
        when {
            taskForm != null -> taskForm = null
            groupForm -> groupForm = false
            editingGroup != null -> editingGroup = null
            settingsOpen -> settingsOpen = false
            inDetail -> detail = null
            pane == TodoPane.SEASON -> pane = TodoPane.POWER
            pane != TodoPane.GROUPS -> pane = TodoPane.GROUPS
        }
    }

    Box(Modifier.fillMaxSize().background(palette.background)) {
        Column(Modifier.fillMaxSize()) {
            TodoHeader(
                title = when (pane) {
                    TodoPane.GROUPS -> "NotNow"
                    TodoPane.GROUP -> open?.name ?: "NotNow"
                    TodoPane.REQUESTS -> strings.todoRequests
                    TodoPane.POWER -> "${strings.todoPower} · ${open?.name ?: ""}"
                    TodoPane.SEASON -> "${strings.todoResults} · ${archived?.number ?: ""}"
                },
                onBack = {
                    when {
                        pane == TodoPane.SEASON -> pane = TodoPane.POWER
                        pane != TodoPane.GROUPS -> pane = TodoPane.GROUPS
                        else -> onBack()
                    }
                },
                trailing = when {
                    pane == TodoPane.GROUP -> strings.todoRequests to { openRequests("incoming") }
                    pane == TodoPane.GROUPS -> null
                    else -> null
                },
                onSettings = if (pane == TodoPane.GROUP && open?.personal == false) {
                    {
                        settingsOpen = true
                        loadCandidates()
                    }
                } else null,
            )

            when (pane) {
                TodoPane.GROUPS -> TodoModulePane(
                    groups = groups,
                    busy = busy,
                    onOpen = ::openGroup,
                    onRequests = { openRequests("incoming") },
                    onNewGroup = { groupForm = true },
                )

                TodoPane.GROUP -> TodoGroupPane(
                    group = open,
                    tasks = tasks,
                    onlyDone = onlyDone,
                    userId = userId,
                    onToggleDone = { onlyDone = !onlyDone },
                    onNewTask = { taskForm = TodoTaskFormTarget(open) },
                    onPower = ::openPower,
                    onOpenTask = ::openTask,
                    onClaim = { task ->
                        scope.launch {
                            try { api.todoClaim(task.id); refreshGroup() } catch (cause: Throwable) { fail(cause) }
                        }
                    },
                    onRelease = { task ->
                        scope.launch {
                            try { api.todoRelease(task.id); refreshGroup() } catch (cause: Throwable) { fail(cause) }
                        }
                    },
                    onComplete = { task ->
                        scope.launch {
                            try { api.todoComplete(task.id); refreshGroup() } catch (cause: Throwable) { fail(cause) }
                        }
                    },
                    onRequest = { task ->
                        scope.launch {
                            try { api.todoRequest(task.id); refreshGroup() } catch (cause: Throwable) { fail(cause) }
                        }
                    },
                )

                TodoPane.REQUESTS -> TodoRequestsPane(
                    requests = requests,
                    tab = requestTab,
                    onTab = ::openRequests,
                    onAccept = { request ->
                        scope.launch {
                            try {
                                api.todoAcceptRequest(request.id)
                                requests = api.todoRequests(requestTab)
                                refreshGroup()
                            } catch (cause: Throwable) {
                                fail(cause)
                            }
                        }
                    },
                    onDeny = { request ->
                        scope.launch {
                            try {
                                api.todoDenyRequest(request.id)
                                requests = api.todoRequests(requestTab)
                            } catch (cause: Throwable) {
                                fail(cause)
                            }
                        }
                    },
                )

                TodoPane.POWER -> TodoPowerPane(
                    group = open,
                    board = board,
                    seasons = seasons,
                    isOwner = open?.ownerId != null && open?.ownerId == userId,
                    onCloseSeason = {
                        val group = open ?: return@TodoPowerPane
                        scope.launch {
                            try {
                                api.todoCloseSeason(group.id)
                                board = api.todoBoard(group.id)
                                seasons = api.todoSeasons(group.id)
                                groups = api.todoGroups()
                            } catch (cause: Throwable) {
                                fail(cause)
                            }
                        }
                    },
                    onOpenSeason = { number ->
                        val group = open ?: return@TodoPowerPane
                        scope.launch {
                            try {
                                archived = api.todoSeason(group.id, number)
                                pane = TodoPane.SEASON
                            } catch (cause: Throwable) {
                                fail(cause)
                            }
                        }
                    },
                )

                TodoPane.SEASON -> TodoSeasonPane(season = archived)
            }
        }

        taskForm?.let { target ->
            TodoTaskFormDialog(
                groups = groups,
                categories = categories,
                target = target,
                members = if (target.group?.id == open?.id) members else emptyList(),
                userId = userId,
                onDismiss = { taskForm = null },
                onCreate = { groupId, body ->
                    scope.launch {
                        try {
                            api.todoCreateTask(groupId, body)
                            taskForm = null
                            val group = groups.firstOrNull { it.id == groupId }
                            if (group != null) {
                                if (open?.id == group.id) refreshGroup() else openGroup(group)
                            }
                        } catch (cause: Throwable) {
                            fail(cause)
                        }
                    }
                },
            )
        }

        if (groupForm) {
            TodoGroupFormDialog(
                onDismiss = { groupForm = false },
                onSave = { name, power, period ->
                    scope.launch {
                        try {
                            val group = api.todoCreateGroup(name, power, period)
                            groupForm = false
                            groups = api.todoGroups()
                            openGroup(group)
                        } catch (cause: Throwable) {
                            fail(cause)
                        }
                    }
                },
            )
        }

        editingGroup?.let { group ->
            TodoGroupFormDialog(
                existing = group,
                onDismiss = { editingGroup = null },
                onSave = { name, power, period ->
                    scope.launch {
                        try {
                            val updated = api.todoUpdateGroup(
                                group.id,
                                TodoUpdateGroupBody(name = name, powerEnabled = power, powerPeriod = period),
                            )
                            editingGroup = null
                            open = updated
                            groups = api.todoGroups()
                        } catch (cause: Throwable) {
                            fail(cause)
                        }
                    }
                },
            )
        }

        if (settingsOpen && open != null) {
            TodoGroupSettingsDialog(
                group = open!!,
                members = members,
                candidates = candidates,
                candidatesDenied = candidatesDenied,
                canPick = isAdmin && !candidatesDenied,
                isOwner = open?.ownerId != null && open?.ownerId == userId,
                onDismiss = { settingsOpen = false },
                onLoadCandidates = ::loadCandidates,
                onAddMember = { memberId ->
                    scope.launch {
                        try {
                            members = api.todoAddMember(open!!.id, memberId)
                        } catch (cause: Throwable) {
                            fail(cause)
                        }
                    }
                },
                onRemoveMember = { memberId ->
                    scope.launch {
                        try {
                            members = api.todoRemoveMember(open!!.id, memberId)
                            refreshGroup()
                        } catch (cause: Throwable) {
                            fail(cause)
                        }
                    }
                },
                onEdit = { editingGroup = open },
                onDelete = {
                    scope.launch {
                        try {
                            api.todoDeleteGroup(open!!.id)
                            settingsOpen = false
                            open = null
                            detail = null
                            pane = TodoPane.GROUPS
                            groups = api.todoGroups()
                        } catch (cause: Throwable) {
                            fail(cause)
                        }
                    }
                },
            )
        }

        detail?.let { current ->
            TodoTaskDetailSheet(
                detail = current,
                userId = userId,
                canEdit = current.task?.let { it.assigneeId == null || it.assigneeId == userId } == true,
                categories = categories,
                powerEnabled = open?.powerEnabled == true,
                onDismiss = {
                    detail = null
                    refreshGroup()
                },
                onSave = { body ->
                    scope.launch {
                        try {
                            api.todoUpdateTask(current.task!!.id, body)
                            openTask(current.task!!.id)
                            refreshGroup()
                        } catch (cause: Throwable) {
                            fail(cause)
                        }
                    }
                },
                onClaim = {
                    scope.launch {
                        try {
                            api.todoClaim(current.task!!.id)
                            openTask(current.task!!.id)
                            refreshGroup()
                        } catch (cause: Throwable) {
                            fail(cause)
                        }
                    }
                },
                onRelease = {
                    scope.launch {
                        try {
                            api.todoRelease(current.task!!.id)
                            openTask(current.task!!.id)
                            refreshGroup()
                        } catch (cause: Throwable) {
                            fail(cause)
                        }
                    }
                },
                onComplete = {
                    scope.launch {
                        try {
                            api.todoComplete(current.task!!.id)
                            openTask(current.task!!.id)
                            refreshGroup()
                        } catch (cause: Throwable) {
                            fail(cause)
                        }
                    }
                },
                onReopen = {
                    scope.launch {
                        try {
                            api.todoReopen(current.task!!.id)
                            openTask(current.task!!.id)
                            refreshGroup()
                        } catch (cause: Throwable) {
                            fail(cause)
                        }
                    }
                },
                onRequest = {
                    scope.launch {
                        try {
                            api.todoRequest(current.task!!.id)
                            refreshGroup()
                        } catch (cause: Throwable) {
                            fail(cause)
                        }
                    }
                },
                onDelete = {
                    scope.launch {
                        try {
                            api.todoDeleteTask(current.task!!.id)
                            detail = null
                            refreshGroup()
                        } catch (cause: Throwable) {
                            fail(cause)
                        }
                    }
                },
            )
        }

        error?.let { message ->
            AlertDialog(
                onDismissRequest = { error = null },
                confirmButton = { TextButton(onClick = { error = null }) { Text(strings.close) } },
                text = { Text(message) },
            )
        }
    }
}

@Composable
private fun TodoHeader(
    title: String,
    onBack: () -> Unit,
    trailing: Pair<String, () -> Unit>?,
    onSettings: (() -> Unit)?,
) {
    val palette = LocalPalette.current
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            "‹",
            fontSize = 26.sp,
            color = palette.mutedForeground,
            modifier = Modifier.clickable(onClick = onBack),
        )
        Text(
            title,
            fontSize = 19.sp,
            fontWeight = FontWeight.SemiBold,
            color = palette.foreground,
            modifier = Modifier.padding(start = 10.dp).weight(1f),
        )
        trailing?.let { (label, action) ->
            TextButton(onClick = action) { Text(label, color = palette.accent, fontSize = 12.sp) }
        }
        onSettings?.let { action ->
            TextButton(onClick = action) { Text("⚙", color = palette.mutedForeground, fontSize = 15.sp) }
        }
    }
}
