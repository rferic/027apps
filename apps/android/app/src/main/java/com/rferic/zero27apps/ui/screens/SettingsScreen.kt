package com.rferic.zero27apps.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rferic.zero27apps.data.UserDto
import com.rferic.zero27apps.ui.InstancePickerDialog
import com.rferic.zero27apps.ui.theme.LocalPalette

private val LOCALES = listOf("en", "es", "ca", "it", "fr", "de", "pt", "gl", "eu")
private val THEMES = listOf("system", "light", "dark")

/**
 * Ajustes: language, theme, the instance and the way out. The theme and the
 * locale are the profile's own fields, so they follow the user across devices.
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
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text("Settings", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)

        Section("Theme") {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                THEMES.forEach { value ->
                    FilterChip(
                        selected = user.theme == value,
                        onClick = { onTheme(value) },
                        label = { Text(value.replaceFirstChar { it.uppercase() }) },
                    )
                }
            }
        }

        Section("Language") {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LOCALES.forEach { code ->
                    FilterChip(
                        selected = user.locale == code,
                        onClick = { onLocale(code) },
                        label = { Text(code) },
                    )
                }
            }
        }

        Section("Instance") {
            Text(instance, color = palette.mutedForeground, fontSize = 12.sp)
            Button(onClick = { showPicker = true }) { Text("Change instance") }
            TextButton(onClick = onSignOut) { Text("Sign out") }
        }

        Text(
            "Signed in as ${user.displayName}",
            color = palette.mutedForeground,
            fontSize = 12.sp,
        )
    }
}

@Composable
private fun Section(title: String, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
        content()
    }
}
