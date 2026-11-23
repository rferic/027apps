package com.rferic.zero27apps.ui.screens

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import coil.compose.SubcomposeAsyncImage
import coil.request.ImageRequest
import com.rferic.zero27apps.FcmRegistrar
import com.rferic.zero27apps.data.ApiClient
import com.rferic.zero27apps.data.NotificationGroupDto
import com.rferic.zero27apps.data.NotificationPreferencesBody
import com.rferic.zero27apps.data.NotificationPreferencesDto
import com.rferic.zero27apps.data.NotificationTypeDto
import com.rferic.zero27apps.ui.i18n.LocalStrings
import com.rferic.zero27apps.ui.i18n.Strings
import com.rferic.zero27apps.ui.theme.LocalPalette
import kotlinx.coroutines.launch

/**
 * Ajustes → Notificaciones, as the approved mockup: the master switch, the
 * general notifications of the instance and one collapsible section per module
 * with its logo and a switch that marks or clears all of its types. The server
 * is the source of truth: every change is saved there, because a mute only
 * counts when the sender stops before spending FCM quota.
 */
@Composable
fun NotificationsScreen(
    api: ApiClient,
    token: String?,
    pushStatus: String?,
    onRetryPush: () -> Unit,
    onBack: () -> Unit,
    iconUrl: (String) -> String? = { null },
) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    // Re-read after a retry: a successful registration turns a null id into one.
    val deviceId = remember(pushStatus) { FcmRegistrar(context).deviceId() }
    var prefs by remember { mutableStateOf<NotificationPreferencesDto?>(null) }
    var loading by remember { mutableStateOf(deviceId != null) }
    var saving by remember { mutableStateOf(false) }
    var errorText by remember { mutableStateOf<String?>(null) }
    var expanded by remember { mutableStateOf<Set<String>>(emptySet()) }

    var allowed by remember { mutableStateOf(notificationsAllowed(context)) }
    val permission = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted -> allowed = granted }

    // Coming back from the Android settings must refresh the truth, not keep
    // showing a stale "blocked" line.
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) allowed = notificationsAllowed(context)
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    suspend fun load() {
        val id = deviceId ?: return
        loading = true
        errorText = null
        runCatching { api.notificationPreferences(id) }
            .onSuccess { prefs = it }
            .onFailure { errorText = strings.notificationsLoadFailed }
        loading = false
    }

    LaunchedEffect(deviceId) {
        if (deviceId != null) load()
    }

    fun save(next: NotificationPreferencesDto) {
        val id = deviceId ?: return
        val previous = prefs
        prefs = next
        saving = true
        errorText = null
        scope.launch {
            runCatching {
                api.updateNotificationPreferences(
                    id,
                    NotificationPreferencesBody(
                        pushEnabled = next.device.pushEnabled,
                        muted = mutedNotificationKeys(next.groups),
                    ),
                )
            }.onSuccess { prefs = it }
                .onFailure {
                    prefs = previous
                    errorText = strings.notificationsSaveFailed
                }
            saving = false
        }
    }

    fun toggleType(type: NotificationTypeDto, enabled: Boolean) {
        val current = prefs ?: return
        save(current.copy(groups = applyNotificationToggle(current.groups, setOf(type.key), enabled)))
    }

    fun toggleModule(group: NotificationGroupDto) {
        val current = prefs ?: return
        // Any switch on means "turn the module off": the mockup's caption.
        val target = group.types.none { it.enabled }
        val keys = group.types.map { it.key }.toSet()
        save(current.copy(groups = applyNotificationToggle(current.groups, keys, target)))
    }

    fun toggleMaster(enabled: Boolean) {
        if (!allowed) {
            permission.launch(Manifest.permission.POST_NOTIFICATIONS)
            return
        }
        val current = prefs ?: return
        save(current.copy(device = current.device.copy(pushEnabled = enabled)))
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = strings.back, tint = palette.foreground)
            }
            Text(
                strings.notifications,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.weight(1f),
            )
        }
        Text(strings.notificationsHint, fontSize = 12.sp, color = palette.mutedForeground)

        if (deviceId == null) {
            warningCard(
                title = strings.notificationsNoDevice,
                note = registrationNote(pushStatus, strings),
                palette = palette,
                action = strings.recheck,
                onAction = onRetryPush,
            )
            if (!allowed) permissionCard(strings, palette, onOpenSettings = { openNotificationSettings(context) })
            return@Column
        }

        when {
            loading -> Box(Modifier.fillMaxWidth().padding(top = 24.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = palette.accent)
            }
            prefs == null -> warningCard(
                title = errorText ?: strings.notificationsLoadFailed,
                note = strings.notificationsLoadFailedNote,
                palette = palette,
                action = strings.recheck,
                onAction = { scope.launch { load() } },
            )
            else -> {
                val current = prefs!!
                masterCard(
                    title = strings.notificationsMaster,
                    note = when {
                        !allowed -> strings.notificationsPermissionBlocked
                        !current.device.pushEnabled -> strings.notificationsMasterOffNote
                        else -> strings.notificationsMasterNote
                    },
                    checked = allowed && current.device.pushEnabled,
                    enabled = !saving,
                    onChange = { toggleMaster(it) },
                    palette = palette,
                )

                if (!allowed) {
                    permissionCard(
                        strings,
                        palette,
                        onOpenSettings = { openNotificationSettings(context) },
                    )
                }

                if (pushStatus != "ok") {
                    warningCard(
                        title = strings.notificationsRegisterFailed,
                        note = registrationNote(pushStatus, strings),
                        palette = palette,
                        action = strings.recheck,
                        onAction = onRetryPush,
                    )
                }

                errorText?.let {
                    Text(it, color = palette.destructive, fontSize = 12.sp)
                }

                val general = current.groups.filter { it.module == null }
                if (general.isNotEmpty()) {
                    Text(
                        strings.notificationsGeneral.uppercase(),
                        fontSize = 11.sp,
                        letterSpacing = 1.sp,
                        color = palette.mutedForeground,
                    )
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(palette.surface, RoundedCornerShape(16.dp))
                            .border(1.dp, palette.border, RoundedCornerShape(16.dp))
                            .padding(horizontal = 14.dp),
                    ) {
                        general.flatMap { it.types }.forEach { type ->
                            typeRow(type, saving, palette, strings) { value, enabled -> toggleType(value, enabled) }
                        }
                    }
                }

                val modules = current.groups.filter { it.module != null }
                if (modules.isNotEmpty()) {
                    Text(
                        strings.notificationsModules.uppercase(),
                        fontSize = 11.sp,
                        letterSpacing = 1.sp,
                        color = palette.mutedForeground,
                    )
                    modules.forEach { group ->
                        val module = group.module ?: return@forEach
                        val key = module.key
                        val open = key in expanded
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(palette.surface, RoundedCornerShape(16.dp))
                                .border(1.dp, palette.border, RoundedCornerShape(16.dp))
                                .padding(horizontal = 14.dp),
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        expanded = if (open) expanded - key else expanded + key
                                    }
                                    .padding(vertical = 12.dp),
                            ) {
                                moduleIcon(
                                    url = iconUrl(key),
                                    token = token,
                                    fallback = module.name.take(1).uppercase(),
                                    palette = palette,
                                )
                                Text(
                                    module.name,
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 14.sp,
                                    modifier = Modifier.weight(1f),
                                )
                                val active = group.types.count { it.enabled }
                                val total = group.types.size
                                if (active in 1 until total) {
                                    Text(
                                        strings.notificationsActiveCount
                                            .replace("{active}", active.toString())
                                            .replace("{total}", total.toString()),
                                        fontSize = 11.sp,
                                        color = palette.accent,
                                        fontWeight = FontWeight.SemiBold,
                                    )
                                }
                                Switch(
                                    checked = active > 0,
                                    onCheckedChange = { toggleModule(group) },
                                    enabled = !saving,
                                )
                                Text(
                                    if (open) "▴" else "▾",
                                    fontSize = 14.sp,
                                    color = palette.mutedForeground,
                                )
                            }
                            if (open) {
                                group.types.forEach { type ->
                                    Row(
                                        modifier = Modifier.padding(start = 44.dp),
                                    ) {
                                        typeRow(type, saving, palette, strings) { value, enabled -> toggleType(value, enabled) }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

}

@Composable
private fun masterCard(
    title: String,
    note: String,
    checked: Boolean,
    enabled: Boolean,
    onChange: (Boolean) -> Unit,
    palette: com.rferic.zero27apps.ui.theme.Palette,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(palette.surface, RoundedCornerShape(16.dp))
            .border(1.dp, palette.border, RoundedCornerShape(16.dp))
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(title, fontWeight = FontWeight.Bold, fontSize = 15.sp)
            Text(note, fontSize = 11.sp, color = palette.mutedForeground)
        }
        Switch(checked = checked, onCheckedChange = onChange, enabled = enabled)
    }
}

@Composable
private fun typeRow(
    type: NotificationTypeDto,
    saving: Boolean,
    palette: com.rferic.zero27apps.ui.theme.Palette,
    strings: Strings,
    onToggle: (NotificationTypeDto, Boolean) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            notificationTypeLabel(type.key, strings),
            fontSize = 13.sp,
            modifier = Modifier.weight(1f),
        )
        Switch(
            checked = type.enabled,
            onCheckedChange = { onToggle(type, it) },
            enabled = !saving,
        )
    }
}

