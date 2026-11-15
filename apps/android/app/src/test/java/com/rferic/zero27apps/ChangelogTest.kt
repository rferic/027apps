package com.rferic.zero27apps

import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The app ships its own changelog: a version without an entry would reach the
 * owner with no explanation of what changed, so the build fails instead.
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
    fun `every entry has notes in both shipped languages`() {
        for (entry in Changelog.entries) {
            assertTrue("${entry.version} needs Spanish notes", !entry.notes["es"].isNullOrEmpty())
            assertTrue("${entry.version} needs English notes", !entry.notes["en"].isNullOrEmpty())
        }
    }
}
