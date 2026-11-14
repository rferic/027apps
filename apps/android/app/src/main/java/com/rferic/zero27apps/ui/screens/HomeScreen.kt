package com.rferic.zero27apps.ui.screens

import androidx.compose.foundation.background
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rferic.zero27apps.data.ModuleDto
import com.rferic.zero27apps.data.UserDto
import com.rferic.zero27apps.ui.UpdateState
import com.rferic.zero27apps.ui.i18n.LocalStrings
import com.rferic.zero27apps.ui.theme.LocalPalette

/**
 * Inicio: who you are and what you can open. The mockup's widget cards become
 * one card per module until the widget host lands.
 */
@Composable
fun HomeScreen(
    user: UserDto,
    modules: List<ModuleDto>,
    update: UpdateState,
    onInstallUpdate: () -> Unit,
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
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .border(1.dp, palette.border, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Filled.Notifications,
                    contentDescription = null,
                    tint = palette.foreground,
                    modifier = Modifier.size(20.dp),
                )
            }
        }

        Text(
            strings.mySpace.uppercase(),
            fontSize = 11.sp,
            letterSpacing = 1.sp,
            fontWeight = FontWeight.SemiBold,
            color = palette.mutedForeground,
        )

        UpdateBanner(update, onInstallUpdate)

        if (modules.isEmpty()) {
            Text(strings.noModulesHome, color = palette.mutedForeground, fontSize = 13.sp)
        } else {
            for (module in modules) ModuleCard(module)
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
private fun ModuleCard(module: ModuleDto) {
    val palette = LocalPalette.current
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
