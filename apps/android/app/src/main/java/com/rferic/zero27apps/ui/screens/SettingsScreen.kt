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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rferic.zero27apps.BuildConfig
import com.rferic.zero27apps.ui.components.BrandWordmark
import com.rferic.zero27apps.data.UserDto
import com.rferic.zero27apps.ui.InstancePickerDialog
import com.rferic.zero27apps.ui.UpdateState
import com.rferic.zero27apps.ui.i18n.LocalStrings
import com.rferic.zero27apps.ui.theme.LocalPalette

/** Endonyms: a language is listed in its own language, never as an ISO code. */
private val LOCALE_NAMES = listOf(
    "en" to "English",
    "es" to "Español",
    "ca" to "Català",
    "it" to "Italiano",
    "fr" to "Français",
    "de" to "Deutsch",
    "pt" to "Português",
    "gl" to "Galego",
    "eu" to "Euskara",
)
private val THEMES = listOf("system", "light", "dark")

/**
 * Ajustes, as the mockup: a profile card, the instance row, language and theme
 * as segmented choices, and the way out in red.
 */
@Composable
fun SettingsScreen(
    instance: String,
    knownInstances: List<String>,
    user: UserDto,
    onRememberInstance: (String) -> String?,
    onChangeInstance: (String) -> Boolean,
    onForgetInstance: (String) -> Unit,
    update: UpdateState,
    pushStatus: String? = null,
    onRetryPush: () -> Unit = {},
    lastCheckAt: Long? = null,
    onCheckUpdates: () -> Unit,
    onInstallUpdate: () -> Unit,
    onTheme: (String) -> Unit,
    onLocale: (String) -> Unit,
    onMigrate: () -> Unit,
    onSignOut: () -> Unit,
) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    var showPicker by rememberSaveable { mutableStateOf(false) }
    var confirmSignOut by rememberSaveable { mutableStateOf(false) }
    var showChangelog by rememberSaveable { mutableStateOf(false) }

    if (showPicker) {
        InstancePickerDialog(
            known = knownInstances,
            current = instance,
            onAdd = onRememberInstance,
            onPick = { url ->
                showPicker = false
                onChangeInstance(url)
            },
            onRemove = onForgetInstance,
            onDismiss = { showPicker = false },
        )
    }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                strings.settings,
                fontSize = 26.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.weight(1f),
            )
            com.rferic.zero27apps.ui.components.PrivacyEye()
        }

        // Profile
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(palette.surface, RoundedCornerShape(16.dp))
                .border(1.dp, palette.border, RoundedCornerShape(16.dp))
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Box(
                modifier = Modifier.size(44.dp).background(palette.accent, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    user.displayName.take(1).uppercase().ifEmpty { "?" },
                    color = palette.background,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                )
            }
            Column {
                Text(user.displayName, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                Text(user.role, color = palette.mutedForeground, fontSize = 12.sp)
            }
        }

        // Instance
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(palette.surface, RoundedCornerShape(16.dp))
                .border(1.dp, palette.border, RoundedCornerShape(16.dp))
                .clickable { showPicker = true }
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // The URL gets its own block: at 200 % text size it must not fight
            // the "Cambiar" action for the same line.
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(strings.instance, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                Text(instance, color = palette.mutedForeground, fontSize = 12.sp)
                Text(strings.change, color = palette.accent, fontSize = 13.sp)
            }
            Icon(
                Icons.Filled.KeyboardArrowRight,
                contentDescription = null,
                tint = palette.mutedForeground,
            )
        }

        // Language and theme
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(palette.surface, RoundedCornerShape(16.dp))
                .border(1.dp, palette.border, RoundedCornerShape(16.dp))
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            SelectRow(
                title = strings.language,
                value = user.locale,
                options = LOCALE_NAMES.map { (code, name) -> code to name },
                onSelect = onLocale,
            )
            SelectRow(
                title = strings.theme,
                value = user.theme,
                options = THEMES.map { value -> value to themeLabel(value) },
                onSelect = onTheme,
            )
        }

        // App version and updates
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(palette.surface, RoundedCornerShape(16.dp))
                .border(1.dp, palette.border, RoundedCornerShape(16.dp))
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(strings.version, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            // The build string gets its own full-width line so it never wraps into
            // the status or the action next to it.
            Text(
                "${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})" +
                    if (BuildConfig.DEBUG) " · ${strings.debugBuild}" else "",
                color = palette.mutedForeground,
                fontSize = 12.sp,
            )
            when (update) {
                is UpdateState.Available -> Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        strings.newVersion.replace("{version}", update.version),
                        modifier = Modifier.weight(1f),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = palette.accent,
                    )
                    Button(onClick = onInstallUpdate, shape = RoundedCornerShape(12.dp)) {
                        Text(strings.updateInstall, fontSize = 12.sp)
                    }
                }
                UpdateState.Downloading -> Text(strings.updateDownloading, fontSize = 12.sp, color = palette.mutedForeground)
                UpdateState.Installing -> Text(strings.updateInstalling, fontSize = 12.sp, color = palette.mutedForeground)
                UpdateState.Checking -> Text(strings.checking, fontSize = 12.sp, color = palette.mutedForeground)
                UpdateState.UpToDate -> Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        strings.upToDate,
                        modifier = Modifier.weight(1f),
                        fontSize = 12.sp,
                        color = palette.mutedForeground,
                    )
                    // A second check right after the first is noise; after a minute
                    // it is a normal thing to want.
                    val canRecheck = lastCheckAt == null ||
                        System.currentTimeMillis() - lastCheckAt > 60_000
                    if (canRecheck) {
                        TextButton(onClick = onCheckUpdates) { Text(strings.recheck, fontSize = 12.sp) }
                    }
                }
                UpdateState.Failed -> Text(strings.updateFailed, fontSize = 12.sp, color = palette.destructive)
                UpdateState.None -> TextButton(onClick = onCheckUpdates) { Text(strings.checkUpdates, fontSize = 12.sp) }
            }
        }

        // Push registration: the one thing that cannot be checked from the server
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(palette.surface, RoundedCornerShape(16.dp))
                .border(1.dp, palette.border, RoundedCornerShape(16.dp))
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(strings.notifications, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                Text(
                    when (pushStatus) {
                        "ok" -> strings.pushReady
                        "registering" -> strings.checking
                        "no_session" -> strings.pushNoSession
                        null -> strings.pushUnknown
                        else -> pushStatus
                    },
                    color = if (pushStatus == "ok") palette.accent else palette.mutedForeground,
                    fontSize = 12.sp,
                )
            }
            TextButton(onClick = onRetryPush) { Text(strings.recheck, fontSize = 12.sp) }
        }

        // What changed in this and previous versions
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(palette.surface, RoundedCornerShape(16.dp))
                .border(1.dp, palette.border, RoundedCornerShape(16.dp))
                .clickable { showChangelog = true }
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(strings.changelog, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                Text(strings.changelogNote, color = palette.mutedForeground, fontSize = 12.sp)
            }
            Text("›", fontSize = 18.sp, color = palette.mutedForeground)
        }

        // Move the account to a new phone
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(palette.surface, RoundedCornerShape(16.dp))
                .border(1.dp, palette.border, RoundedCornerShape(16.dp))
                .clickable(onClick = onMigrate)
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Column(Modifier.weight(1f)) {
                Text(strings.migrationTitle, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                Text(strings.migrationSettingsNote, color = palette.mutedForeground, fontSize = 12.sp)
            }
            Icon(Icons.Filled.KeyboardArrowRight, contentDescription = null, tint = palette.mutedForeground)
        }

        // Sign out
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(palette.surface, RoundedCornerShape(16.dp))
                .border(1.dp, palette.border, RoundedCornerShape(16.dp))
                .clickable { confirmSignOut = true }
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Icon(Icons.Filled.ExitToApp, contentDescription = null, tint = palette.destructive)
            Text(
                strings.signOut,
                color = palette.destructive,
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
            )
        }

        Row(modifier = Modifier.fillMaxWidth().padding(top = 10.dp)) {
            BrandWordmark(height = 18.dp)
        }
        Text(strings.sessionNote, color = palette.mutedForeground, fontSize = 12.sp)
    }

    if (showChangelog) {
        val locale = user.locale ?: "en"
        com.rferic.zero27apps.ui.components.AppSheet(
            onDismissRequest = { showChangelog = false },
            title = strings.changelog,
            subtitle = strings.changelogNote,
            secondaryLabel = strings.close,
            onSecondary = { showChangelog = false },
            content = {
                for (entry in com.rferic.zero27apps.Changelog.entries) {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(
                            "v${entry.version} · ${entry.date}",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = if (entry.version == BuildConfig.VERSION_NAME) palette.accent else palette.foreground,
                        )
                        for (note in com.rferic.zero27apps.Changelog.notesFor(entry, locale)) {
                            Text("• $note", fontSize = 12.sp, color = palette.mutedForeground)
                        }
                    }
                }
            },
        )
    }

    if (confirmSignOut) {
        com.rferic.zero27apps.ui.components.AppSheet(
            onDismissRequest = { confirmSignOut = false },
            title = strings.signOut,
            subtitle = strings.confirmQuestion,
            primaryLabel = strings.signOut,
            destructive = true,
            onPrimary = {
                confirmSignOut = false
                onSignOut()
            },
            secondaryLabel = strings.cancel,
            onSecondary = { confirmSignOut = false },
        )
    }
}

