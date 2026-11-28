package com.rferic.zero27apps.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
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
import com.rferic.zero27apps.data.TodoCategoryDto
import com.rferic.zero27apps.data.TodoCreateTaskBody
import com.rferic.zero27apps.data.TodoGroupDto
import com.rferic.zero27apps.data.TodoPowerRow
import com.rferic.zero27apps.data.TodoRequestDto
import com.rferic.zero27apps.data.TodoTaskDto
import com.rferic.zero27apps.ui.i18n.LocalStrings
import com.rferic.zero27apps.ui.theme.LocalPalette
import kotlinx.coroutines.launch

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
    onBack: () -> Unit,
    startAction: String? = null,
    onStartConsumed: () -> Unit = {},
    initialGroupId: String? = null,
    onInitialGroupConsumed: () -> Unit = {},
) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    val scope = rememberCoroutineScope()

    var groups by remember { mutableStateOf<List<TodoGroupDto>>(emptyList()) }
    var open by remember { mutableStateOf<TodoGroupDto?>(null) }
    var tasks by remember { mutableStateOf<List<TodoTaskDto>>(emptyList()) }
    var categories by remember { mutableStateOf<List<TodoCategoryDto>>(emptyList()) }
    var board by remember { mutableStateOf<TodoBoardDto?>(null) }
    var requests by remember { mutableStateOf<List<TodoRequestDto>>(emptyList()) }
    var showForm by remember { mutableStateOf(false) }
    var showRequests by remember { mutableStateOf(false) }
    var showPower by remember { mutableStateOf(false) }
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

    fun openGroup(group: TodoGroupDto) {
        open = group
        scope.launch {
            busy = true
            try {
                tasks = api.todoTasks(group.id)
                board = if (group.powerEnabled) runCatching { api.todoBoard(group.id) }.getOrNull() else null
            } catch (cause: Throwable) {
                fail(cause)
            } finally {
                busy = false
            }
        }
    }

    fun refreshOpen() {
        val group = open ?: return
        scope.launch {
            try {
                tasks = api.todoTasks(group.id)
                board = if (group.powerEnabled) runCatching { api.todoBoard(group.id) }.getOrNull() else null
                groups = api.todoGroups()
            } catch (cause: Throwable) {
                fail(cause)
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
            showForm = true
            onStartConsumed()
        }
    }

    BackHandler(enabled = open != null || showRequests || showPower) {
        when {
            showPower -> showPower = false
            showRequests -> showRequests = false
            open != null -> open = null
            else -> onBack()
        }
    }

    Box(Modifier.fillMaxSize().background(palette.background)) {
        Column(Modifier.fillMaxSize()) {
            // Header
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "‹",
                    fontSize = 26.sp,
                    color = palette.mutedForeground,
                    modifier = Modifier.clickable {
                        when {
                            showPower -> showPower = false
                            showRequests -> showRequests = false
                            open != null -> open = null
                            else -> onBack()
                        }
                    },
                )
                Text(
                    when {
                        showPower -> strings.todoResults
                        showRequests -> strings.todoRequests
                        else -> open?.name ?: "NotNow"
                    },
                    fontSize = 19.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = palette.foreground,
                    modifier = Modifier.padding(start = 10.dp).weight(1f),
                )
                if (open != null && !showPower && !showRequests) {
                    TextButton(onClick = {
                        scope.launch {
                            try {
                                requests = api.todoRequests("incoming")
                                showRequests = true
                            } catch (cause: Throwable) {
                                fail(cause)
                            }
                        }
                    }) {
                        Text(
                            if (requests.any { it.state == "pending" }) "${strings.todoRequests} ·" else strings.todoRequests,
                            color = palette.accent,
                            fontSize = 12.sp,
                        )
                    }
                }
            }

            when {
                showRequests -> RequestsPane(
                    requests = requests,
                    onAccept = { request ->
                        scope.launch {
                            try {
                                api.todoAcceptRequest(request.id)
                                requests = api.todoRequests("incoming")
                                refreshOpen()
                            } catch (cause: Throwable) {
                                fail(cause)
                            }
                        }
                    },
                    onDeny = { request ->
                        scope.launch {
                            try {
                                api.todoDenyRequest(request.id)
                                requests = api.todoRequests("incoming")
                            } catch (cause: Throwable) {
                                fail(cause)
                            }
                        }
                    },
                )

                showPower -> PowerPane(
                    board = board,
                    canClose = open?.ownerId != null && open?.ownerId == userId &&
                        open?.powerPeriod != "infinite",
                    onClose = {
                        val group = open ?: return@PowerPane
                        scope.launch {
                            try {
                                api.todoCloseSeason(group.id)
                                board = api.todoBoard(group.id)
                                groups = api.todoGroups()
                            } catch (cause: Throwable) {
                                fail(cause)
                            }
                        }
                    },
                )

                open == null -> GroupsPane(
                    groups = groups,
                    busy = busy,
                    onOpen = ::openGroup,
                    onNew = { showForm = true },
                )

                else -> GroupPane(
                    tasks = tasks,
                    onlyDone = onlyDone,
                    powerEnabled = open?.powerEnabled == true,
                    powerPeriod = open?.powerPeriod ?: "infinite",
                    userId = userId,
                    onToggleDone = { onlyDone = !onlyDone },
                    onNew = { showForm = true },
                    onPower = {
                        scope.launch {
                            try {
                                board = api.todoBoard(open!!.id)
                                showPower = true
                            } catch (cause: Throwable) {
                                fail(cause)
                            }
                        }
                    },
                    onClaim = { task ->
                        scope.launch {
                            try { api.todoClaim(task.id); refreshOpen() } catch (cause: Throwable) { fail(cause) }
                        }
                    },
                    onRelease = { task ->
                        scope.launch {
                            try { api.todoRelease(task.id); refreshOpen() } catch (cause: Throwable) { fail(cause) }
                        }
                    },
                    onComplete = { task ->
                        scope.launch {
                            try { api.todoComplete(task.id); refreshOpen() } catch (cause: Throwable) { fail(cause) }
                        }
                    },
                    onRequest = { task ->
                        scope.launch {
                            try { api.todoRequest(task.id); refreshOpen() } catch (cause: Throwable) { fail(cause) }
                        }
                    },
                )
            }
        }

        if (showForm) {
            TaskForm(
                groups = groups,
                categories = categories,
                fixedGroup = open,
                onDismiss = { showForm = false },
                onCreate = { groupId, body ->
                    scope.launch {
                        try {
                            api.todoCreateTask(groupId, body)
                            showForm = false
                            if (open?.id == groupId) refreshOpen() else {
                                groups = api.todoGroups()
                                groups.firstOrNull { it.id == groupId }?.let(::openGroup)
                            }
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
private fun GroupsPane(
    groups: List<TodoGroupDto>,
    busy: Boolean,
    onOpen: (TodoGroupDto) -> Unit,
    onNew: () -> Unit,
) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (busy && groups.isEmpty()) item { Text("…", color = palette.mutedForeground) }
        items(groups) { group ->
            Row(
                Modifier
                    .fillMaxWidth()
                    .background(palette.surface, RoundedCornerShape(16.dp))
                    .border(1.dp, palette.border, RoundedCornerShape(16.dp))
                    .clickable { onOpen(group) }
                    .padding(14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(if (group.personal) "🔒" else "📋", fontSize = 18.sp)
                Column(Modifier.weight(1f).padding(start = 10.dp)) {
                    Text(group.name, color = palette.foreground, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                    Text(
                        if (group.personal) strings.todoPersonal
                        else "${group.memberCount} · ${group.pendingCount} ${strings.todoPending.lowercase()}",
                        color = palette.mutedForeground,
                        fontSize = 12.sp,
                    )
                }
                if (group.powerEnabled) Text("⚡", fontSize = 14.sp)
            }
        }
        item {
            Button(
                onClick = onNew,
                modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
            ) { Text(strings.todoNewGroup) }
        }
    }
}

@Composable
private fun GroupPane(
    tasks: List<TodoTaskDto>,
    onlyDone: Boolean,
    powerEnabled: Boolean,
    powerPeriod: String,
    userId: String?,
    onToggleDone: () -> Unit,
    onNew: () -> Unit,
    onPower: () -> Unit,
    onClaim: (TodoTaskDto) -> Unit,
    onRelease: (TodoTaskDto) -> Unit,
    onComplete: (TodoTaskDto) -> Unit,
    onRequest: (TodoTaskDto) -> Unit,
) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    val visible = tasks.filter { if (onlyDone) it.done else !it.done }

    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Pill(
                label = "${strings.todoPending} ${tasks.count { !it.done }}",
                selected = !onlyDone,
                onClick = { if (onlyDone) onToggleDone() },
            )
            Pill(
                label = "${strings.todoDone} ${tasks.count { it.done }}",
                selected = onlyDone,
                onClick = { if (!onlyDone) onToggleDone() },
            )
            if (powerEnabled) {
                Pill(label = "⚡ ${strings.todoSeason} $powerPeriod", selected = false, onClick = onPower)
            }
        }
        Spacer(Modifier.height(8.dp))
        LazyColumn(
            Modifier.weight(1f).padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            if (visible.isEmpty()) item {
                Text(strings.todoEmpty, color = palette.mutedForeground, fontSize = 13.sp, modifier = Modifier.padding(8.dp))
            }
            items(visible) { task ->
                Column(
                    Modifier
                        .fillMaxWidth()
                        .background(palette.surface, RoundedCornerShape(14.dp))
                        .border(1.dp, palette.border, RoundedCornerShape(14.dp))
                        .padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Text(task.title, color = palette.foreground, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        if (task.power != null) Tag("⚡ ${task.power}", palette.accent)
                        if (task.dueOn != null) Tag(task.dueOn!!, palette.mutedForeground)
                        if (task.periodic) Tag("↻ ${task.recurrence}", palette.mutedForeground)
                        Tag(
                            if (task.free) strings.todoFree
                            else if (task.assigneeId == userId) strings.todoPersonal
                            else strings.todoGroup,
                            palette.mutedForeground,
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (!task.done && task.free) {
                            SmallAction(strings.todoTake) { onClaim(task) }
                        }
                        if (!task.done && task.assigneeId == userId) {
                            SmallAction(strings.todoComplete) { onComplete(task) }
                            SmallAction(strings.todoReleaseIt) { onRelease(task) }
                        }
                        if (!task.done && !task.free && task.assigneeId != userId) {
                            SmallAction(strings.todoAskForIt) { onRequest(task) }
                        }
                    }
                }
            }
        }
        Button(
            onClick = onNew,
            modifier = Modifier.fillMaxWidth().padding(16.dp),
        ) { Text(strings.todoNewTask) }
    }
}

@Composable
private fun Pill(label: String, selected: Boolean, onClick: () -> Unit) {
    val palette = LocalPalette.current
    Box(
        Modifier
            .background(if (selected) palette.accent else palette.surface, RoundedCornerShape(999.dp))
            .border(1.dp, palette.border, RoundedCornerShape(999.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 5.dp),
    ) {
        Text(
            label,
            color = if (selected) palette.accentForeground else palette.mutedForeground,
            fontSize = 11.5.sp,
            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
        )
    }
}

@Composable
private fun Tag(text: String, color: androidx.compose.ui.graphics.Color) {
    Text(text, color = color, fontSize = 10.5.sp)
}

@Composable
private fun SmallAction(label: String, onClick: () -> Unit) {
    val palette = LocalPalette.current
    Box(
        Modifier
            .background(palette.surface, RoundedCornerShape(9.dp))
            .border(1.dp, palette.border, RoundedCornerShape(9.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 9.dp, vertical = 5.dp),
    ) { Text(label, color = palette.accent, fontSize = 11.5.sp, fontWeight = FontWeight.Medium) }
}

@Composable
private fun RequestsPane(
    requests: List<TodoRequestDto>,
    onAccept: (TodoRequestDto) -> Unit,
    onDeny: (TodoRequestDto) -> Unit,
) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    val pending = requests.filter { it.state == "pending" }
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (pending.isEmpty()) item {
            Text(strings.todoEmpty, color = palette.mutedForeground, fontSize = 13.sp)
        }
        items(pending) { request ->
            Column(
                Modifier
                    .fillMaxWidth()
                    .background(palette.surface, RoundedCornerShape(14.dp))
                    .border(1.dp, palette.border, RoundedCornerShape(14.dp))
                    .padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text("↗ ${strings.todoRequests}", color = palette.foreground, fontSize = 13.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    SmallAction(strings.todoAccept) { onAccept(request) }
                    SmallAction(strings.todoDeny) { onDeny(request) }
                }
            }
        }
    }
}

@Composable
private fun PowerPane(board: TodoBoardDto?, canClose: Boolean, onClose: () -> Unit) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    Column(Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        Text(
            "${strings.todoSeason} ${board?.seasonNumber ?: 1} · ${board?.period ?: ""}",
            color = palette.mutedForeground,
            fontSize = 12.sp,
        )
        Spacer(Modifier.height(10.dp))
        val rows: List<TodoPowerRow> = board?.rows ?: emptyList()
        if (rows.isEmpty()) {
            Text(strings.todoEmpty, color = palette.mutedForeground, fontSize = 13.sp)
        }
        rows.forEach { row ->
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("${row.position}.", color = palette.mutedForeground, fontSize = 12.sp, modifier = Modifier.size(width = 24.dp, height = 18.dp))
                Text(row.displayName, color = palette.foreground, fontSize = 13.5.sp, modifier = Modifier.weight(1f))
                Text("${row.points} ⚡ · ${row.tasksDone} ${strings.todoTasksDone}", color = palette.mutedForeground, fontSize = 11.5.sp)
            }
        }
        Spacer(Modifier.height(16.dp))
        if (canClose) {
            Button(onClick = onClose, modifier = Modifier.fillMaxWidth()) { Text(strings.todoCloseSeason) }
            Text(strings.todoCloseSeasonHint, color = palette.mutedForeground, fontSize = 11.sp, modifier = Modifier.padding(top = 6.dp))
        }
    }
}

@Composable
private fun TaskForm(
    groups: List<TodoGroupDto>,
    categories: List<TodoCategoryDto>,
    fixedGroup: TodoGroupDto?,
    onDismiss: () -> Unit,
    onCreate: (String, TodoCreateTaskBody) -> Unit,
) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    var title by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var category by remember { mutableStateOf<String?>(null) }
    var power by remember { mutableStateOf<Int?>(null) }
    var due by remember { mutableStateOf("") }
    var recurrence by remember { mutableStateOf("none") }
    var keepHolder by remember { mutableStateOf(false) }
    var group by remember { mutableStateOf(fixedGroup ?: groups.firstOrNull()) }
    val periodic = recurrence != "none"

    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(
                enabled = title.isNotBlank() && group != null,
                onClick = {
                    val target = group ?: return@TextButton
                    onCreate(
                        target.id,
                        TodoCreateTaskBody(
                            title = title.trim(),
                            notes = notes.trim().ifBlank { null },
                            categoryId = category,
                            power = if (target.powerEnabled) power else null,
                            dueOn = if (periodic) null else due.trim().ifBlank { null },
                            recurrence = recurrence,
                            keepAssignee = keepHolder,
                        ),
                    )
                },
            ) { Text(strings.save) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(strings.cancel) } },
        title = { Text(strings.todoNewTask) },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (fixedGroup == null) {
                    Text(strings.todoGroup, color = palette.mutedForeground, fontSize = 11.sp)
                    groups.forEach { candidate ->
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .clickable { group = candidate }
                                .padding(vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(if (group?.id == candidate.id) "●" else "○", color = palette.accent)
                            Text(candidate.name, color = palette.foreground, fontSize = 13.sp, modifier = Modifier.padding(start = 6.dp))
                        }
                    }
                }
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text(strings.todoTitle) },
                    singleLine = true,
                )
                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text(strings.todoNotes) },
                )
                if (categories.isNotEmpty()) {
                    Text(strings.todoCategory, color = palette.mutedForeground, fontSize = 11.sp)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        categories.take(6).forEach { option ->
                            Pill(
                                label = "${option.emoji} ${option.name}",
                                selected = category == option.id,
                                onClick = { category = if (category == option.id) null else option.id },
                            )
                        }
                    }
                }
                if (group?.powerEnabled == true) {
                    Text(strings.todoPower, color = palette.mutedForeground, fontSize = 11.sp)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        (1..5).forEach { value ->
                            Pill(
                                label = "$value ⚡",
                                selected = power == value,
                                onClick = { power = if (power == value) null else value },
                            )
                        }
                    }
                }
                Text(strings.todoRepeats, color = palette.mutedForeground, fontSize = 11.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf(
                        "none" to strings.todoNever,
                        "weekly" to strings.todoWeekly,
                        "monthly" to strings.todoMonthly,
                        "yearly" to strings.todoYearly,
                    ).forEach { (value, label) ->
                        Pill(label = label, selected = recurrence == value, onClick = { recurrence = value })
                    }
                }
                if (periodic) {
                    Pill(
                        label = strings.todoKeepHolder,
                        selected = keepHolder,
                        onClick = { keepHolder = !keepHolder },
                    )
                } else {
                    OutlinedTextField(
                        value = due,
                        onValueChange = { due = it },
                        label = { Text(strings.todoDueDate) },
                        singleLine = true,
                    )
                }
            }
        },
    )
}
