package com.rferic.zero27apps.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.border
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.getValue
import androidx.compose.ui.platform.LocalContext
import androidx.compose.runtime.remember
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rferic.zero27apps.data.ModuleDto
import com.rferic.zero27apps.data.WidgetDto
import com.rferic.zero27apps.data.UserDto
import com.rferic.zero27apps.ui.UpdateState
import androidx.compose.material3.Surface
import com.rferic.zero27apps.ui.i18n.LocalStrings
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonPrimitive
import com.rferic.zero27apps.ui.theme.LocalPalette

/**
 * Inicio: who you are and what you can open. The mockup's widget cards become
 * one card per module until the widget host lands.
 */
@Composable
fun HomeScreen(
    user: UserDto,
    modules: List<ModuleDto>,
    widgets: List<WidgetDto>,
    update: UpdateState,
    onInstallUpdate: () -> Unit,
    onOpenModule: (String) -> Unit = {},
    onAddExpense: () -> Unit = {},
    clubCard: @Composable () -> Unit = {},
) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Avatar(name = user.displayName)
            Spacer(Modifier.size(12.dp))
            Column {
                Text(
                    strings.hello,
                    fontSize = 13.sp,
                    color = palette.mutedForeground,
                )
                Text(
                    user.displayName,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = palette.foreground,
                )
            }
            Spacer(Modifier.weight(1f))
            com.rferic.zero27apps.ui.components.PrivacyEye()
        }

        Text(
            strings.mySpace.uppercase(),
            fontSize = 11.sp,
            letterSpacing = 1.sp,
            fontWeight = FontWeight.SemiBold,
            color = palette.mutedForeground,
        )

        UpdateBanner(update, onInstallUpdate)

        clubCard()

        when {
            // A module that contributes a widget takes the home; the modules
            // without one stay reachable from the Módulos tab.
            widgets.isNotEmpty() -> for (widget in widgets) {
                val open = { widget.moduleKey?.let(onOpenModule) ?: Unit }
                if (widget.moduleKey == "owe-no") {
                    OweNoHomeCard(onOpen = open, onAddExpense = onAddExpense)
                } else {
                    WidgetCard(widget, onOpen = open)
                }
            }
            modules.isEmpty() -> Text(strings.noModulesHome, color = palette.mutedForeground, fontSize = 13.sp)
            else -> for (module in modules) ModuleCard(module, onClick = { onOpenModule(module.key) })
        }
    }
}

@Composable
private fun Avatar(name: String) {
    val palette = LocalPalette.current
    Box(
        modifier = Modifier
            .size(44.dp)
            .background(palette.accent, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            name.trim().take(1).uppercase().ifEmpty { "?" },
            color = palette.background,
            fontWeight = FontWeight.Bold,
            fontSize = 18.sp,
        )
    }
}

/** One module tile, as the mockup's dashboard card: icon, name, version. */
@Composable
private fun ModuleCard(module: ModuleDto, onClick: () -> Unit = {}) {
    val palette = LocalPalette.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .background(palette.surface, RoundedCornerShape(16.dp))
            .border(1.dp, palette.border, RoundedCornerShape(16.dp))
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .background(palette.successSubtle, RoundedCornerShape(12.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                module.name.take(1).uppercase(),
                color = palette.accent,
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp,
            )
        }
        Column(Modifier.weight(1f)) {
            Text(module.name, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
            Text("v${module.version}", color = palette.mutedForeground, fontSize = 12.sp)
        }
    }
}

/** A newer build is on the instance: download it and hand it to the installer. */
@Composable
private fun UpdateBanner(update: UpdateState, onInstall: () -> Unit) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    if (update is UpdateState.Available) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(palette.successSubtle, RoundedCornerShape(16.dp))
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    "${strings.updateAvailable} · v${update.version}",
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 13.sp,
                )
            }
            Button(onClick = onInstall) { Text(strings.updateInstall) }
        }
    }
    val note = when (update) {
        UpdateState.Checking -> strings.checking
        UpdateState.UpToDate -> strings.upToDate
        UpdateState.Downloading -> strings.updateDownloading
        UpdateState.Installing -> strings.updateInstalling
        UpdateState.Failed -> strings.updateFailed
        else -> null
    }
    if (note != null) {
        Text(note, color = palette.mutedForeground, fontSize = 12.sp)
    }
}