/** Label on the left, a bordered select on the right (the mockup's row). */
@Composable
private fun SelectRow(
    title: String,
    value: String,
    options: List<Pair<String, String>>,
    onSelect: (String) -> Unit,
) {
    val palette = LocalPalette.current
    val label = options.firstOrNull { it.first == value }?.second ?: value
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(
            title,
            fontWeight = FontWeight.SemiBold,
            fontSize = 14.sp,
            color = palette.foreground,
            modifier = Modifier.weight(1f),
        )
        Select(label = label, options = options, onSelect = onSelect)
    }
}

/** A compact select: bordered field plus a drop-down list of full names. */
@Composable
private fun Select(
    label: String,
    options: List<Pair<String, String>>,
    onSelect: (String) -> Unit,
) {
    val palette = LocalPalette.current
    var expanded by rememberSaveable { mutableStateOf(false) }
    Box {
        Row(
            modifier = Modifier
                .clip(RoundedCornerShape(12.dp))
                .border(1.dp, palette.border, RoundedCornerShape(12.dp))
                .clickable { expanded = true }
                .padding(horizontal = 12.dp, vertical = 9.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(label, fontSize = 13.sp, color = palette.foreground)
            Spacer(Modifier.size(6.dp))
            Icon(
                Icons.Filled.KeyboardArrowDown,
                contentDescription = null,
                tint = palette.mutedForeground,
                modifier = Modifier.size(18.dp),
            )
        }
        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
            containerColor = palette.surface,
        ) {
            options.forEach { (value, name) ->
                DropdownMenuItem(
                    text = { Text(name, fontSize = 13.sp) },
                    onClick = {
                        expanded = false
                        onSelect(value)
                    },
                )
            }
        }
    }
}

@Composable
private fun themeLabel(value: String): String {
    val strings = LocalStrings.current
    return when (value) {
        "light" -> strings.themeLight
        "dark" -> strings.themeDark
        else -> strings.themeSystem
    }
}
