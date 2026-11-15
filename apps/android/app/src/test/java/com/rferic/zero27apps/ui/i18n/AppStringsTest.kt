package com.rferic.zero27apps.ui.i18n

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.lang.reflect.Modifier

/**
 * Reflection over `Strings` instead of a hand-written list: a new string used by
 * a screen is checked in the nine locales the moment it is added, not when
 * somebody remembers to extend a list. Placeholders must match the English
 * source, which is the one the screens are written against.
 */
class AppStringsTest {
    private val all: List<Pair<String, Strings>> = listOf(
        "en" to AppStrings.en,
        "es" to AppStrings.es,
        "ca" to AppStrings.ca,
        "it" to AppStrings.it,
        "fr" to AppStrings.fr,
        "de" to AppStrings.de,
        "pt" to AppStrings.pt,
        "gl" to AppStrings.gl,
        "eu" to AppStrings.eu,
    )

    private val getters: List<java.lang.reflect.Method> = Strings::class.java.declaredMethods
        .filter { it.parameterCount == 0 && it.returnType == String::class.java }
        .filter { !Modifier.isStatic(it.modifiers) }
        .sortedBy { it.name }

    private fun value(strings: Strings, method: java.lang.reflect.Method): String =
        method.invoke(strings) as String

    private fun placeholders(text: String): Set<String> =
        Regex("\\{[a-zA-Z]+}").findAll(text).map { it.value }.toSet()

    @Test
    fun `every string is present and not blank in the nine locales`() {
        assertTrue("no getters found: the reflection filter is wrong", getters.size > 100)
        for ((locale, strings) in all) {
            for (method in getters) {
                assertTrue(
                    "$locale.${method.name} is blank",
                    value(strings, method).isNotBlank(),
                )
            }
        }
    }

    @Test
    fun `translations keep the placeholders of the english source`() {
        for ((locale, strings) in all) {
            if (locale == "en") continue
            for (method in getters) {
                val expected = placeholders(value(AppStrings.en, method))
                assertEquals(
                    "$locale.${method.name} has different placeholders",
                    expected,
                    placeholders(value(strings, method)),
                )
            }
        }
    }
}
