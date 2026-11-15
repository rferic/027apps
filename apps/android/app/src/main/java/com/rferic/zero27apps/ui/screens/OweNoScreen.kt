package com.rferic.zero27apps.ui.screens

import com.rferic.zero27apps.ui.components.AppFormSheet
import com.rferic.zero27apps.ui.components.AppSheet
import com.rferic.zero27apps.ui.components.SheetAction
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
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
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rferic.zero27apps.data.ApiClient
import com.rferic.zero27apps.data.ApiException
import com.rferic.zero27apps.data.OweBalanceDto
import com.rferic.zero27apps.data.OweCreateMovementBody
import com.rferic.zero27apps.data.OweGroupDetail
import com.rferic.zero27apps.data.OweCategoryDto
import com.rferic.zero27apps.data.OweGroupDto
import com.rferic.zero27apps.data.OweIdentityDto
import com.rferic.zero27apps.data.OweMemberDto
import com.rferic.zero27apps.data.OweMovementDto
import com.rferic.zero27apps.data.OweParticipantBody
import com.rferic.zero27apps.data.OweSettlementDto
import com.rferic.zero27apps.ui.i18n.LocalStrings
import com.rferic.zero27apps.ui.theme.LocalPalette
import java.time.LocalDate
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/** Domain details → a sentence the owner can act on. */
internal fun oweErrorText(
    error: Throwable,
    strings: com.rferic.zero27apps.ui.i18n.Strings,
): String {
    val api = error as? ApiException
    return when (api?.detailsCode ?: api?.code) {
        "member_has_balance" -> strings.errorBalance
        "last_member" -> strings.errorLastMember
        "member_blocked" -> strings.errorBlocked
        "duplicates" -> strings.errorDuplicates
        "unmapped_identity" -> strings.errorUnmapped
        "multi_currency" -> strings.multiCurrency
        "network_error" -> strings.failureNetwork
        else -> strings.actionFailed
    }
}

/** Equal split: base cents plus one cent for the first `remainder` members. */
internal fun equalShare(total: Long, chosen: Int, index: Int): Long {
    if (chosen <= 0) return 0
    val base = total / chosen
    return base + if (index < (total % chosen).toInt()) 1 else 0
}

/** ISO calendar day, rendered with the profile locale; unknown values pass through. */
internal fun formatDay(raw: String, locale: String): String =
    runCatching { java.time.LocalDate.parse(raw) }
        .map {
            it.format(
                java.time.format.DateTimeFormatter.ofLocalizedDate(java.time.format.FormatStyle.MEDIUM)
                    .withLocale(java.util.Locale.forLanguageTag(locale)),
            )
        }
        .getOrDefault(if (raw.length >= 10) raw.take(10) else raw)

/** Money is integer minor units; the app only formats for display, in the profile locale. */
internal fun formatMinor(amountMinor: Long, currency: String, locale: String): String =
    runCatching {
        java.text.NumberFormat.getCurrencyInstance(java.util.Locale.forLanguageTag(locale)).apply {
            this.currency = java.util.Currency.getInstance(currency)
        }.format(amountMinor / 100.0)
    }.getOrDefault("${amountMinor / 100.0} $currency")

/** "12,34" or "12.34" into cents; null when it is not a positive amount. */
internal fun parseMinor(raw: String): Long? {
    val normalized = raw.trim().replace(',', '.')
    if (!Regex("^\\d+(\\.\\d{1,2})?$").matches(normalized)) return null
    val value = Math.round(normalized.toDouble() * 100)
    return if (value > 0) value else null
}

