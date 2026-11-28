package com.rferic.zero27apps.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rferic.zero27apps.data.TodoCategoryDto
import com.rferic.zero27apps.data.TodoCreateTaskBody
import com.rferic.zero27apps.data.TodoGroupDto
import com.rferic.zero27apps.data.TodoMemberDto
import com.rferic.zero27apps.data.TodoTaskDetailResponse
import com.rferic.zero27apps.data.TodoTaskDto
import com.rferic.zero27apps.data.TodoUpdateTaskBody
import com.rferic.zero27apps.ui.components.EmojiPicker
import com.rferic.zero27apps.ui.i18n.LocalStrings
import com.rferic.zero27apps.ui.theme.LocalPalette

/** New task: the "+" of the module asks which group, the one inside it does not. */
@Composable
fun TodoTaskFormDialog(
    groups: List<TodoGroupDto>,
    categories: List<TodoCategoryDto>,
    target: TodoTaskFormTarget,
    members: List<TodoMemberDto>,
    userId: String?,
    onDismiss: () -> Unit,
    onCreate: (String, TodoCreateTaskBody) -> Unit,
) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    var title by remember { mutableStateOf(TextFieldValue("")) }
    var notes by remember { mutableStateOf("") }
    var category by remember { mutableStateOf<String?>(null) }
    var power by remember { mutableStateOf<Int?>(null) }
    var due by remember { mutableStateOf("") }
    var recurrence by remember { mutableStateOf("none") }
    var keepHolder by remember { mutableStateOf(false) }
    var assignee by remember { mutableStateOf<String?>(null) }
    // The last group used is the default (spec §10); inside a group it is fixed.
    var group by remember { mutableStateOf(target.group ?: groups.firstOrNull()) }
    val periodic = recurrence != "none"

    fun insert(emoji: String) {
        val text = title.text
        val start = title.selection.start.coerceIn(0, text.length)
        val end = title.selection.end.coerceIn(0, text.length)
        val next = text.replaceRange(start, end, emoji)
        title = TextFieldValue(next, TextRange(start + emoji.length))
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(
                enabled = title.text.isNotBlank() && group != null,
                onClick = {
                    val selected = group ?: return@TextButton
                    onCreate(
                        selected.id,
                        TodoCreateTaskBody(
                            title = title.text.trim(),
                            notes = notes.trim().ifBlank { null },
                            categoryId = category,
                            assigneeId = if (selected.id == target.group?.id) assignee else null,
                            power = if (selected.powerEnabled) power else null,
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
            Column(
                Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                if (target.group == null) {
                    TodoSectionLabel(strings.todoGroup)
                    groups.forEach { candidate ->
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .padding(vertical = 2.dp),
                        ) {
                            TodoPill(candidate.name, group?.id == candidate.id) { group = candidate }
                        }
                    }
                }
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text(strings.todoTitle) },
                    singleLine = true,
                )
                EmojiPicker(::insert)
                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text(strings.todoNotes) },
                )
                if (categories.isNotEmpty()) {
                    TodoSectionLabel(strings.todoCategory)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        categories.take(6).forEach { option ->
                            TodoPill(
                                label = "${option.emoji} ${option.name}",
                                selected = category == option.id,
                                onClick = { category = if (category == option.id) null else option.id },
                            )
                        }
                    }
                }
                // Inside a group the people are known: a task can start held.
                if (target.group != null && members.size > 1) {
                    TodoSectionLabel(strings.todoHeldBy.replace("{name}", "").trim())
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        TodoPill(strings.todoFree, assignee == null) { assignee = null }
                        members.forEach { member ->
                            val label = if (member.userId == userId) strings.todoMine else member.displayName
                            TodoPill(label, assignee == member.userId) { assignee = member.userId }
                        }
                    }
                }
                if (group?.powerEnabled == true) {
                    TodoSectionLabel(strings.todoPower)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        (1..5).forEach { value ->
                            TodoPill("$value ⚡", power == value) {
                                power = if (power == value) null else value
                            }
                        }
                    }
                }
                TodoSectionLabel(strings.todoRepeats)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf(
                        "none" to strings.todoNever,
                        "weekly" to strings.todoWeekly,
                        "monthly" to strings.todoMonthly,
                        "yearly" to strings.todoYearly,
                    ).forEach { (value, label) ->
                        TodoPill(label, recurrence == value) { recurrence = value }
                    }
                }
                if (periodic) {
                    TodoPill(strings.todoKeepHolder, keepHolder) { keepHolder = !keepHolder }
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

/**
 * The task, its owner actions, an edit form and the history of periods
 * (spec §10): the same sheet serves as detail and as the result page for one
 * task, because both answer the same question: whose is it and what happened.
 */
@Composable
fun TodoTaskDetailSheet(
    detail: TodoTaskDetailResponse,
    userId: String?,
    canEdit: Boolean,
    categories: List<TodoCategoryDto>,
    powerEnabled: Boolean,
    onDismiss: () -> Unit,
    onSave: (TodoUpdateTaskBody) -> Unit,
    onClaim: () -> Unit,
    onRelease: () -> Unit,
    onComplete: () -> Unit,
    onReopen: () -> Unit,
    onRequest: () -> Unit,
    onDelete: () -> Unit,
) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    val task: TodoTaskDto = detail.task ?: return
    var editing by remember { mutableStateOf(false) }
    var confirmingDelete by remember { mutableStateOf(false) }
    var title by remember(task.id) { mutableStateOf(TextFieldValue(task.title)) }
    var notes by remember(task.id) { mutableStateOf(task.notes ?: "") }
    var category by remember(task.id) { mutableStateOf(task.categoryId) }
    var power by remember(task.id) { mutableStateOf(task.power) }
    var due by remember(task.id) { mutableStateOf(task.dueOn ?: "") }

    fun insert(emoji: String) {
        val text = title.text
        val start = title.selection.start.coerceIn(0, text.length)
        val end = title.selection.end.coerceIn(0, text.length)
        val next = text.replaceRange(start, end, emoji)
        title = TextFieldValue(next, TextRange(start + emoji.length))
    }

    fun saveNow() {
        onSave(
            TodoUpdateTaskBody(
                title = title.text.trim(),
                notes = notes.trim().ifBlank { null },
                categoryId = category,
                power = if (powerEnabled) power else null,
                dueOn = if (task.periodic) null else due.trim().ifBlank { null },
            ),
        )
        editing = false
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(onClick = { if (editing) saveNow() else onDismiss() }) {
                Text(if (editing) strings.save else strings.close)
            }
        },
        dismissButton = if (canEdit && !task.done) {
            { TextButton(onClick = { editing = !editing }) { Text(if (editing) strings.cancel else strings.edit) } }
        } else {
            null
        },
        title = { Text(if (editing) strings.edit else task.title) },
        text = {
            Column(
                Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                if (editing) {
                    OutlinedTextField(
                        value = title,
                        onValueChange = { title = it },
                        label = { Text(strings.todoTitle) },
                        singleLine = true,
                    )
                    EmojiPicker(::insert)
                    OutlinedTextField(
                        value = notes,
                        onValueChange = { notes = it },
                        label = { Text(strings.todoNotes) },
                    )
                    if (categories.isNotEmpty()) {
                        TodoSectionLabel(strings.todoCategory)
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            categories.take(6).forEach { option ->
                                TodoPill("${option.emoji} ${option.name}", category == option.id) {
                                    category = if (category == option.id) null else option.id
                                }
                            }
                        }
                    }
                    if (powerEnabled) {
                        TodoSectionLabel(strings.todoPower)
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            (1..5).forEach { value ->
                                TodoPill("$value ⚡", power == value) {
                                    power = if (power == value) null else value
                                }
                            }
                        }
                    }
                    if (!task.periodic) {
                        OutlinedTextField(
                            value = due,
                            onValueChange = { due = it },
                            label = { Text(strings.todoDueDate) },
                            singleLine = true,
                        )
                    }
                } else {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        if (task.power != null) TodoTag("⚡ ${task.power}", palette.accent)
                        if (task.dueOn != null) TodoTag(task.dueOn!!, palette.mutedForeground)
                        if (task.periodic) {
                            TodoTag("↻ ${task.recurrence} · ${task.periodStart} → ${task.periodEnd}", palette.mutedForeground)
                        }
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
                    task.notes?.takeIf { it.isNotBlank() }?.let { text ->
                        Text(text, color = palette.foreground, fontSize = 13.sp)
                    }

                    Spacer(Modifier.height(2.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (task.done) {
                            if (task.assigneeId == userId) TodoAction(strings.todoReopen, onReopen)
                        } else {
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
                    if (!task.done) {
                        if (confirmingDelete) {
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text(strings.todoDeleteTaskConfirm, color = palette.destructive, fontSize = 11.5.sp)
                                TodoAction(strings.todoDelete) { onDelete() }
                                TodoAction(strings.cancel) { confirmingDelete = false }
                            }
                        } else {
                            TextButton(onClick = { confirmingDelete = true }) {
                                Text(strings.todoDelete, color = palette.destructive, fontSize = 12.sp)
                            }
                        }
                    }

                    TodoSectionLabel(strings.todoHistory)
                    if (detail.occurrences.isEmpty()) {
                        Text(strings.todoHistoryEmpty, color = palette.mutedForeground, fontSize = 11.5.sp)
                    }
                    detail.occurrences.take(12).forEach { occurrence ->
                        Row(Modifier.fillMaxWidth()) {
                            Text(
                                "${occurrence.periodStart} → ${occurrence.periodEnd}",
                                color = palette.mutedForeground,
                                fontSize = 11.sp,
                                modifier = Modifier.weight(1f),
                            )
                            TodoTag(
                                if (occurrence.outcome == "done") {
                                    "${strings.todoPeriodDone} · ${occurrence.completedByName}"
                                } else {
                                    strings.todoPeriodMissed
                                },
                                if (occurrence.outcome == "done") palette.accent else palette.destructive,
                            )
                        }
                    }
                }
            }
        },
    )
}
