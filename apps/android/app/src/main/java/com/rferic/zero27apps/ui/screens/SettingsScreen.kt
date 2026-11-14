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
    update: UpdateState,
    onCheckUpdates: () -> Unit,
    onInstallUpdate: () -> Unit,
    onTheme: (String) -> Unit,
    onLocale: (String) -> Unit,
    onSignOut: () -> Unit,
) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    var showPicker by rememberSaveable { mutableStateOf(false) }

    if (showPicker) {
        InstancePickerDialog(
            known = knownInstances,
            current = instance,
            onAdd = onRememberInstance,
            onPick = { url ->
                showPicker = false
                onChangeInstance(url)
            },
            onDismiss = { showPicker = false },
        )
    }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Text(
            strings.settings,
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold,
            color = palette.foreground,
        )

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
            Column(Modifier.weight(1f)) {
                Text(strings.instance, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                Text(instance, color = palette.mutedForeground, fontSize = 12.sp)
            }
            Text(strings.change, color = palette.accent, fontSize = 13.sp)
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
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(strings.version, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                    Text(
                        "${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})" +
                            if (BuildConfig.DEBUG) " · ${strings.debugBuild}" else "",
                        color = palette.mutedForeground,
                        fontSize = 12.sp,
                    )
                }
                when (update) {
                    is UpdateState.Available -> Button(onClick = onInstallUpdate) {
                        Text("${strings.updateInstall} · v${update.version}", fontSize = 12.sp)
                    }
                    UpdateState.Downloading -> Text(strings.updateDownloading, fontSize = 12.sp, color = palette.mutedForeground)
                    UpdateState.Installing -> Text(strings.updateInstalling, fontSize = 12.sp, color = palette.mutedForeground)
                    UpdateState.Checking -> Text(strings.checking, fontSize = 12.sp, color = palette.mutedForeground)
                    UpdateState.UpToDate -> Text(strings.upToDate, fontSize = 12.sp, color = palette.mutedForeground)
                    UpdateState.Failed -> Text(strings.updateFailed, fontSize = 12.sp, color = palette.destructive)
                    UpdateState.None -> TextButton(onClick = onCheckUpdates) { Text(strings.checkUpdates, fontSize = 12.sp) }
                }
            }
        }

        // Sign out
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(palette.surface, RoundedCornerShape(16.dp))
                .border(1.dp, palette.border, RoundedCornerShape(16.dp))
                .clickable { onSignOut() }
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

        Row(
            modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            BrandWordmark(height = 18.dp)
            Spacer(Modifier.weight(1f))
            Text(
                "${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})" +
                    if (BuildConfig.DEBUG) " · ${strings.debugBuild}" else "",
                fontSize = 12.sp,
                color = palette.mutedForeground,
            )
        }
        Text(strings.sessionNote, color = palette.mutedForeground, fontSize = 12.sp)
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
