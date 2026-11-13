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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
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
import com.rferic.zero27apps.data.UserDto
import com.rferic.zero27apps.ui.InstancePickerDialog
import com.rferic.zero27apps.ui.i18n.LocalStrings
import com.rferic.zero27apps.ui.theme.LocalPalette

private val LOCALES = listOf("en", "es", "ca", "it", "fr", "de", "pt", "gl", "eu")
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
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(strings.language, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LOCALES.take(5).forEach { code ->
                    Chip(selected = user.locale == code, label = code) { onLocale(code) }
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LOCALES.drop(5).forEach { code ->
                    Chip(selected = user.locale == code, label = code) { onLocale(code) }
                }
            }
            Spacer(Modifier.size(2.dp))
            Text(strings.theme, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                THEMES.forEach { value ->
                    Chip(selected = user.theme == value, label = themeLabel(value)) {
                        onTheme(value)
                    }
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

        Text(strings.sessionNote, color = palette.mutedForeground, fontSize = 12.sp)
    }
}

@Composable
private fun Chip(selected: Boolean, label: String, onClick: () -> Unit) {
    val palette = LocalPalette.current
    FilterChip(
        selected = selected,
        onClick = onClick,
        label = { Text(label, fontSize = 12.sp) },
        colors = FilterChipDefaults.filterChipColors(
            selectedContainerColor = palette.muted,
            selectedLabelColor = palette.foreground,
            labelColor = palette.mutedForeground,
        ),
        border = FilterChipDefaults.filterChipBorder(
            enabled = true,
            selected = selected,
            borderColor = palette.border,
            selectedBorderColor = palette.border,
        ),
    )
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