/** The shape every widget resolves to: `{ value, label?, detail? }`. */
private data class WidgetValue(val value: String, val label: String?, val detail: String?)

private fun widgetValue(widget: WidgetDto): WidgetValue? {
    val data = widget.data as? JsonObject ?: return null
    val value: JsonPrimitive = data["value"]?.jsonPrimitive ?: return null
    if (value.isString && value.content.isBlank()) return null
    return WidgetValue(
        value = value.content,
        label = (data["label"] as? JsonPrimitive)?.content?.takeIf { it.isNotBlank() },
        detail = (data["detail"] as? JsonPrimitive)?.content?.takeIf { it.isNotBlank() },
    )
}

/** One dashboard card, rendered natively: the module never sends HTML. */
@Composable
private fun WidgetCard(widget: WidgetDto, onOpen: () -> Unit) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    val resolved = widgetValue(widget)
    val copy = widgetCopy(widget, resolved)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onOpen)
            .background(palette.surface, RoundedCornerShape(16.dp))
            .border(1.dp, palette.border, RoundedCornerShape(16.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .background(palette.successSubtle, RoundedCornerShape(10.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    copy.title.take(1).uppercase().ifEmpty { "•" },
                    color = palette.accent,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                )
            }
            Text(copy.title, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            Spacer(Modifier.weight(1f))
            Text(
                strings.widgetBadge,
                fontSize = 10.sp,
                letterSpacing = 0.6.sp,
                color = palette.mutedForeground,
                modifier = Modifier
                    .background(palette.muted, RoundedCornerShape(999.dp))
                    .padding(horizontal = 8.dp, vertical = 3.dp),
            )
        }
        if (resolved != null) {
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    resolved.value,
                    fontSize = 30.sp,
                    fontWeight = FontWeight.Bold,
                    color = palette.foreground,
                )
                if (copy.label != null) {
                    Text(
                        copy.label,
                        fontSize = 12.sp,
                        color = palette.mutedForeground,
                        modifier = Modifier.padding(bottom = 5.dp),
                    )
                }
            }
            if (copy.detail != null) {
                Text(copy.detail, fontSize = 12.sp, color = palette.mutedForeground)
            }
        } else {
            Text("—", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = palette.mutedForeground)
        }
    }
}

/**
 * OweNo lives on the home with the two numbers that matter (what you owe and
 * what you are owed) and the groups that move them, from the same encrypted
 * snapshot the launcher widget uses.
 */
