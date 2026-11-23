package com.rferic.zero27apps.ui.screens

import com.rferic.zero27apps.data.NotificationGroupDto
import com.rferic.zero27apps.data.NotificationModuleDto
import com.rferic.zero27apps.data.NotificationTypeDto
import com.rferic.zero27apps.ui.i18n.AppStrings
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The mapping step of Ajustes → Notificaciones: marking a module marks all of
 * its kinds, and what the app sends to the server is exactly the disabled list,
 * so a mute the sender understands is never left behind.
 */
class NotificationToggleTest {
    private val general = NotificationGroupDto(
        module = null,
        types = listOf(
            NotificationTypeDto("invitation.requested", enabled = true),
            NotificationTypeDto("invitation.request_resolved", enabled = false),
        ),
    )
    private val oweNo = NotificationGroupDto(
        module = NotificationModuleDto("owe-no", "OweNo"),
        types = listOf(
            NotificationTypeDto("owe_no.movement_created", enabled = true),
            NotificationTypeDto("owe_no.movement_changed", enabled = true),
        ),
    )

    @Test
    fun turningAModuleOffClearsEveryKindInIt() {
        val groups = applyNotificationToggle(
            listOf(general, oweNo),
            oweNo.types.map { it.key }.toSet(),
            enabled = false,
        )

        assertEquals(listOf(false, false), groups[1].types.map { it.enabled })
        assertEquals("the general group is untouched", listOf(true, false), groups[0].types.map { it.enabled })
    }

    @Test
    fun turningAModuleOnMarksEveryKindInIt() {
        val off = oweNo.copy(types = oweNo.types.map { it.copy(enabled = false) })
        val groups = applyNotificationToggle(
            listOf(general, off),
            off.types.map { it.key }.toSet(),
            enabled = true,
        )

        assertTrue(groups[1].types.all { it.enabled })
    }

    @Test
    fun mutedKeysAreExactlyTheDisabledOnes() {
        val groups = listOf(general, oweNo)

        assertEquals(listOf("invitation.request_resolved"), mutedNotificationKeys(groups))
    }

    @Test
    fun labelsAreLocalizedAndUnknownKindsStayReadable() {
        val es = AppStrings.es

        assertEquals("Solicitudes de plazas", notificationTypeLabel("invitation.requested", es))
        assertEquals("Gasto corregido o borrado", notificationTypeLabel("owe_no.movement_changed", es))
        assertEquals("Gasto nuevo", notificationTypeLabel("owe_no.movement_created", es))
        assertEquals("fixture.created", notificationTypeLabel("fixture.created", es))
    }
}