/** State of the OweNo screens; one instance per visit, kept by Compose. */
private class OweStore(
    private val api: ApiClient,
    val userId: String?,
    private val strings: com.rferic.zero27apps.ui.i18n.Strings,
    private val scope: CoroutineScope,
) {
    var groups by mutableStateOf<List<OweGroupDto>>(emptyList())
    var detail by mutableStateOf<OweGroupDetail?>(null)
    var movements by mutableStateOf<List<OweMovementDto>>(emptyList())
    var balances by mutableStateOf<List<OweBalanceDto>>(emptyList())
    var settlement by mutableStateOf<OweSettlementDto?>(null)
    var loading by mutableStateOf(false)
    var error by mutableStateOf<String?>(null)
    var identities by mutableStateOf<List<OweIdentityDto>>(emptyList())
    var categories by mutableStateOf<List<OweCategoryDto>>(emptyList())

    private fun run(onSuccess: (() -> Unit)? = null, block: suspend () -> Unit) {
        scope.launch {
            loading = true
            error = null
            runCatching { block() }.onFailure { error = oweErrorText(it, strings) }
            loading = false
            if (error == null) onSuccess?.invoke()
        }
    }

    fun loadGroups() = run { groups = api.oweGroups() }

    fun open(groupId: String) = run {
        detail = api.oweGroup(groupId)
        movements = api.oweMovements(groupId)
        balances = api.oweBalances(groupId)
        settlement = runCatching { api.oweSettlement(groupId) }.getOrNull()
        categories = runCatching { api.oweCategories(groupId) }.getOrDefault(emptyList())
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
        participants: List<OweParticipantBody>,
        occurredOn: String,
        categoryId: String?,
        onSuccess: () -> Unit,
    ) = run(onSuccess) {
        api.oweCreateMovement(
            groupId,
            OweCreateMovementBody(
                kind = "expense",
                description = description,
                amountMinor = amountMinor,
                occurredOn = occurredOn,
                paidBy = payer,
                categoryId = categoryId,
                participants = participants,
            ),
        )
        open(groupId)
    }

    fun loadIdentities(groupId: String) = run {
        identities = runCatching { api.oweIdentities(groupId) }.getOrDefault(emptyList())
    }

    fun accept(groupId: String) = run {
        api.oweAcceptInvitation(groupId)
        groups = api.oweGroups()
        open(groupId)
    }

    fun decline(groupId: String) = run {
        api.oweDeclineInvitation(groupId)
        groups = api.oweGroups()
    }

    fun invite(groupId: String, name: String, inviteeId: String?) = run {
        api.oweAddMember(groupId, com.rferic.zero27apps.data.OweAddMemberBody(name, inviteeId))
        open(groupId)
    }

    fun removeMember(groupId: String, memberId: String, mode: String? = null) = run {
        api.oweRemoveMember(groupId, memberId, mode)
        open(groupId)
    }

    fun blockMember(groupId: String, memberId: String, mode: String? = null) = run {
        api.oweBlockMember(groupId, memberId, mode)
        open(groupId)
    }

    fun linkMember(groupId: String, memberId: String, userId: String) = run {
        api.oweLinkMember(groupId, memberId, userId)
        open(groupId)
    }

    fun unblockMember(groupId: String, memberId: String) = run {
        api.oweUnblockMember(groupId, memberId)
        open(groupId)
    }

    fun leaveGroup(groupId: String) = run {
        api.oweLeaveGroup(groupId)
        close()
        groups = api.oweGroups()
    }

    fun settleUp(
        groupId: String,
        from: String,
        to: String,
        amountMinor: Long,
        description: String,
        occurredOn: String,
        onSuccess: () -> Unit,
    ) = run(onSuccess) {
        api.oweCreateMovement(
            groupId,
            OweCreateMovementBody(
                kind = "settlement",
                description = description,
                amountMinor = amountMinor,
                occurredOn = occurredOn,
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
fun OweNoScreen(
    api: ApiClient,
    userId: String?,
    locale: String,
    onBack: () -> Unit,
    startAction: String? = null,
    onStartConsumed: () -> Unit = {},
) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    val scope = rememberCoroutineScope()
    val store = remember(api, userId) { OweStore(api, userId, strings, scope) }
    var showNewGroup by remember { mutableStateOf(false) }
    var showExpense by remember { mutableStateOf(false) }
    var showSettlement by remember { mutableStateOf(false) }
    var showInvite by remember { mutableStateOf(false) }
    var showImport by remember { mutableStateOf(false) }
    var showPayment by remember { mutableStateOf(false) }
    var showSettings by remember { mutableStateOf(false) }
    var showMenu by remember { mutableStateOf(false) }
    var showInvitations by remember { mutableStateOf(false) }
    var pendingAction by remember { mutableStateOf<Pair<String, () -> Unit>?>(null) }
    var tab by remember { mutableStateOf(0) }
    var showAddPerson by remember { mutableStateOf(false) }
    var pickGroupForExpense by remember { mutableStateOf(startAction == "expense") }
    var inviteMode by remember { mutableStateOf("account") }

    LaunchedEffect(api) { store.loadGroups() }
    LaunchedEffect(startAction) {
        if (startAction == "expense") pickGroupForExpense = true
    }

    androidx.activity.compose.BackHandler {
        when {
            showImport -> showImport = false
            showSettings -> showSettings = false
            showInvitations -> showInvitations = false
            store.detail != null -> store.close()
            else -> onBack()
        }
    }

    val importing = store.detail
    if (showImport && importing != null) {
        OweImportScreen(
            api = api,
            groupId = importing.group.id,
            onClose = {
                showImport = false
                store.open(importing.group.id)
            },
        )
        return
    }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp).padding(bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(
                onClick = { if (store.detail == null) onBack() else store.close() },
            ) {
                Icon(Icons.Filled.ArrowBack, contentDescription = strings.back, tint = palette.foreground)
            }
            Column(Modifier.weight(1f)) {
                Text(
                    store.detail?.group?.name ?: strings.groups,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                )
                store.detail?.let { open ->
                    val people = open.members.count { it.state == "active" }
                    val pending = open.members.count { it.state == "invited" && !it.blocked }
                    val base = (if (people == 1) strings.peopleCountOne else strings.peopleCount)
                        .replace("{count}", people.toString())
                        .replace("{currency}", open.group.currency)
                    val extra = when {
                        pending == 0 -> ""
                        pending == 1 -> " · ${strings.pendingInvite}"
                        else -> " · ${strings.pendingCount.replace("{count}", pending.toString())}"
                    }
                    Text(base + extra, fontSize = 12.sp, color = palette.mutedForeground)
                }
            }
            if (store.loading) {
                CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
            }
            IconButton(onClick = { showMenu = true }) {
                Icon(Icons.Filled.MoreVert, contentDescription = strings.menu, tint = palette.foreground)
            }
            DropdownMenu(expanded = showMenu, onDismissRequest = { showMenu = false }) {
                DropdownMenuItem(
                    text = { Text(strings.groups) },
                    onClick = {
                        showMenu = false
                        showInvitations = false
                        store.close()
                    },
                )
                DropdownMenuItem(
                    text = { Text(strings.invitations) },
                    onClick = {
                        showMenu = false
                        showInvitations = true
                        store.close()
                    },
                )
                if (store.detail?.group?.createdBy == store.userId) {
                    DropdownMenuItem(
                        text = { Text(strings.importTitle) },
                        onClick = {
                            showMenu = false
                            showImport = true
                        },
                    )
                }
            }
        }

        store.error?.let {
            Text(
                if (it.contains("network", ignoreCase = true)) strings.failureNetwork else strings.actionFailed,
                color = palette.destructive,
                fontSize = 12.sp,
            )
        }

        if (store.detail == null) {
            if (showInvitations) {
                Invitations(store, strings, onAccept = { store.accept(it) })
            } else {
                Groups(
                    store,
                    strings.groups,
                    strings.newGroup,
                    onNew = { showNewGroup = true },
                    onAccept = { store.accept(it) },
                )
            }
        } else {
            val detail = store.detail!!
            val myMemberId = detail.members.firstOrNull { it.userId == store.userId }?.id
            val myBalance = store.balances.firstOrNull { it.memberId == myMemberId }?.amountMinor ?: 0L
            BalanceStrip(myBalance, detail.group.currency, locale) { tab = 1 }
            GroupTabs(tab) { tab = it }
            when (tab) {
                0 -> ActivityTab(
                    store = store,
                    detail = detail,
                    locale = locale,
                    onAddExpense = { showExpense = true },
                    onAddPerson = {
                        store.loadIdentities(detail.group.id)
                        showAddPerson = true
                    },
                )
                1 -> BalancesTab(
                    store = store,
                    detail = detail,
                    locale = locale,
                    onAddExpense = { showExpense = true },
                    onSettle = { showSettlement = true },
                    onPay = { showPayment = true },
                )
                else -> MembersTab(
                    store = store,
                    detail = detail,
                    locale = locale,
                    onAddPerson = {
                        store.loadIdentities(detail.group.id)
                        showAddPerson = true
                    },
                    onSettle = { showSettlement = true },
                )
            }
        }
    }

    if (pickGroupForExpense) {
        AppSheet(
            onDismissRequest = {
                pickGroupForExpense = false
                onStartConsumed()
            },
            title = strings.addExpense,
            subtitle = strings.groups,
            secondaryLabel = strings.cancel,
            onSecondary = {
                pickGroupForExpense = false
                onStartConsumed()
            },
            content = {
                if (store.groups.isEmpty()) {
                    Text(strings.noGroups, fontSize = 12.sp, color = palette.mutedForeground)
                }
                store.groups.filter { it.role == "active" }.forEach { group ->
                    SheetAction(label = group.name) {
                        pickGroupForExpense = false
                        onStartConsumed()
                        store.open(group.id)
                        showExpense = true
                    }
                }
            },
        )
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
            categories = store.categories,
            currency = current.group.currency,
            locale = locale,
            saving = store.loading,
            error = store.error,
            onDismiss = { showExpense = false },
            onSave = { description, amountMinor, payer, participants, occurredOn, categoryId ->
                store.addExpense(
                    current.group.id,
                    description,
                    amountMinor,
                    payer,
                    participants,
                    occurredOn,
                    categoryId,
                    onSuccess = { showExpense = false },
                )
            },
        )
    }

    if (showPayment && current != null) {
        ManualPaymentDialog(
            members = current.members,
            currency = current.group.currency,
            saving = store.loading,
            onDismiss = { showPayment = false },
            onSave = { from, to, amount, day ->
                store.settleUp(
                    current.group.id,
                    from,
                    to,
                    amount,
                    strings.settle,
                    day,
                    onSuccess = { showPayment = false },
                )
            },
        )
    }

    if (showAddPerson) {
        AddPersonDialog(
            onDismiss = { showAddPerson = false },
            onPick = { mode ->
                showAddPerson = false
                inviteMode = mode
                showInvite = true
            },
        )
    }

    if (showInvite && current != null) {
        InviteDialog(
            mode = inviteMode,
            identities = store.identities,
            onDismiss = { showInvite = false },
            onInvite = { name, inviteeId ->
                showInvite = false
                store.invite(current.group.id, name, inviteeId)
            },
        )
    }

    pendingAction?.let { (label, action) ->
        AppFormSheet(
            onDismissRequest = { pendingAction = null },
            title = { Text(label) },
            text = { Text(strings.confirmQuestion) },
            confirmButton = {
                TextButton(onClick = {
                    pendingAction = null
                    action()
                }) { Text(label) }
            },
            dismissButton = {
                TextButton(onClick = { pendingAction = null }) { Text(strings.cancel) }
            },
        )
    }

    if (showSettlement && current != null && store.settlement != null) {
        SettlementDialog(
            members = current.members,
            myMemberId = current.members.firstOrNull { it.userId == store.userId }?.id,
            settlement = store.settlement!!,
            currency = current.group.currency,
            locale = locale,
            saving = store.loading,
            onDismiss = { showSettlement = false },
            onPay = { from, to, amount ->
                store.settleUp(
                    current.group.id,
                    from,
                    to,
                    amount,
                    strings.settle,
                    LocalDate.now().toString(),
                    onSuccess = { showSettlement = false },
                )
            },
        )
    }
}

