package com.rferic.zero27apps.ui.theme

import java.io.File
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The Kotlin palette must mirror `apps/admin/tokens.json`; otherwise the app
 * and the panel drift. Translucent tokens are pre-blended in Kotlin, so only
 * the opaque ones are compared byte for byte.
 */
class TokensTest {
    private fun tokensFile(): File {
        val candidates = listOf(
            "../../admin/tokens.json",
            "../admin/tokens.json",
            "apps/admin/tokens.json",
        ).map { File(it) }
        return candidates.firstOrNull { it.isFile }
            ?: error("tokens.json not found from ${File(".").absolutePath}")
    }

    private fun paletteOf(name: String): Map<String, String> {
        val root = Json.parseToJsonElement(tokensFile().readText()) as JsonObject
        val palette = root[name] as JsonObject
        return palette.mapValues { (_, value) -> value.jsonPrimitive.content }
    }

    @Test
    fun `light palette matches the shared tokens`() {
        val expected = paletteOf("light")
        val actual = Tokens.light.argb()
        for ((key, hex) in expected) {
            if (!hex.startsWith("#")) continue
            assertEquals("light.$key", hexToArgb(hex), actual.getValue(key))
        }
    }

    @Test
    fun `dark palette matches the shared tokens`() {
        val expected = paletteOf("dark")
        val actual = Tokens.dark.argb()
        for ((key, hex) in expected) {
            if (!hex.startsWith("#")) continue
            assertEquals("dark.$key", hexToArgb(hex), actual.getValue(key))
        }
    }

    @Test
    fun `the tokens file is the one the panel ships`() {
        val file = tokensFile()
        assertTrue(file.readText().contains("\"identity\": \"D\""))
    }

    private fun hexToArgb(hex: String): Int =
        (0xFF000000 or hex.removePrefix("#").toLong(16)).toInt()
}
