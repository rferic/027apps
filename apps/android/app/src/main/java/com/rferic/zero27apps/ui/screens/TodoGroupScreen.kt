package com.rferic.zero27apps.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rferic.zero27apps.data.TodoCandidateDto
import com.rferic.zero27apps.data.TodoGroupDto
import com.rferic.zero27apps.data.TodoMemberDto
import com.rferic.zero27apps.data.TodoTaskDto
import com.rferic.zero27apps.ui.i18n.LocalStrings
import com.rferic.zero27apps.ui.theme.LocalPalette
import java.time.LocalDate

/** One group: pending and done, the post-its and the power entrance. */
@Composable
fun TodoGroupPane(
    group: TodoGroupDto?,
    tasks: List<TodoTaskDto>,
    onlyDone: Boolean,
    userId: String?,
    onToggleDone: () -> Unit,
    onNewTask: () -> Unit,
    onPower: () -> Unit,
    onOpenTask: (String) -> Unit,
    onClaim: (TodoTaskDto) -> Unit,
    onRelease: (TodoTaskDto) -> Unit,
    onComplete: (TodoTaskDto) -> Unit,
    onRequest: (TodoTaskDto) -> Unit,
) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    val visible = tasks.filter { if (onlyDone) it.done else !it.done }
    val today = LocalDate.now().toString()

    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            TodoPill(
                label = "${strings.todoPending} ${tasks.count { !it.done }}",
                selected = !onlyDone,
                onClick = { if (onlyDone) onToggleDone() },
            )
            TodoPill(
                label = "${strings.todoDone} ${tasks.count { it.done }}",
                selected = onlyDone,
                onClick = { if (!onlyDone) onToggleDone() },
            )
            if (group?.powerEnabled == true) {
                TodoPill(label = "⚡ ${strings.todoSeason}", selected = false, onClick = onPower)
            }
        }
        Spacer(Modifier.height(8.dp))
        LazyColumn(
            Modifier.weight(1f).padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            if (visible.isEmpty()) item {
                Text(
                    strings.todoEmpty,
                    color = palette.mutedForeground,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(8.dp),
                )
            }
            items(visible) { task ->
                TodoTaskCard(
                    task = task,
                    userId = userId,
                    overdue = !task.done && task.dueOn != null && task.dueOn < today,
                    onOpen = { onOpenTask(task.id) },
                    onClaim = { onClaim(task) },
                    onRelease = { onRelease(task) },
                    onComplete = { onComplete(task) },
                    onRequest = { onRequest(task) },
                )
            }
        }
        Button(
            onClick = onNewTask,
            modifier = Modifier.fillMaxWidth().padding(16.dp),
        ) { Text(strings.todoNewTask) }
    }
}

@Composable
private fun TodoTaskCard(
    task: TodoTaskDto,
    userId: String?,
    overdue: Boolean,
    onOpen: () -> Unit,
    onClaim: () -> Unit,
    onRelease: () -> Unit,
    onComplete: () -> Unit,
    onRequest: () -> Unit,
) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    Column(
        Modifier
            .fillMaxWidth()
            .background(palette.surface, RoundedCornerShape(14.dp))
            .border(1.dp, palette.border, RoundedCornerShape(14.dp))
            .clickable(onClick = onOpen)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(
            task.title,
            color = palette.foreground,
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            if (task.power != null) TodoTag("⚡ ${task.power}", palette.accent)
            if (task.dueOn != null) {
                TodoTag(task.dueOn!!, if (overdue) palette.destructive else palette.mutedForeground)
            }
            if (task.periodic) TodoTag("↻ ${task.recurrence}", palette.mutedForeground)
            TodoTag(
                when {
                    task.free -> strings.todoFree
                    task.assigneeId == userId -> strings.todoMine
                    task.assigneeName.isNotBlank() -> strings.todoHeldBy.replace("{name}", task.assigneeName)
                    else -> strings.todoGroup
                },
                palette.mutedForeground,
            )
        }
        if (!task.done) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (task.free) TodoAction(strings.todoTake, onClaim)
                if (task.assigneeId == userId) {
                    TodoAction(strings.todoComplete, onComplete)
                    TodoAction(strings.todoReleaseIt, onRelease)
                }
                if (!task.free && task.assigneeId != userId) {
                    TodoAction(strings.todoAskForIt, onRequest)
                }
            }
        }
    }
}