@Composable
private fun moduleIcon(
    url: String?,
    token: String?,
    fallback: String,
    palette: com.rferic.zero27apps.ui.theme.Palette,
) {
    val context = LocalContext.current
    Box(
        modifier = Modifier
            .size(34.dp)
            .background(palette.accent.copy(alpha = 0.14f), RoundedCornerShape(10.dp)),
        contentAlignment = Alignment.Center,
    ) {
        if (url == null) {
            Text(fallback, color = palette.accent, fontWeight = FontWeight.Bold, fontSize = 15.sp)
        } else {
            SubcomposeAsyncImage(
                model = ImageRequest.Builder(context)
                    .data(url)
                    .apply { if (token != null) addHeader("Authorization", "Bearer $token") }
                    .build(),
                contentDescription = null,
                colorFilter = ColorFilter.tint(palette.accent),
                contentScale = ContentScale.Fit,
                modifier = Modifier.size(20.dp),
                loading = { Text(fallback, color = palette.accent, fontWeight = FontWeight.Bold, fontSize = 15.sp) },
                error = { Text(fallback, color = palette.accent, fontWeight = FontWeight.Bold, fontSize = 15.sp) },
            )
        }
    }
}

@Composable
private fun permissionCard(
    strings: Strings,
    palette: com.rferic.zero27apps.ui.theme.Palette,
    onOpenSettings: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(palette.warning.copy(alpha = 0.12f), RoundedCornerShape(16.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(strings.notificationsPermissionTitle, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = palette.warning)
        Text(strings.notificationsPermissionNote, fontSize = 11.sp, color = palette.mutedForeground)
        TextButton(onClick = onOpenSettings, contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp)) {
            Text(strings.notificationsOpenSettings, fontSize = 12.sp, color = palette.accent, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun warningCard(
    title: String,
    note: String,
    palette: com.rferic.zero27apps.ui.theme.Palette,
    action: String,
    onAction: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(palette.warning.copy(alpha = 0.12f), RoundedCornerShape(16.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(title, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = palette.warning)
        Text(note, fontSize = 11.sp, color = palette.mutedForeground)
        TextButton(onClick = onAction, contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp)) {
            Text(action, fontSize = 12.sp, color = palette.accent, fontWeight = FontWeight.SemiBold)
        }
    }
}

private fun registrationNote(status: String?, strings: Strings): String = when (status) {
    "ok" -> strings.pushReady
    "registering" -> strings.checking
    "no_session" -> strings.pushNoSession
    null -> strings.pushUnknown
    else -> status
}

private fun notificationsAllowed(context: Context): Boolean =
    Build.VERSION.SDK_INT < 33 ||
        ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.POST_NOTIFICATIONS,
        ) == PackageManager.PERMISSION_GRANTED

private fun openNotificationSettings(context: Context) {
    val intent = if (Build.VERSION.SDK_INT >= 26) {
        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
            .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
    } else {
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
            .setData(android.net.Uri.parse("package:${context.packageName}"))
    }
    runCatching { context.startActivity(intent) }
}

/** The label of a notification kind; unknown keys are shown as they arrive. */
internal fun notificationTypeLabel(key: String, strings: Strings): String = when (key) {
    "invitation.requested" -> strings.notificationInvitationRequested
    "invitation.request_resolved" -> strings.notificationInvitationResolved
    "owe_no.movement_created" -> strings.notificationMovementCreated
    "owe_no.movement_changed" -> strings.notificationMovementChanged
    else -> key
}

/** Marks the given keys in every group, leaving the others untouched. */
internal fun applyNotificationToggle(
    groups: List<NotificationGroupDto>,
    keys: Set<String>,
    enabled: Boolean,
): List<NotificationGroupDto> = groups.map { group ->
    group.copy(
        types = group.types.map { type ->
            if (type.key in keys) type.copy(enabled = enabled) else type
        },
    )
}

/** The kinds the server has to stop sending for this device. */
internal fun mutedNotificationKeys(groups: List<NotificationGroupDto>): List<String> =
    groups.flatMap { it.types }.filter { !it.enabled }.map { it.key }
