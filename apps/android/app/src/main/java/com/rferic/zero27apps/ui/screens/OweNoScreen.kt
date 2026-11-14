package com.rferic.zero27apps.ui.screens

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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rferic.zero27apps.data.ApiClient
import com.rferic.zero27apps.data.OweBalanceDto
import com.rferic.zero27apps.data.OweCreateMovementBody
import com.rferic.zero27apps.data.OweGroupDetail
import com.rferic.zero27apps.data.OweGroupDto
import com.rferic.zero27apps.data.OweMemberDto
import com.rferic.zero27apps.data.OweMovementDto
import com.rferic.zero27apps.data.OweParticipantBody
import com.rferic.zero27apps.data.OweSettlementDto
import com.rferic.zero27apps.ui.i18n.LocalStrings
import com.rferic.zero27apps.ui.theme.LocalPalette
import java.time.LocalDate
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/** Money is integer minor units; the app only formats for display. */
internal fun formatMinor(amountMinor: Long, currency: String): String {
    val sign = if (amountMinor < 0) "-" else ""
    val absolute = kotlin.math.abs(amountMinor)
    return "$sign${absolute / 100}.${(absolute % 100).toString().padStart(2, '0')} $currency"
}

/** "12,34" or "12.34" into cents; null when it is not a positive amount. */
internal fun parseMinor(raw: String): Long? {
    val normalized = raw.trim().replace(',', '.')
    if (!Regex("^\\d+(\\.\\d{1,2})?$").matches(normalized)) return null
    val value = Math.round(normalized.toDouble() * 100)
    return if (value > 0) value else null
}

/** State of the OweNo screens; one instance per visit, kept by Compose. */
private class OweStore(private val api: ApiClient, private val scope: CoroutineScope) {
    var groups by mutableStateOf<List<OweGroupDto>>(emptyList())
    var detail by mutableStateOf<OweGroupDetail?>(null)
    var movements by mutableStateOf<List<OweMovementDto>>(emptyList())
    var balances by mutableStateOf<List<OweBalanceDto>>(emptyList())
    var settlement by mutableStateOf<OweSettlementDto?>(null)
    var loading by mutableStateOf(false)
    var error by mutableStateOf<String?>(null)

    private fun run(block: suspend () -> Unit) {
        scope.launch {
            loading = true
            error = null
            runCatching { block() }.onFailure { error = it.message }
            loading = false
        }
    }

    fun loadGroups() = run { groups = api.oweGroups() }

    fun open(groupId: String) = run {
        detail = api.oweGroup(groupId)
        movements = api.oweMovements(groupId)
        balances = api.oweBalances(groupId)
        settlement = runCatching { api.oweSettlement(groupId) }.getOrNull()
    }

    fun close() {
        detail = null
        movements = emptyList()
        balances = emptyList()
        settlement = null
    }

    fun createGroup(name: String, currency: String) = run {
        api.oweCreateGroup(name, currency)
        groups = api.oweGroups()
    }

    fun addExpense(
        groupId: String,
        description: String,
        amountMinor: Long,
        payer: String,
        participants: List<String>,
    ) = run {
        api.oweCreateMovement(
            groupId,
            OweCreateMovementBody(
                kind = "expense",
                description = description,
                amountMinor = amountMinor,
                occurredOn = LocalDate.now().toString(),
                paidBy = payer,
                participants = participants.map { OweParticipantBody(memberId = it) },
            ),
        )
        open(groupId)
    }

    fun settleUp(groupId: String, from: String, to: String, amountMinor: Long) = run {
        api.oweCreateMovement(
            groupId,
            OweCreateMovementBody(
                kind = "settlement",
                description = "Settlement",
                amountMinor = amountMinor,
                occurredOn = LocalDate.now().toString(),
                paidBy = from,
                participants = listOf(OweParticipantBody(memberId = to, amountMinor = amountMinor)),
            ),
        )
        open(groupId)
    }
}

/**
 * OweNo in the app: groups, one group with balances and movements, a new
 * expense, and the settlement plan. The money rules live in the module's
 * service; these screens only call its API.
 */