@Composable
private fun OweNoHomeCard(onOpen: () -> Unit, onAddExpense: () -> Unit) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    val privacyMasked = com.rferic.zero27apps.ui.privacy.LocalPrivacyMasked.current
    val context = LocalContext.current
    val store = remember { com.rferic.zero27apps.widget.WidgetSnapshotStore(context) }
    var snapshot by remember { mutableStateOf(store.read()) }
    LaunchedEffect(Unit) {
        val before = store.read().updatedAt
        com.rferic.zero27apps.widget.OweWidgetWorker.refreshNow(context)
        // The worker runs off the main thread and, on a cold start, makes a
        // handful of calls: wait for it to write instead of guessing a delay.
        repeat(12) {
            kotlinx.coroutines.delay(500)
            if (store.read().updatedAt != before) return@LaunchedEffect
        }
        snapshot = store.read()
    }
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onOpen)
            .background(palette.surface, RoundedCornerShape(16.dp))
            .border(1.dp, palette.border, RoundedCornerShape(16.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(
                modifier = Modifier.size(32.dp).background(palette.successSubtle, RoundedCornerShape(10.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Text("€", color = palette.accent, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }
            Text("OweNo", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            Spacer(Modifier.weight(1f))
            Row(
                modifier = Modifier
                    .background(palette.accent.copy(alpha = 0.12f), RoundedCornerShape(10.dp))
                    .clickable(onClick = onAddExpense)
                    .padding(horizontal = 10.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("+", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = palette.accent)
                Spacer(Modifier.size(6.dp))
                Text(strings.addExpenseShort, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = palette.accent)
            }
            Spacer(Modifier.size(8.dp))
            Text("›", fontSize = 18.sp, color = palette.mutedForeground)
        }
        if (snapshot.totals.size > 1) {
            // One line per currency: euros and pounds are never added together.
            Row(horizontalArrangement = Arrangement.spacedBy(24.dp)) {
                for (total in snapshot.totals) {
                    Column {
                        Text(total.currency, fontSize = 11.sp, color = palette.mutedForeground)
                        Text(
                            moneyText(total.netMinor, total.currency, snapshot.locale, privacyMasked),
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (total.netMinor >= 0) palette.accent else palette.destructive,
                        )
                    }
                }
            }
        } else {
            Row(horizontalArrangement = Arrangement.spacedBy(24.dp)) {
                Column {
                    Text(strings.owedToYouLabel, fontSize = 11.sp, color = palette.mutedForeground)
                    Text(
                        moneyText(snapshot.owedToYouMinor, snapshot.currency, snapshot.locale, privacyMasked),
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (snapshot.owedToYouMinor > 0) palette.accent else palette.mutedForeground,
                    )
                }
                Column {
                    Text(strings.youOweLabel, fontSize = 11.sp, color = palette.mutedForeground)
                    Text(
                        moneyText(snapshot.youOweMinor, snapshot.currency, snapshot.locale, privacyMasked),
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (snapshot.youOweMinor > 0) palette.destructive else palette.mutedForeground,
                    )
                }
            }
        }
        if (snapshot.groups.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                for (group in snapshot.groups.subList(0, minOf(3, snapshot.groups.size))) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(group.name, modifier = Modifier.weight(1f), fontSize = 13.sp)
                        Text(
                            moneyText(group.amountMinor, snapshot.currency, snapshot.locale, privacyMasked),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = if (group.amountMinor < 0) palette.destructive else palette.accent,
                        )
                    }
                }
            }
        } else {
            Text(strings.activityEmpty, fontSize = 12.sp, color = palette.mutedForeground)
        }
        val last = snapshot.lastDescription
        if (last != null) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "${strings.lastActivity}: $last",
                    modifier = Modifier.weight(1f),
                    fontSize = 12.sp,
                    color = palette.mutedForeground,
                    maxLines = 1,
                )
                Text(
                    moneyText(snapshot.lastAmountMinor, snapshot.currency, snapshot.locale, privacyMasked),
                    fontSize = 12.sp,
                    color = palette.mutedForeground,
                )
            }
        }
    }
}

private fun moneyText(
    amountMinor: Long,
    currency: String,
    locale: String = "en",
    masked: Boolean = false,
): String = if (masked) {
    "••• ${com.rferic.zero27apps.ui.privacy.currencySymbol(currency)}"
} else runCatching {
        java.text.NumberFormat.getCurrencyInstance(java.util.Locale.forLanguageTag(locale)).apply {
            this.currency = java.util.Currency.getInstance(currency)
        }.format(amountMinor / 100.0)
    }.getOrDefault("${amountMinor / 100.0} $currency")

/** The server sends widget text in English: our own modules get a local copy. */
private data class WidgetCopy(val title: String, val label: String?, val detail: String?)

@Composable
private fun widgetCopy(widget: WidgetDto, resolved: WidgetValue?): WidgetCopy {
    val strings = LocalStrings.current
    val key = widget.key
    return when {
        key.startsWith("owe-no") || key.contains("groups") -> WidgetCopy(
            title = "OweNo",
            label = if (resolved?.value == "1") strings.groupOne else strings.groupMany,
            detail = null,
        )
        key.startsWith("todo") -> WidgetCopy(
            title = strings.widgetTasksTitle,
            label = when (resolved?.value) {
                "1" -> strings.widgetTaskOne
                else -> strings.widgetTaskMany
            },
            detail = if (resolved?.value == "0") strings.widgetNothingPending else null,
        )
        key.contains("notes") -> WidgetCopy(
            title = strings.notesTitle,
            label = if (resolved?.value == "1") strings.noteOne else strings.noteMany,
            detail = null,
        )
        else -> WidgetCopy(
            title = widget.title,
            label = resolved?.label,
            detail = resolved?.detail,
        )
    }
}