@Composable
private fun Groups(
    store: OweStore,
    title: String,
    newGroup: String,
    onNew: () -> Unit,
    onAccept: (String) -> Unit,
) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    Row(verticalAlignment = Alignment.CenterVertically) {
        Spacer(Modifier.weight(1f))
        TextButton(onClick = onNew) { Text(newGroup) }
    }
    if (store.groups.isEmpty() && !store.loading) {
        if (store.error == null) {
            Text(strings.noGroups, fontSize = 13.sp, color = palette.mutedForeground)
        } else {
            TextButton(onClick = { store.loadGroups() }) { Text(strings.tryAgain) }
        }
    }
    for (group in store.groups) {
        val invited = group.role == "invited"
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(palette.surface, RoundedCornerShape(16.dp))
                .border(1.dp, palette.border, RoundedCornerShape(16.dp))
                .clickable(enabled = !invited) { store.open(group.id) }
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
                    if (invited) {
                        strings.invitations
                    } else {
                        (if (group.members == 1) strings.peopleCountOne else strings.peopleCount)
                            .replace("{count}", group.members.toString())
                            .replace("{currency}", group.currency)
                    },
                    fontSize = 12.sp,
                    color = if (invited) palette.accent else palette.mutedForeground,
                )
            }
            if (invited) {
                TextButton(onClick = { onAccept(group.id) }) { Text(strings.accept) }
                TextButton(onClick = { store.decline(group.id) }) {
                    Text(strings.decline, fontSize = 11.sp)
                }
            }
        }
    }
}

/** Members of a group; the creator invites, removes and blocks (D3.6). */
@Composable
private fun Invitations(
    store: OweStore,
    strings: com.rferic.zero27apps.ui.i18n.Strings,
    onAccept: (String) -> Unit,
) {
    val palette = LocalPalette.current
    val invited = store.groups.filter { it.role == "invited" }
    Text(strings.invitations, fontSize = 22.sp, fontWeight = FontWeight.Bold)
    if (invited.isEmpty()) {
        if (store.error == null) {
            Text(strings.noInvitations, fontSize = 13.sp, color = palette.mutedForeground)
        } else {
            TextButton(onClick = { store.loadGroups() }) { Text(strings.tryAgain) }
        }
    }
    for (group in invited) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(palette.surface, RoundedCornerShape(16.dp))
                .border(1.dp, palette.border, RoundedCornerShape(16.dp))
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(group.name, modifier = Modifier.weight(1f), fontWeight = FontWeight.SemiBold)
            TextButton(onClick = { onAccept(group.id) }) { Text(strings.accept) }
            TextButton(onClick = { store.decline(group.id) }) {
                Text(strings.decline, fontSize = 11.sp)
            }
        }
    }
}

@Composable
private fun BalanceStrip(amountMinor: Long, currency: String, locale: String, onOpen: () -> Unit) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    val text = when {
        amountMinor < 0 -> strings.youOwe.replace("{amount}", formatMinor(-amountMinor, currency, locale))
        amountMinor > 0 -> strings.owedToYou.replace("{amount}", formatMinor(amountMinor, currency, locale))
        else -> strings.youSettled
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(palette.surface, RoundedCornerShape(16.dp))
            .border(1.dp, palette.border, RoundedCornerShape(16.dp))
            .clickable(onClick = onOpen)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = if (amountMinor < 0) palette.destructive else palette.accent,
            modifier = Modifier.weight(1f),
        )
        Text("›", fontSize = 18.sp, color = palette.mutedForeground)
    }
}

