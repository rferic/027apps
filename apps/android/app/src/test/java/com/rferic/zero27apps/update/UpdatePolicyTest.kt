package com.rferic.zero27apps.update

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The update check is the last thing between a download and an install, so the
 * rules are pinned here: a lookalike host, a plain-HTTP release, a redirect to
 * another domain or a missing digest must all be refused.
 */
class UpdatePolicyTest {
    private val base = "https://027apps.example.com"
    private val digest = "b56ecdac99277f4e881df6a61994fb872bbd2123e4a275792e4b92261e5b4833"

    @Test
    fun `accepts the instance origin over https`() {
        assertTrue(UpdatePolicy.trustedUrl("$base/download/android", base, debug = false))
        assertTrue(UpdatePolicy.trustedUrl("$base:443/download/android", base, debug = false))
    }

    @Test
    fun `rejects a host that only shares the prefix`() {
        assertFalse(UpdatePolicy.trustedUrl("https://027apps.example.com.evil.tld/update.apk", base, debug = false))
        assertFalse(UpdatePolicy.trustedUrl("https://027apps.example.com@evil.tld/update.apk", base, debug = false))
        assertFalse(UpdatePolicy.trustedUrl("https://evil.tld/027apps.example.com/update.apk", base, debug = false))
    }

    @Test
    fun `rejects plain http in a release build`() {
        assertFalse(UpdatePolicy.trustedUrl("http://027apps.example.com/download/android", base, debug = false))
    }

    @Test
    fun `release refuses a download without a digest`() {
        assertTrue(UpdatePolicy.digestRequired(debug = false))
        assertFalse(UpdatePolicy.validDigest(null))
        assertFalse(UpdatePolicy.validDigest(""))
        assertFalse(UpdatePolicy.validDigest("sha256:$digest"))
        assertTrue(UpdatePolicy.validDigest(digest))
    }

    @Test
    fun `debug allows a lan host but not a public one`() {
        val lan = "http://192.168.1.108:3003"
        assertTrue(UpdatePolicy.trustedUrl("http://192.168.1.108:8099/027apps-lan.apk", lan, debug = true))
        assertFalse(UpdatePolicy.trustedUrl("http://mirror.example.org/app.apk", lan, debug = true))
        // Another private host is a LAN build too (the emulator's alias included).
        assertTrue(UpdatePolicy.trustedUrl("http://10.0.2.2:8099/app.apk", "http://192.168.1.108:3003", debug = true))
        assertFalse(UpdatePolicy.trustedUrl("https://mirror.example.org/app.apk", "http://192.168.1.108:3003", debug = true))
    }

    @Test
    fun `rejects a different port on the same host`() {
        assertFalse(UpdatePolicy.trustedUrl("https://027apps.example.com:8443/download/android", base, debug = false))
    }
}