/** Owner controls (spec §10): members, the name, the power and the way out. */
@Composable
fun TodoGroupSettingsDialog(
    group: TodoGroupDto,
    members: List<TodoMemberDto>,
    candidates: List<TodoCandidateDto>,
    candidatesDenied: Boolean,
    canPick: Boolean,
    isOwner: Boolean,
    onDismiss: () -> Unit,
    onLoadCandidates: () -> Unit,
    onAddMember: (String) -> Unit,
    onRemoveMember: (String) -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    var adding by remember { mutableStateOf(false) }
    var confirmingDelete by remember { mutableStateOf(false) }
    val memberIds = members.map { it.userId }.toSet()
    val available = candidates.filter { it.id !in memberIds }

    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = { TextButton(onClick = onDismiss) { Text(strings.close) } },
        dismissButton = if (isOwner) {
            { TextButton(onClick = onEdit) { Text(strings.edit) } }
        } else {
            null
        },
        title = { Text(group.name) },
        text = {
            Column(
                Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                TodoSectionLabel(strings.todoPower)
                Text(
                    if (group.powerEnabled) "⚡ ${group.powerPeriod}" else strings.todoNoPower,
                    color = palette.foreground,
                    fontSize = 13.sp,
                )

                TodoSectionLabel(strings.todoMembers)
                members.forEach { member ->
                    Row(
                        Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            member.displayName.ifBlank { member.userId.take(8) },
                            color = palette.foreground,
                            fontSize = 13.sp,
                            modifier = Modifier.weight(1f),
                        )
                        if (member.role == "owner") {
                            TodoTag("★", palette.accent)
                        } else if (isOwner) {
                            TodoAction(strings.todoRemove) { onRemoveMember(member.userId) }
                        }
                    }
                }

                if (adding && isOwner) {
                    val shown = available.take(12)
                    if (shown.isEmpty()) {
                        Text(
                            if (canPick) strings.todoEmpty else strings.todoAddMemberAdminHint,
                            color = palette.mutedForeground,
                            fontSize = 11.5.sp,
                        )
                    }
                    shown.forEach { candidate ->
                        Row(
                            Modifier.fillMaxWidth().clickable {
                                onAddMember(candidate.id)
                                adding = false
                            }.padding(vertical = 5.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text("＋", color = palette.accent, fontSize = 13.sp)
                            Text(
                                candidate.displayName.ifBlank { candidate.id.take(8) },
                                color = palette.foreground,
                                fontSize = 13.sp,
                                modifier = Modifier.padding(start = 8.dp),
                            )
                        }
                    }
                } else if (isOwner) {
                    TextButton(onClick = {
                        adding = true
                        onLoadCandidates()
                    }) { Text(strings.todoAddMember, color = palette.accent, fontSize = 12.sp) }
                }

                if (isOwner) {
                    if (confirmingDelete) {
                        Text(strings.todoDeleteGroupConfirm, color = palette.destructive, fontSize = 12.sp)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            TodoAction(strings.todoDelete) { onDelete() }
                            TodoAction(strings.cancel) { confirmingDelete = false }
                        }
                    } else {
                        TextButton(onClick = { confirmingDelete = true }) {
                            Text(strings.todoDelete, color = palette.destructive, fontSize = 12.sp)
                        }
                    }
                }
                if (isOwner && !canPick) {
                    Text(strings.todoAddMemberAdminHint, color = palette.mutedForeground, fontSize = 10.5.sp)
                }

            }
        },
    )
}