/** The three faces of a group: what happened, who owes what, and who is in. */
@Composable
private fun GroupTabs(selected: Int, onSelect: (Int) -> Unit) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    val labels = listOf(strings.tabActivity, strings.tabBalances, strings.tabMembers)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(palette.surface, RoundedCornerShape(14.dp))
            .border(1.dp, palette.border, RoundedCornerShape(14.dp))
            .padding(4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        labels.forEachIndexed { index, label ->
            val on = index == selected
            Box(
                modifier = Modifier
                    .weight(1f)
                    .background(
                        if (on) palette.accent.copy(alpha = 0.14f) else androidx.compose.ui.graphics.Color.Transparent,
                        RoundedCornerShape(10.dp),
                    )
                    .selectable(selected = on, role = androidx.compose.ui.semantics.Role.Tab) { onSelect(index) }
                    .then(
                        if (on) {
                            Modifier.border(1.dp, palette.accent, RoundedCornerShape(10.dp))
                        } else {
                            Modifier
                        },
                    )
                    .heightIn(min = 44.dp)
                    .padding(vertical = 10.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    label,
                    fontSize = 12.sp,
                    fontWeight = if (on) FontWeight.SemiBold else FontWeight.Normal,
                    color = if (on) palette.accent else palette.mutedForeground,
                )
            }
        }
    }
}

@Composable
private fun ActivityTab(
    store: OweStore,
    detail: OweGroupDetail,
    locale: String,
    onAddExpense: () -> Unit,
    onAddPerson: () -> Unit,
) {
    val strings = LocalStrings.current
    val palette = LocalPalette.current
    var query by remember { mutableStateOf("") }
    val myMemberId = detail.members.firstOrNull { it.userId == store.userId }?.id
    val month = LocalDate.now().toString().take(7)
    val monthTotal = store.movements
        .filter { it.kind == "expense" && it.occurredOn.take(7) == month }
        .sumOf { it.amountMinor }
    Button(onClick = onAddExpense, modifier = Modifier.fillMaxWidth()) { Text(strings.addExpense) }
    if (store.movements.isNotEmpty()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                strings.monthTotal.replace("{amount}", formatMinor(monthTotal, detail.group.currency, locale)),
                fontSize = 12.sp,
                color = palette.mutedForeground,
                modifier = Modifier.weight(1f),
            )
        }
        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            label = { Text(strings.search) },
            singleLine = true,
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier.fillMaxWidth(),
        )
    }
    val shown = if (query.isBlank()) {
        store.movements
    } else {
        val wanted = query.trim().lowercase()
        store.movements.filter { it.description.lowercase().contains(wanted) }
    }
    Movements(shown, detail.members, detail.group.currency, locale, myMemberId, strings.activityEmpty)
    if (detail.members.count { it.state == "active" } <= 1) {
        Text(strings.aloneInGroup, fontSize = 12.sp, color = palette.mutedForeground)
        TextButton(onClick = onAddPerson) { Text(strings.addPerson) }
    }
}

@Composable
private fun BalancesTab(
    store: OweStore,
    detail: OweGroupDetail,
    locale: String,
    onAddExpense: () -> Unit,
    onSettle: () -> Unit,
    onPay: () -> Unit,
) {
    val strings = LocalStrings.current
    val palette = LocalPalette.current
    val myMemberId = detail.members.firstOrNull { it.userId == store.userId }?.id
    Balances(store.balances, detail.group.currency, locale, myMemberId)
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Button(onClick = onSettle) { Text(strings.settle) }
        TextButton(onClick = onPay) { Text(strings.registerPayment) }
    }
}

