package com.rferic.zero27apps

import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The app ships its own changelog: a version without an entry would reach the
 * owner with no explanation of what changed, and a build whose own entry is not
 * in the nine shipped languages would show English to eight of them. Both fail
 * the build instead of shipping.
 */
class ChangelogTest {
    @Test
    fun `the running version has a changelog entry`() {
        val version = BuildConfig.VERSION_NAME
        assertTrue(
            "Add an entry for $version to Changelog.kt",
            Changelog.entries.any { it.version == version || version.startsWith("${it.version}-") },
        )
    }

    @Test
    fun `the running version is written in every shipped locale`() {
        val version = BuildConfig.VERSION_NAME
        val entry = Changelog.entries.first {
            version == it.version || version.startsWith("${it.version}-")
        }
        for (locale in Changelog.shippedLocales) {
            assertTrue(
                "Add $locale notes for $version to Changelog.kt",
                !entry.notes[locale].isNullOrEmpty(),
            )
        }
    }

    @Test
    fun `older entries keep at least Spanish and English`() {
        for (entry in Changelog.entries) {
            assertTrue("${entry.version} needs Spanish notes", !entry.notes["es"].isNullOrEmpty())
            assertTrue("${entry.version} needs English notes", !entry.notes["en"].isNullOrEmpty())
        }
    }
}
