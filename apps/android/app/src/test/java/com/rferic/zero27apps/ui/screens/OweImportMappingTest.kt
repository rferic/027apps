package com.rferic.zero27apps.ui.screens

import com.rferic.zero27apps.data.OweMappingOptionDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Mapping a CSV name must not touch the group: the member is created by the
 * import commit, in its own transaction, so closing the screen leaves nothing
 * behind (sprint 17, task 01).
 */
class OweImportMappingTest {
    private val ana = OweMappingOptionDto(id = "member-ana", displayName = "Ana", kind = "member")
    private val luis = OweMappingOptionDto(id = "user-luis", displayName = "Luis Pérez", kind = "account")

    @Test
    fun choosingAnExistingMemberOnlyMapsIt() {
        val (mapping, pending) = chooseImportMapping("Luis", luis.copy(kind = "member", displayName = "Luis"), emptyMap(), emptyMap())

        assertEquals(mapOf("Luis" to luis.id), mapping)
        assertTrue("no member is created while mapping", pending.isEmpty())
    }

    @Test
    fun choosingARealAccountIsDeferredToTheCommit() {
        val (mapping, pending) = chooseImportMapping("Luis", luis, emptyMap(), emptyMap())

        assertTrue(mapping.isEmpty())
        assertEquals(1, pending.size)
        assertEquals("user-luis", pending.getValue("Luis").userId)
        assertEquals("Luis Pérez", pending.getValue("Luis").displayName)
        assertEquals("Luis", pending.getValue("Luis").name)
    }

    @Test
    fun choosingAFictitiousMemberIsDeferredWithItsCsvName() {
        val (_, pending) = chooseImportMapping("Bolli", null, emptyMap(), emptyMap())

        assertEquals("Bolli", pending.getValue("Bolli").name)
        assertNull(pending.getValue("Bolli").userId)
    }

    @Test
    fun changingTheChoiceDropsTheOneItReplaces() {
        val (mapping, pending) = chooseImportMapping("Luis", ana, mapOf("Luis" to "old"), mapOf("Luis" to pending("Luis")))

        assertEquals(mapOf("Luis" to ana.id), mapping)
        assertTrue("the pending creation is dropped", pending.isEmpty())
    }

    private fun pending(name: String) =
        com.rferic.zero27apps.data.OweImportNewMember(name = name, displayName = name)
}