@Composable
private fun MembersTab(
    store: OweStore,
    detail: OweGroupDetail,
    locale: String,
    onAddPerson: () -> Unit,
    onSettle: () -> Unit,
) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    val creator = detail.group.createdBy != null && detail.group.createdBy == store.userId
    val mine = detail.members.firstOrNull { it.userId != null && it.userId == store.userId }
    var sheet by remember { mutableStateOf<OweMemberDto?>(null) }
    var confirmRemove by remember { mutableStateOf<OweMemberDto?>(null) }
    var balanceRemove by remember { mutableStateOf<OweMemberDto?>(null) }
    var confirmBlock by remember { mutableStateOf<OweMemberDto?>(null) }
    var confirmLeave by remember { mutableStateOf(false) }
    var linkTarget by remember { mutableStateOf<OweMemberDto?>(null) }
    fun balanceOf(id: String): Long =
        store.balances.firstOrNull { it.memberId == id }?.amountMinor ?: 0L

    fun statusOf(member: OweMemberDto): String = when {
        member.blocked -> strings.blockedPeople
        member.state == "invited" -> strings.pendingInvite
        member.userId == null -> strings.memberNoAccount
        else -> strings.stateActive
    }

    fun directionText(member: OweMemberDto): String? {
        val owed = balanceOf(member.id)
        val self = member.userId != null && member.userId == store.userId
        return when {
            owed > 0 && self ->
                strings.owedToYou.replace("{amount}", formatMinor(owed, detail.group.currency, locale))
            owed < 0 && self ->
                strings.youOwe.replace("{amount}", formatMinor(-owed, detail.group.currency, locale))
            owed > 0 ->
                strings.theyAreOwed
                    .replace("{name}", member.displayName)
                    .replace("{amount}", formatMinor(owed, detail.group.currency, locale))
            owed < 0 ->
                strings.theyOweYou
                    .replace("{name}", member.displayName)
                    .replace("{amount}", formatMinor(-owed, detail.group.currency, locale))
            else -> null
        }
    }

    if (creator) {
        Row(horizontalArrangement = Arrangement.End, modifier = Modifier.fillMaxWidth()) {
            TextButton(onClick = onAddPerson) { Text(strings.addPerson) }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(palette.surface, RoundedCornerShape(16.dp))
            .border(1.dp, palette.border, RoundedCornerShape(16.dp))
            .padding(vertical = 4.dp),
    ) {
        for (member in detail.members.filter { it.state != "removed" || it.blocked }) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { sheet = member }
                    .padding(horizontal = 14.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .background(palette.border, androidx.compose.foundation.shape.CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        member.displayName.trim().take(1).uppercase(),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = palette.foreground,
                    )
                }
                Spacer(Modifier.size(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        member.displayName + if (member.userId == store.userId) " · ${strings.you}" else "",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(statusOf(member), fontSize = 11.sp, color = palette.mutedForeground)
                }
                directionText(member)?.let {
                    Text(
                        it,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = if (balanceOf(member.id) > 0) palette.accent else palette.destructive,
                    )
                }
                if (creator) {
                    Text("  ›", fontSize = 16.sp, color = palette.mutedForeground)
                }
            }
        }
    }

    if (mine != null) {
        TextButton(onClick = { confirmLeave = true }) {
            Text(strings.leaveGroup, color = palette.destructive, fontSize = 12.sp)
        }
    }

    sheet?.let { member ->
        val owed = balanceOf(member.id)
        AppSheet(
            onDismissRequest = { sheet = null },
            title = member.displayName,
            subtitle = listOfNotNull(statusOf(member), directionText(member)).joinToString(" · "),
            secondaryLabel = strings.close,
            onSecondary = { sheet = null },
            content = {
                if (creator && member.userId != store.userId) {
                    if (owed != 0L && member.state == "active") {
                        SheetAction(label = strings.settleFirst) {
                            sheet = null
                            onSettle()
                        }
                    }
                    if (member.userId == null && !member.blocked) {
                        SheetAction(label = strings.linkAccount) {
                            sheet = null
                            store.loadIdentities(detail.group.id)
                            linkTarget = member
                        }
                    }
                    when {
                        member.blocked -> SheetAction(label = strings.unblockAccount) {
                            sheet = null
                            store.unblockMember(detail.group.id, member.id)
                        }
                        member.state == "invited" -> SheetAction(
                            label = strings.cancelInvitation,
                            note = strings.confirmQuestion,
                            destructive = true,
                        ) {
                            sheet = null
                            confirmRemove = member
                        }
                        else -> {
                            SheetAction(
                                label = strings.removeFromGroup,
                                note = null,
                                destructive = true,
                            ) {
                                sheet = null
                                if (owed != 0L) balanceRemove = member else confirmRemove = member
                            }
                            if (member.userId != null && owed == 0L) {
                                SheetAction(
                                    label = strings.blockAccount,
                                    note = strings.confirmQuestion,
                                    destructive = true,
                                ) {
                                    sheet = null
                                    confirmBlock = member
                                }
                            }
                        }
                    }
                }
            },
        )
    }

    confirmRemove?.let { member ->
        AppSheet(
            onDismissRequest = { confirmRemove = null },
            title = if (member.state == "invited") strings.cancelInvitation else strings.removeFromGroup,
            subtitle = strings.confirmQuestion,
            primaryLabel = if (member.state == "invited") strings.cancelInvitation else strings.removeFromGroup,
            destructive = true,
            onPrimary = {
                confirmRemove = null
                store.removeMember(detail.group.id, member.id)
            },
            secondaryLabel = strings.cancel,
            onSecondary = { confirmRemove = null },
        )
    }

    balanceRemove?.let { member ->
        val owed = balanceOf(member.id)
        AppSheet(
            onDismissRequest = { balanceRemove = null },
            title = member.displayName,
            subtitle = formatMinor(if (owed < 0) -owed else owed, detail.group.currency, locale) +
                " · " + strings.removeBalanceBody,
            primaryLabel = strings.settleFirst,
            onPrimary = {
                balanceRemove = null
                onSettle()
            },
            secondaryLabel = strings.cancel,
            onSecondary = { balanceRemove = null },
            content = {
                if (member.userId != null) {
                    SheetAction(
                        label = strings.removeKeepBalance,
                        destructive = true,
                    ) {
                        balanceRemove = null
                        store.removeMember(detail.group.id, member.id, "ghost")
                    }
                }
            },
        )
    }

    confirmBlock?.let { member ->
        AppSheet(
            onDismissRequest = { confirmBlock = null },
            title = strings.blockAccount,
            subtitle = strings.confirmQuestion,
            primaryLabel = strings.blockAccount,
            destructive = true,
            onPrimary = {
                confirmBlock = null
                store.blockMember(detail.group.id, member.id)
            },
            secondaryLabel = strings.cancel,
            onSecondary = { confirmBlock = null },
        )
    }

    if (confirmLeave) {
        AppSheet(
            onDismissRequest = { confirmLeave = false },
            title = strings.leaveGroup,
            subtitle = strings.confirmQuestion,
            primaryLabel = strings.leaveGroup,
            destructive = true,
            onPrimary = {
                confirmLeave = false
                store.leaveGroup(detail.group.id)
            },
            secondaryLabel = strings.cancel,
            onSecondary = { confirmLeave = false },
        )
    }

    linkTarget?.let { member ->
        LinkDialog(
            identities = store.identities,
            onDismiss = { linkTarget = null },
            onPick = { identity ->
                linkTarget = null
                store.linkMember(detail.group.id, member.id, identity.id)
            },
        )
    }
}

/** Attach a name without an account to a real account, keeping its history. */
@Composable
private fun LinkDialog(
    identities: List<OweIdentityDto>,
    onDismiss: () -> Unit,
    onPick: (OweIdentityDto) -> Unit,
) {
    val strings = LocalStrings.current
    var query by remember { mutableStateOf("") }
    val focus = remember { androidx.compose.ui.focus.FocusRequester() }
    LaunchedEffect(Unit) { focus.requestFocus() }
    val wanted = query.trim().lowercase()
    val matches = identities.filter { wanted.isNotEmpty() && it.displayName.lowercase().contains(wanted) }.take(6)
    AppSheet(
        onDismissRequest = onDismiss,
        title = strings.linkAccount,
        subtitle = strings.linkAccountNote,
        secondaryLabel = strings.cancel,
        onSecondary = onDismiss,
        content = {
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                label = { Text(strings.nameLabel) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words),
                modifier = Modifier.focusRequester(focus),
            )
            matches.forEach { identity ->
                SheetAction(label = identity.displayName) { onPick(identity) }
            }
        },
    )
}

