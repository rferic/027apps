package com.rferic.zero27apps.update

import java.net.URI
import java.util.Locale

/**
 * Which download URLs and digests an update may trust. Pure on purpose: this is
 * the check that decides whether the app installs a file, so it is covered by
 * unit tests instead of only by reading it.
 *
 * Release builds require HTTPS on the instance's own origin (exact host and
 * port, not a string prefix) and a published SHA-256. Debug builds accept a
 * plain-HTTP host on the developer's own network, which is how a LAN build is
 * installed; Android still refuses the APK unless it is signed with the same
 * key, so the origin check is not the only gate.
 */
object UpdatePolicy {
    private val DIGEST = Regex("^[0-9a-fA-F]{64}$")
    private val PRIVATE_HOST = Regex("^(localhost|127\\.0\\.0\\.1|10\\.\\d+\\.\\d+\\.\\d+|192\\.168\\.\\d+\\.\\d+|172\\.(1[6-9]|2\\d|3[01])\\.\\d+\\.\\d+)$")

    /** `https://example.com.evil.tld/x.apk` must not pass for `https://example.com`. */
    fun trustedUrl(candidate: String, base: String, debug: Boolean): Boolean {
        val target = parse(candidate) ?: return false
        val origin = parse(base) ?: return false
        val scheme = target.scheme?.lowercase(Locale.ROOT) ?: return false
        val host = target.host?.lowercase(Locale.ROOT) ?: return false
        if (scheme != "https" && !(debug && scheme == "http")) return false
        if (target.path.isNullOrEmpty()) return false
        val sameHost = host == origin.host?.lowercase(Locale.ROOT)
        if (sameHost && port(target) == port(origin)) return true
        // A debug build may pull from a release host on the developer's own
        // network (a LAN server on another port, the emulator alias); never
        // from a public one.
        return debug && scheme == "http" && PRIVATE_HOST.matches(host)
    }

    /** Release builds must verify the file; a missing digest is a refusal, not a skip. */
    fun digestRequired(debug: Boolean): Boolean = !debug

    fun validDigest(value: String?): Boolean = value != null && DIGEST.matches(value)

    private fun parse(value: String): URI? = runCatching { URI(value) }.getOrNull()
        ?.takeIf { it.scheme != null && !it.host.isNullOrEmpty() }

    private fun port(uri: URI): Int = when {
        uri.port != -1 -> uri.port
        uri.scheme.equals("https", ignoreCase = true) -> 443
        else -> 80
    }
}
