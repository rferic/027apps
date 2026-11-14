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

        when {
            // A module that contributes a widget takes the home; the modules
            // without one stay reachable from the Módulos tab.
            widgets.isNotEmpty() -> for (widget in widgets) WidgetCard(widget)
            modules.isEmpty() -> Text(strings.noModulesHome, color = palette.mutedForeground, fontSize = 13.sp)
            else -> for (module in modules) ModuleCard(module)
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
private fun WidgetCard(widget: WidgetDto) {
    val palette = LocalPalette.current
    val resolved = widgetValue(widget)
    Column(
        modifier = Modifier
            .fillMaxWidth()
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
                    widget.title.take(1).uppercase().ifEmpty { "•" },
                    color = palette.accent,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                )
            }
            Text(widget.title, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            Spacer(Modifier.weight(1f))
            Text(
                "WIDGET",
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
                if (resolved.label != null) {
                    Text(
                        resolved.label,
                        fontSize = 12.sp,
                        color = palette.mutedForeground,
                        modifier = Modifier.padding(bottom = 5.dp),
                    )
                }
            }
            if (resolved.detail != null) {
                Text(resolved.detail, fontSize = 12.sp, color = palette.mutedForeground)
            }
        } else {
            Text("—", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = palette.mutedForeground)
        }
    }
}
