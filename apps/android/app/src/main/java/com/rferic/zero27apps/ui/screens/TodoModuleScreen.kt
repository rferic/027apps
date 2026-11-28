package com.rferic.zero27apps.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rferic.zero27apps.data.TodoGroupDto
import com.rferic.zero27apps.ui.components.EmojiPicker
import com.rferic.zero27apps.ui.i18n.LocalStrings
import com.rferic.zero27apps.ui.theme.LocalPalette

/** The module's front door (spec §10): my groups, the personal one on top. */
@Composable
fun TodoModulePane(
    groups: List<TodoGroupDto>,
    busy: Boolean,
    onOpen: (TodoGroupDto) -> Unit,
    onRequests: () -> Unit,
    onNewGroup: () -> Unit,
) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    LazyColumn(
        Modifier.fillMaxSize().padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
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
                        else "${memberLabel(group.memberCount, strings.todoMemberCountOne, strings.todoMemberCount)}" +
                            " · ${group.pendingCount} ${strings.todoPending.lowercase()}",
                        color = palette.mutedForeground,
                        fontSize = 12.sp,
                    )
                }
                if (group.powerEnabled) Text("⚡", fontSize = 14.sp)
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Button(onClick = onNewGroup, modifier = Modifier.weight(1f)) { Text(strings.todoNewGroup) }
                TextButton(onClick = onRequests) { Text(strings.todoRequests, color = palette.accent) }
            }
        }
    }
}

private fun memberLabel(count: Int, one: String, many: String): String =
    (if (count == 1) one else many).replace("{count}", count.toString())

/** New or renamed group: emoji inside the name, power off by default. */
@Composable
fun TodoGroupFormDialog(
    existing: TodoGroupDto? = null,
    onDismiss: () -> Unit,
    onSave: (name: String, powerEnabled: Boolean?, powerPeriod: String?) -> Unit,
) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    var name by remember { mutableStateOf(TextFieldValue(existing?.name ?: "")) }
    var power by remember { mutableStateOf(existing?.powerEnabled ?: false) }
    var period by remember { mutableStateOf(existing?.powerPeriod ?: "infinite") }


    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(
                enabled = name.text.isNotBlank(),
                onClick = {
                    onSave(
                        name.text.trim(),
                        if (power) true else false,
                        if (power) period else "infinite",
                    )
                },
            ) { Text(strings.save) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(strings.cancel) } },
        title = { Text(if (existing == null) strings.todoNewGroup else strings.todoSettings) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text(strings.todoGroupName) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions.Default,
                )
                EmojiPicker { emoji -> name = insertAtSelection(name, emoji) }
                if (existing?.personal != true) {
                    TodoSectionLabel(strings.todoPower)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TodoPill(strings.todoNoPower, !power) { power = false }
                        TodoPill("⚡", power) { power = true }
                    }
                    if (power) {
                        TodoSectionLabel(strings.todoPeriod)
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            listOf(
                                "infinite" to strings.todoInfinite,
                                "weekly" to strings.todoWeekly,
                                "monthly" to strings.todoMonthly,
                                "yearly" to strings.todoYearly,
                            ).forEach { (value, label) ->
                                TodoPill(label, period == value) { period = value }
                            }
                        }
                    }
                }
                if (existing?.personal == true) {
                    Text(strings.todoPersonal, color = palette.mutedForeground, fontSize = 11.sp)
                }
            }
        },
    )
}