/** Two ways to grow a group; only one of them is an invitation. */
@Composable
private fun AddPersonDialog(onDismiss: () -> Unit, onPick: (String) -> Unit) {
    val strings = LocalStrings.current
    AppFormSheet(
        onDismissRequest = onDismiss,
        title = { Text(strings.addPerson) },
        text = {
            val palette = LocalPalette.current
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Column {
                    TextButton(onClick = { onPick("account") }, modifier = Modifier.fillMaxWidth()) {
                        Text(strings.inviteWithAccount, modifier = Modifier.fillMaxWidth())
                    }
                    Text(
                        strings.inviteWithAccountNote,
                        fontSize = 11.sp,
                        color = palette.mutedForeground,
                    )
                }
                Column {
                    TextButton(onClick = { onPick("fictitious") }, modifier = Modifier.fillMaxWidth()) {
                        Text(strings.addWithoutAccount, modifier = Modifier.fillMaxWidth())
                    }
                    Text(
                        strings.addWithoutAccountNote,
                        fontSize = 11.sp,
                        color = palette.mutedForeground,
                    )
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text(strings.cancel) } },
    )
}

/** Invite a registered account (outside the group) or add a fictitious name. */
@Composable
private fun InviteDialog(
    mode: String,
    identities: List<OweIdentityDto>,
    onDismiss: () -> Unit,
    onInvite: (String, String?) -> Unit,
) {
    val strings = LocalStrings.current
    val palette = LocalPalette.current
    val account = mode == "account"
    var query by remember { mutableStateOf("") }
    val focus = remember { androidx.compose.ui.focus.FocusRequester() }
    LaunchedEffect(Unit) { focus.requestFocus() }
    val wanted = query.trim().lowercase()
    val matches = if (wanted.isEmpty()) {
        emptyList()
    } else {
        identities.filter { it.displayName.lowercase().contains(wanted) }.take(6)
    }
    AppFormSheet(
        onDismissRequest = onDismiss,
        title = { Text(if (account) strings.inviteWithAccount else strings.addWithoutAccount) },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    label = { Text(strings.nameLabel) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words),
                    modifier = Modifier.focusRequester(focus),
                )
                matches.forEach { identity ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(identity.displayName, modifier = Modifier.weight(1f), fontSize = 13.sp)
                        TextButton(onClick = { onInvite(identity.displayName, identity.id) }) {
                            Text(strings.invite)
                        }
                    }
                }
                if (!account && wanted.isNotEmpty() && matches.isEmpty()) {
                    Text(
                        "${strings.memberNoAccount}: ${query.trim()}",
                        fontSize = 11.sp,
                        color = palette.mutedForeground,
                    )
                }
                if (account && wanted.isEmpty()) {
                    Text(
                        strings.accountOptional,
                        fontSize = 11.sp,
                        color = palette.mutedForeground,
                    )
                }
            }
        },
        confirmButton = {
            if (account) {
                TextButton(onClick = onDismiss) { Text(strings.cancel) }
            } else {
                TextButton(
                    enabled = query.isNotBlank(),
                    onClick = { onInvite(query.trim(), null) },
                ) { Text(strings.add) }
            }
        },
        dismissButton = if (account) null else {
            { TextButton(onClick = onDismiss) { Text(strings.cancel) } }
        },
    )
}

@Composable
private fun Balances(
    balances: List<OweBalanceDto>,
    currency: String,
    locale: String,
    myMemberId: String?,
) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    // A row of zeroes is noise: the card lists only who owes or is owed.
    val pending = balances.filter { it.amountMinor != 0L }
    if (pending.isEmpty()) {
        Text(strings.settleEmpty, fontSize = 13.sp, color = palette.mutedForeground)
        return
    }
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(palette.surface, RoundedCornerShape(16.dp))
            .border(1.dp, palette.border, RoundedCornerShape(16.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        for (balance in pending) {
            Row {
                Text(balance.displayName, modifier = Modifier.weight(1f), fontSize = 13.sp)
                Text(
                    when {
                        balance.memberId == myMemberId && balance.amountMinor >= 0 ->
                            strings.owedToYou.replace("{amount}", formatMinor(balance.amountMinor, currency, locale))
                        balance.memberId == myMemberId ->
                            strings.youOwe.replace("{amount}", formatMinor(-balance.amountMinor, currency, locale))
                        balance.amountMinor >= 0 ->
                            strings.theyAreOwed
                                .replace("{name}", balance.displayName)
                                .replace("{amount}", formatMinor(balance.amountMinor, currency, locale))
                        else ->
                            strings.theyOweYou
                                .replace("{name}", balance.displayName)
                                .replace("{amount}", formatMinor(-balance.amountMinor, currency, locale))
                    },
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = if (balance.amountMinor >= 0) palette.accent else palette.destructive,
                )
            }
        }
    }
}

@Composable
private fun Movements(
    movements: List<OweMovementDto>,
    members: List<OweMemberDto>,
    currency: String,
    locale: String,
    myMemberId: String?,
    emptyText: String,
) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    if (movements.isEmpty()) {
        Text(emptyText, fontSize = 13.sp, color = palette.mutedForeground)
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
                Text(
                    if (movement.kind == "settlement") strings.settle else movement.description,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 13.sp,
                )
                val share = movement.shares.firstOrNull { it.memberId == myMemberId }?.amountMinor
                Text(
                    "${byId[movement.paidBy]?.displayName ?: ""} · ${formatDay(movement.occurredOn, locale)}" +
                        if (share != null && share > 0 && movement.kind == "expense") {
                            " · ${strings.yourShare.replace("{amount}", formatMinor(share, currency, locale))}"
                        } else {
                            ""
                        },
                    fontSize = 11.sp,
                    color = palette.mutedForeground,
                )
            }
            Text(formatMinor(movement.amountMinor, currency, locale), fontSize = 13.sp)
        }
    }
}

