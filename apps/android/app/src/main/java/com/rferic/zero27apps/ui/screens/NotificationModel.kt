package com.rferic.zero27apps.ui.screens

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.rferic.zero27apps.data.NotificationGroupDto
import com.rferic.zero27apps.ui.i18n.Strings

/**
 * The model behind Ajustes → Notificaciones: the kind labels, the all-or-none
 * toggle of a module and the disabled list the server needs. Kept apart from
 * the screen so the rules are testable without Compose.
 */
internal fun notificationTypeLabel(key: String, strings: Strings): String = when (key) {
    "invitation.requested" -> strings.notificationInvitationRequested
    "invitation.request_resolved" -> strings.notificationInvitationResolved
    "owe_no.movement_created" -> strings.notificationMovementCreated
    "owe_no.movement_changed" -> strings.notificationMovementChanged
    // A future kind reaches the app before this build knows its label: show the
    // key instead of hiding the switch.
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

/** The one-line push state of the device, shared by Ajustes and its screen. */
internal fun pushStatusNote(status: String?, strings: Strings, ready: String): String = when (status) {
    "ok" -> ready
    "registering" -> strings.checking
    "no_session" -> strings.pushNoSession
    null -> strings.pushUnknown
    else -> status
}

/** Android 13+ needs an explicit permission; older versions do not. */
internal fun notificationsAllowed(context: Context): Boolean =
    Build.VERSION.SDK_INT < 33 ||
        ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.POST_NOTIFICATIONS,
        ) == PackageManager.PERMISSION_GRANTED
