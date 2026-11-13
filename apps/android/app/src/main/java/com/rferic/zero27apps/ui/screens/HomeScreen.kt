package com.rferic.zero27apps.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rferic.zero27apps.data.ModuleDto
import com.rferic.zero27apps.data.UserDto
import com.rferic.zero27apps.ui.UpdateState
import com.rferic.zero27apps.ui.i18n.LocalStrings
import com.rferic.zero27apps.ui.theme.LocalPalette

/** Inicio: who you are and what you can open. Widgets arrive with the module host. */
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
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(strings.hello, style = MaterialTheme.typography.bodyMedium, color = palette.mutedForeground)
        UpdateBanner(update, onInstallUpdate)

        Text(
            user.displayName,
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
        )

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(palette.surface)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text(strings.yourAccount, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
            Text(user.role, color = palette.mutedForeground, fontSize = 13.sp)
            Text(
                "${modules.size} " + if (modules.size == 1) strings.moduleAvailable else strings.modulesAvailable,
                color = palette.mutedForeground,
                fontSize = 13.sp,
            )
        }

        if (modules.isEmpty()) {
            Text(
                strings.noModulesHome,
                color = palette.mutedForeground,
                fontSize = 13.sp,
            )
        } else {
            Text(strings.modules, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
            modules.forEach { module -> ModuleRow(module) }
        }
    }
}

/** A newer build is on the instance: download it and hand it to the installer. */
@Composable
private fun UpdateBanner(update: UpdateState, onInstall: () -> Unit) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    val text = when (update) {
        UpdateState.None, is UpdateState.Available -> null
        UpdateState.Downloading -> strings.updateDownloading
        UpdateState.Installing -> strings.updateInstalling
        UpdateState.Failed -> strings.updateFailed
    }
    if (update is UpdateState.Available) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(palette.successSubtle)
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
    if (text != null) {
        Text(text, color = palette.mutedForeground, fontSize = 12.sp)
    }
}

@Composable
fun ModuleRow(module: ModuleDto) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(palette.surface)
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            module.name.take(1).uppercase(),
            modifier = Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(palette.muted)
                .padding(9.dp),
            color = palette.accent,
            fontWeight = FontWeight.Bold,
        )
        Column {
            Text(module.name, fontWeight = FontWeight.SemiBold)
            Text("v${module.version}", color = palette.mutedForeground, fontSize = 12.sp)
        }
    }
    Spacer(Modifier.height(2.dp))
}