@Composable
fun OweNoScreen(api: ApiClient, onBack: () -> Unit) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    val scope = rememberCoroutineScope()
    val store = remember(api) { OweStore(api, scope) }
    var showNewGroup by remember { mutableStateOf(false) }
    var showExpense by remember { mutableStateOf(false) }
    var showSettlement by remember { mutableStateOf(false) }

    LaunchedEffect(api) { store.loadGroups() }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(
                onClick = { if (store.detail == null) onBack() else store.close() },
            ) {
                Icon(Icons.Filled.ArrowBack, contentDescription = strings.back, tint = palette.foreground)
            }
            Text(
                store.detail?.group?.name ?: "OweNo",
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.weight(1f),
            )
            if (store.loading) {
                CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
            }
        }

        store.error?.let { Text(it, color = palette.destructive, fontSize = 12.sp) }

        if (store.detail == null) {
            Groups(store, strings.groups, strings.newGroup) { showNewGroup = true }
        } else {
            val detail = store.detail!!
            Balances(store.balances, detail.group.currency)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { showExpense = true }) { Text(strings.addExpense) }
                TextButton(onClick = { showSettlement = true }) { Text(strings.settle) }
            }
            Movements(store.movements, detail.members, detail.group.currency)
        }
    }

    if (showNewGroup) {
        NewGroupDialog(
            onDismiss = { showNewGroup = false },
            onCreate = { name, currency ->
                showNewGroup = false
                store.createGroup(name, currency)
            },
        )
    }

    val current = store.detail
    if (showExpense && current != null) {
        ExpenseDialog(
            members = current.members,
            currency = current.group.currency,
            onDismiss = { showExpense = false },
            onSave = { description, amountMinor, payer, participants ->
                showExpense = false
                store.addExpense(current.group.id, description, amountMinor, payer, participants)
            },
        )
    }

    if (showSettlement && current != null && store.settlement != null) {
        SettlementDialog(
            members = current.members,
            settlement = store.settlement!!,
            onDismiss = { showSettlement = false },
            onPay = { from, to, amount ->
                showSettlement = false
                store.settleUp(current.group.id, from, to, amount)
            },
        )
    }
}

@Composable
private fun Groups(store: OweStore, title: String, newGroup: String, onNew: () -> Unit) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(title, fontSize = 22.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
        TextButton(onClick = onNew) { Text(newGroup) }
    }
    if (store.groups.isEmpty() && !store.loading) {
        Text(strings.noGroups, fontSize = 13.sp, color = palette.mutedForeground)
    }
    for (group in store.groups) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(palette.surface, RoundedCornerShape(16.dp))
                .border(1.dp, palette.border, RoundedCornerShape(16.dp))
                .clickable { store.open(group.id) }
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier.size(36.dp).background(palette.successSubtle, RoundedCornerShape(10.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Text(group.name.take(1).uppercase(), color = palette.accent, fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.size(12.dp))
            Column(Modifier.weight(1f)) {
                Text(group.name, fontWeight = FontWeight.SemiBold)
                Text(
                    "${group.members} ${strings.members} · ${group.currency}",
                    fontSize = 12.sp,
                    color = palette.mutedForeground,
                )
            }
        }
    }
}

@Composable
private fun Balances(balances: List<OweBalanceDto>, currency: String) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    if (balances.isEmpty()) return
    Text(strings.balances.uppercase(), fontSize = 11.sp, letterSpacing = 1.sp, color = palette.mutedForeground)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(palette.surface, RoundedCornerShape(16.dp))
            .border(1.dp, palette.border, RoundedCornerShape(16.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        for (balance in balances) {
            Row {
                Text(balance.displayName, modifier = Modifier.weight(1f), fontSize = 13.sp)
                Text(
                    formatMinor(balance.amountMinor, currency),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = if (balance.amountMinor >= 0) palette.accent else palette.destructive,
                )
            }
        }
    }
}

@Composable
private fun Movements(movements: List<OweMovementDto>, members: List<OweMemberDto>, currency: String) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    Text(strings.movements.uppercase(), fontSize = 11.sp, letterSpacing = 1.sp, color = palette.mutedForeground)
    if (movements.isEmpty()) {
        Text(strings.noMovements, fontSize = 13.sp, color = palette.mutedForeground)
    }
    val byId = members.associateBy { it.id }
    for (movement in movements) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(palette.surface, RoundedCornerShape(12.dp))
                .border(1.dp, palette.border, RoundedCornerShape(12.dp))
                .padding(12.dp),
        ) {
            Column(Modifier.weight(1f)) {
                Text(movement.description, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                Text(
                    "${byId[movement.paidBy]?.displayName ?: ""} · ${movement.occurredOn}",
                    fontSize = 11.sp,
                    color = palette.mutedForeground,
                )
            }
            Text(formatMinor(movement.amountMinor, currency), fontSize = 13.sp)
        }
    }
}

