package com.rferic.zero27apps

import java.net.URI

/**
 * Validates the instance URL. There is no free-text URL screen on first launch
 * (the app opens against a build-time instance); this runs when the user picks
 * another one in Settings, so it has to be strict:
 *
 * - only `http`/`https`, no userinfo, query or fragment;
 * - release builds require HTTPS;
 * - debug builds accept plain HTTP only for private/local hosts, which is what
 *   the LAN development stack uses (`localhost`, `10.0.2.2` for the emulator and
 *   the RFC 1918 ranges).
 */
object ServerUrl {
    const val RELEASE_DEFAULT = "https://027apps.ericrf.com"

    fun normalize(raw: String, requireHttps: Boolean = true): String? {
        val trimmed = raw.trim().trimEnd('/')
        if (trimmed.isEmpty()) return null
        val uri = runCatching { URI(trimmed) }.getOrNull() ?: return null
        val scheme = uri.scheme?.lowercase() ?: return null
        if (scheme != "http" && scheme != "https") return null
        if (uri.userInfo != null || uri.query != null || uri.fragment != null) return null
        val host = uri.host
        if (host.isNullOrEmpty()) return null
        val path = uri.path.orEmpty()
        if (path.isNotEmpty() && path != "/") return null
        if (requireHttps) {
            if (scheme != "https") return null
        } else if (scheme == "http" && !isLocalHost(host)) {
            return null
        }
        val port = if (uri.port == -1) "" else ":${uri.port}"
        return "$scheme://$host$port"
    }

    private fun isLocalHost(host: String): Boolean {
        val h = host.lowercase()
        if (h == "localhost" || h == "10.0.2.2") return true
        val parts = h.split(".")
        if (parts.size != 4) return false
        val octets = parts.map { it.toIntOrNull() ?: return false }
        if (octets.any { it !in 0..255 }) return false
        return octets[0] == 127 ||
            octets[0] == 10 ||
            (octets[0] == 192 && octets[1] == 168) ||
            (octets[0] == 172 && octets[1] in 16..31)
    }
}