@Composable
private fun NewGroupDialog(onDismiss: () -> Unit, onCreate: (String, String) -> Unit) {
    val strings = LocalStrings.current
    var name by remember { mutableStateOf("") }
    var currency by remember { mutableStateOf("EUR") }
    val focus = remember { androidx.compose.ui.focus.FocusRequester() }
    LaunchedEffect(Unit) { focus.requestFocus() }
    AppFormSheet(
        onDismissRequest = onDismiss,
        title = { Text(strings.newGroup) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text(strings.groupName) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words),
                    modifier = Modifier.focusRequester(focus),
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
    categories: List<OweCategoryDto>,
    currency: String,
    locale: String,
    saving: Boolean,
    error: String?,
    onDismiss: () -> Unit,
    onSave: (String, Long, String, List<OweParticipantBody>, String, String?) -> Unit,
) {
    val strings = LocalStrings.current
    val palette = LocalPalette.current
    val active = members.filter { it.state == "active" }
    var description by remember { mutableStateOf("") }
    var amount by remember { mutableStateOf("") }
    var occurredOn by remember { mutableStateOf(LocalDate.now().toString()) }
    var categoryId by remember { mutableStateOf<String?>(null) }
    var payer by remember { mutableStateOf(active.firstOrNull()?.id) }
    var selected by remember { mutableStateOf(active.map { it.id }.toSet()) }
    var exact by remember { mutableStateOf(false) }
    var exactAmounts by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    var payerOpen by remember { mutableStateOf(false) }
    var splitOpen by remember { mutableStateOf(false) }
    val focus = remember { androidx.compose.ui.focus.FocusRequester() }
    val minor = parseMinor(amount)
    val total = minor ?: 0
    val exactSum = selected.sumOf { parseMinor(exactAmounts[it] ?: "") ?: 0L }
    val dateValid = runCatching { LocalDate.parse(occurredOn) }.isSuccess
    val exactReady = !exact || (selected.isNotEmpty() && exactSum == total)
    val participants = if (exact) {
        selected.map { OweParticipantBody(it, parseMinor(exactAmounts[it] ?: "") ?: 0L) }
    } else {
        selected.map { OweParticipantBody(it) }
    }
    val ready = description.isNotBlank() && minor != null && payer != null &&
        selected.isNotEmpty() && exactReady && dateValid && !saving

    LaunchedEffect(Unit) { focus.requestFocus() }

    AppFormSheet(
        onDismissRequest = onDismiss,
        title = { Text(strings.addExpense) },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                Text(
                    strings.withPeople.replace("{names}", active.joinToString(", ") { it.displayName }),
                    fontSize = 12.sp,
                    color = palette.mutedForeground,
                )
                // Description: a single quiet line, the first thing to fill.
                Column {
                    androidx.compose.foundation.text.BasicTextField(
                        value = description,
                        onValueChange = { description = it },
                        singleLine = true,
                        textStyle = androidx.compose.ui.text.TextStyle(
                            fontSize = 16.sp,
                            color = palette.foreground,
                        ),
                        cursorBrush = androidx.compose.ui.graphics.SolidColor(palette.accent),
                        keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                        modifier = Modifier
                            .fillMaxWidth()
                            .focusRequester(focus)
                            .padding(vertical = 6.dp),
                        decorationBox = { inner ->
                            androidx.compose.foundation.layout.Box {
                                if (description.isEmpty()) {
                                    Text(
                                        strings.description,
                                        fontSize = 16.sp,
                                        color = palette.mutedForeground,
                                    )
                                }
                                inner()
                            }
                        },
                    )
                    androidx.compose.material3.HorizontalDivider(color = palette.border)
                }
                // Amount: the number is the hero of this screen.
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(currencySymbol(currency), fontSize = 22.sp, color = palette.mutedForeground)
                    androidx.compose.foundation.text.BasicTextField(
                        value = amount,
                        onValueChange = { amount = it.filter { ch -> ch.isDigit() || ch == ',' || ch == '.' } },
                        singleLine = true,
                        textStyle = androidx.compose.ui.text.TextStyle(
                            fontSize = 26.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = palette.foreground,
                        ),
                        cursorBrush = androidx.compose.ui.graphics.SolidColor(palette.accent),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        modifier = Modifier
                            .weight(1f)
                            .padding(start = 8.dp, top = 4.dp, bottom = 4.dp),
                        decorationBox = { inner ->
                            androidx.compose.foundation.layout.Box {
                                if (amount.isEmpty()) {
                                    Text(
                                        formatMinor(0, currency, locale),
                                        fontSize = 26.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = palette.mutedForeground,
                                    )
                                }
                                inner()
                            }
                        },
                    )
                }
                androidx.compose.material3.HorizontalDivider(color = palette.border)
                if (error != null) {
                    Text(error, fontSize = 12.sp, color = palette.destructive)
                }

                // Payer and split: chips that read as a sentence.
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("${strings.paidBy} ", fontSize = 13.sp, color = palette.mutedForeground)
                    androidx.compose.foundation.layout.Box {
                        Chip(
                            label = active.firstOrNull { it.id == payer }?.displayName ?: "—",
                            open = true,
                            onClick = { payerOpen = true },
                        )
                        DropdownMenu(expanded = payerOpen, onDismissRequest = { payerOpen = false }) {
                            for (member in active) {
                                DropdownMenuItem(
                                    text = { Text(member.displayName) },
                                    onClick = {
                                        payer = member.id
                                        payerOpen = false
                                    },
                                )
                            }
                        }
                    }
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("${strings.splitWith} ", fontSize = 13.sp, color = palette.mutedForeground)
                    androidx.compose.foundation.layout.Box {
                        Chip(
                            label = if (exact) strings.splitExact else strings.splitEqually,
                            open = true,
                            onClick = { splitOpen = true },
                        )
                        DropdownMenu(expanded = splitOpen, onDismissRequest = { splitOpen = false }) {
                            DropdownMenuItem(
                                text = { Text(strings.splitEqually) },
                                onClick = {
                                    exact = false
                                    splitOpen = false
                                },
                            )
                            DropdownMenuItem(
                                text = { Text(strings.splitExact) },
                                onClick = {
                                    exact = true
                                    splitOpen = false
                                },
                            )
                        }
                    }
                }

                // Category as one scrollable row of chips.
                Text(strings.category, fontSize = 11.sp, color = palette.mutedForeground)
                Row(
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Chip(
                        label = strings.noCategory,
                        selected = categoryId == null,
                        onClick = { categoryId = null },
                    )
                    for (category in categories) {
                        Chip(
                            label = category.name,
                            selected = categoryId == category.id,
                            onClick = { categoryId = category.id },
                        )
                    }
                }

                // Participants, each with what they take.
                Text(strings.participants, fontSize = 11.sp, color = palette.mutedForeground)
                for (member in active) {
                    val checked = selected.contains(member.id)
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            .toggleable(
                                value = checked,
                                role = androidx.compose.ui.semantics.Role.Checkbox,
                            ) {
                                selected = if (checked) selected - member.id else selected + member.id
                            }
                            .heightIn(min = 44.dp)
                            .padding(vertical = 6.dp),
                    ) {
                        Box(
                            modifier = Modifier
                                .size(20.dp)
                                .background(
                                    if (checked) palette.accent else androidx.compose.ui.graphics.Color.Transparent,
                                    RoundedCornerShape(6.dp),
                                )
                                .border(1.dp, if (checked) palette.accent else palette.border, RoundedCornerShape(6.dp)),
                            contentAlignment = Alignment.Center,
                        ) {
                            if (checked) {
                                Text("✓", fontSize = 12.sp, color = palette.background)
                            }
                        }
                        Text(
                            member.displayName,
                            modifier = Modifier.weight(1f).padding(start = 10.dp),
                            fontSize = 14.sp,
                        )
                        if (checked && !exact && total > 0) {
                            val chosenList = active.filter { selected.contains(it.id) }
                            Text(
                                formatMinor(
                                    equalShare(total, chosenList.size, chosenList.indexOf(member)),
                                    currency,
                                    locale,
                                ),
                                fontSize = 12.sp,
                                color = palette.mutedForeground,
                            )
                        }
                    }
                    if (exact && checked) {
                        OutlinedTextField(
                            value = exactAmounts[member.id] ?: "",
                            onValueChange = { value -> exactAmounts = exactAmounts + (member.id to value) },
                            label = { Text(member.displayName) },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                }
                if (exact) {
                    Text(
                        "${formatMinor(exactSum, currency, locale)} / ${formatMinor(total, currency, locale)}",
                        fontSize = 11.sp,
                        color = if (exactReady) palette.mutedForeground else palette.destructive,
                    )
                }

                // Date last: it is usually today.
                OutlinedTextField(
                    value = occurredOn,
                    onValueChange = { occurredOn = it },
                    label = { Text(strings.date) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        },
        confirmButton = {
            Button(
                enabled = ready && !saving,
                onClick = {
                    onSave(description.trim(), minor!!, payer!!, participants, occurredOn, categoryId)
                },
                modifier = Modifier.heightIn(min = 44.dp),
                shape = RoundedCornerShape(14.dp),
            ) {
                if (saving) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        strokeWidth = 2.dp,
                        color = palette.primaryForeground,
                    )
                } else {
                    Text(strings.save, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(strings.cancel) } },
    )
}

/** A quiet inline selector: text plus a chevron, no boxed field. */
@Composable
private fun Chip(
    label: String,
    onClick: () -> Unit,
    selected: Boolean = false,
    open: Boolean = false,
) {
    val palette = LocalPalette.current
    Row(
        modifier = Modifier
            .background(
                if (selected) palette.accent.copy(alpha = 0.12f) else palette.muted,
                RoundedCornerShape(10.dp),
            )
            .border(
                1.dp,
                if (selected) palette.accent else palette.border,
                RoundedCornerShape(10.dp),
            )
            .clickable(onClick = onClick)
            .heightIn(min = 44.dp)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            label,
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
            color = if (selected) palette.accent else palette.foreground,
        )
        if (open) {
            Text("  ▾", fontSize = 11.sp, color = palette.mutedForeground)
        }
    }
}