@Composable
private fun NewGroupDialog(onDismiss: () -> Unit, onCreate: (String, String) -> Unit) {
    val strings = LocalStrings.current
    var name by remember { mutableStateOf("") }
    var currency by remember { mutableStateOf("EUR") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(strings.newGroup) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text(strings.groupName) },
                    singleLine = true,
                )
                OutlinedTextField(
                    value = currency,
                    onValueChange = { currency = it.uppercase().take(3) },
                    label = { Text(strings.currency) },
                    singleLine = true,
                )
            }
        },
        confirmButton = {
            TextButton(
                enabled = name.isNotBlank() && Regex("^[A-Z]{3}$").matches(currency),
                onClick = { onCreate(name.trim(), currency) },
            ) { Text(strings.create) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(strings.cancel) } },
    )
}

@Composable
private fun ExpenseDialog(
    members: List<OweMemberDto>,
    currency: String,
    onDismiss: () -> Unit,
    onSave: (String, Long, String, List<String>) -> Unit,
) {
    val strings = LocalStrings.current
    val active = members.filter { it.state == "active" }
    var description by remember { mutableStateOf("") }
    var amount by remember { mutableStateOf("") }
    var payer by remember { mutableStateOf(active.firstOrNull()?.id) }
    var selected by remember { mutableStateOf(active.map { it.id }.toSet()) }
    val minor = parseMinor(amount)
    val total = minor ?: 0

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(strings.addExpense) },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text(strings.description) },
                    singleLine = true,
                )
                OutlinedTextField(
                    value = amount,
                    onValueChange = { amount = it },
                    label = { Text("${strings.amount} (${currency})") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                )
                Text("${strings.paidBy}:", fontSize = 12.sp)
                for (member in active) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { payer = member.id },
                    ) {
                        Checkbox(checked = payer == member.id, onCheckedChange = { payer = member.id })
                        Text(member.displayName, fontSize = 13.sp)
                    }
                }
                Text("${strings.participants}:", fontSize = 12.sp)
                for (member in active) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                selected = if (selected.contains(member.id)) {
                                    selected - member.id
                                } else {
                                    selected + member.id
                                }
                            },
                    ) {
                        Checkbox(checked = selected.contains(member.id), onCheckedChange = null)
                        Text(member.displayName, fontSize = 13.sp, modifier = Modifier.weight(1f))
                        if (selected.contains(member.id) && selected.isNotEmpty() && total > 0) {
                            val share = total / selected.size
                            Text(formatMinor(share, currency), fontSize = 12.sp)
                        }
                    }
                }
                Text(strings.splitEqually, fontSize = 11.sp, color = LocalPalette.current.mutedForeground)
            }
        },
        confirmButton = {
            TextButton(
                enabled = description.isNotBlank() && minor != null && payer != null && selected.isNotEmpty(),
                onClick = { onSave(description.trim(), minor!!, payer!!, selected.toList()) },
            ) { Text(strings.save) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(strings.cancel) } },
    )
}

@Composable
private fun SettlementDialog(
    members: List<OweMemberDto>,
    settlement: OweSettlementDto,
    onDismiss: () -> Unit,
    onPay: (String, String, Long) -> Unit,
) {
    val strings = LocalStrings.current
    val byId = members.associateBy { it.id }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(strings.whoPays) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (!settlement.exact) {
                    Text(strings.simplified, fontSize = 11.sp)
                }
                if (settlement.transfers.isEmpty()) {
                    Text(strings.allSettled, fontSize = 13.sp)
                }
                for (transfer in settlement.transfers) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            "${byId[transfer.from]?.displayName ?: ""} → ${byId[transfer.to]?.displayName ?: ""}",
                            fontSize = 13.sp,
                            modifier = Modifier.weight(1f),
                        )
                        Text(formatMinor(transfer.amountMinor, "EUR"), fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                        TextButton(onClick = { onPay(transfer.from, transfer.to, transfer.amountMinor) }) {
                            Text("OK")
                        }
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text(strings.cancel) } },
    )
}