/** "EUR" -> "€": the amount reads better with the symbol next to it. */
private fun currencySymbol(currency: String): String = when (currency.uppercase()) {
    "EUR" -> "€"
    "USD" -> "$"
    "GBP" -> "£"
    else -> currency.uppercase()
}

@Composable
private fun ManualPaymentDialog(
    members: List<OweMemberDto>,
    currency: String,
    saving: Boolean,
    onDismiss: () -> Unit,
    onSave: (String, String, Long, String) -> Unit,
) {
    val strings = LocalStrings.current
    val palette = LocalPalette.current
    val active = members.filter { it.state == "active" }
    var from by remember { mutableStateOf(active.firstOrNull()?.id) }
    var to by remember { mutableStateOf(active.drop(1).firstOrNull()?.id ?: active.firstOrNull()?.id) }
    var amount by remember { mutableStateOf("") }
    var day by remember { mutableStateOf(LocalDate.now().toString()) }
    val minor = parseMinor(amount)
    val dayValid = runCatching { LocalDate.parse(day) }.isSuccess

    AppFormSheet(
        onDismissRequest = onDismiss,
        title = { Text(strings.registerPayment) },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text("${strings.whoPays}:", fontSize = 12.sp)
                for (member in active) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.fillMaxWidth().clickable { from = member.id },
                    ) {
                        Checkbox(checked = from == member.id, onCheckedChange = { from = member.id })
                        Text(member.displayName, fontSize = 13.sp)
                    }
                }
                Text("${strings.whoReceives}:", fontSize = 12.sp)
                for (member in active) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.fillMaxWidth().clickable { to = member.id },
                    ) {
                        Checkbox(checked = to == member.id, onCheckedChange = { to = member.id })
                        Text(member.displayName, fontSize = 13.sp)
                    }
                }
                OutlinedTextField(
                    value = amount,
                    onValueChange = { amount = it },
                    label = { Text("${strings.amount} (${currency})") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                )
                OutlinedTextField(
                    value = day,
                    onValueChange = { day = it },
                    label = { Text(strings.date) },
                    isError = !dayValid,
                    singleLine = true,
                )
            }
        },
        confirmButton = {
            TextButton(
                enabled = minor != null && from != null && to != null && from != to && dayValid && !saving,
                onClick = { onSave(from!!, to!!, minor!!, day) },
            ) { Text(strings.save) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(strings.cancel) } },
    )
}

@Composable
private fun SettlementDialog(
    members: List<OweMemberDto>,
    myMemberId: String?,
    settlement: OweSettlementDto,
    currency: String,
    locale: String,
    saving: Boolean,
    onDismiss: () -> Unit,
    onPay: (String, String, Long) -> Unit,
) {
    val strings = LocalStrings.current
    val byId = members.associateBy { it.id }
    AppFormSheet(
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
                        Text(formatMinor(transfer.amountMinor, currency, locale), fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                        if (transfer.from == myMemberId) {
                            TextButton(
                                enabled = !saving,
                                onClick = { onPay(transfer.from, transfer.to, transfer.amountMinor) },
                            ) {
                                Text(strings.settle, fontSize = 11.sp)
                            }
                        }
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text(strings.cancel) } },
    )
}
