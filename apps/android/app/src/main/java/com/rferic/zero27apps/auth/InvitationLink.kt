package com.rferic.zero27apps.auth

import com.rferic.zero27apps.BuildConfig
import com.rferic.zero27apps.ServerUrl
import java.net.URI

/**
 * An invitation link carries two things: the token and the instance that issued
 * it. The token is never logged or stored, and the instance is normalised with
 * the same rules as the chooser, so a link cannot point the app at a plain
 * `http://` server outside debug.
 */
data class InvitationLink(val token: String, val instance: String) {
    companion object {
        /** The Core's token prefix plus base64url; no separators or spaces. */
        private val TOKEN = Regex("^027_inv_[A-Za-z0-9_-]{8,200}$")
        private const val PRODUCTION_HOST = "027apps.ericrf.com"
        private const val PATH_PREFIX = "/invite/"

        /**
         * Accepts:
         * - `https://<host>/invite/<token>` (the App Link, any self-hosted host);
         * - `027apps://invite/<token>?instance=<url>` and its debug twin.
         *
         * Returns null for anything else: no token, an http link, or an
         * instance the build would refuse.
         */
        /**
         * `java.net.URI` rejects a scheme that starts with a digit, so the app
         * scheme is matched by hand; the https App Link goes through URI.
         */
        private val CUSTOM = Regex(
            "^(027apps|027apps-dev)://invite/?([^?#]*)(?:\\?([^#]*))?$",
            RegexOption.IGNORE_CASE,
        )

        fun parse(raw: String): InvitationLink? {
            val trimmed = raw.trim()
            val custom = CUSTOM.find(trimmed)
            val token: String
            val instanceRaw: String
            if (custom != null) {
                token = custom.groupValues[2].trimEnd('/')
                val query = custom.groupValues[3].ifEmpty { null }
                instanceRaw = queryParam(query, "instance") ?: "https://$PRODUCTION_HOST"
            } else {
                val uri = runCatching { URI(trimmed) }.getOrNull() ?: return null
                if (uri.scheme?.lowercase() != "https") return null
                val host = uri.host?.lowercase() ?: return null
                val path = uri.path.orEmpty()
                if (!path.startsWith(PATH_PREFIX)) return null
                token = path.removePrefix(PATH_PREFIX).trimEnd('/')
                instanceRaw = "https://$host"
            }
            if (!TOKEN.matches(token)) return null
            val instance = ServerUrl.normalize(instanceRaw, requireHttps = !BuildConfig.DEBUG) ?: return null
            return InvitationLink(token, instance)
        }

        private fun queryParam(rawQuery: String?, name: String): String? {
            if (rawQuery.isNullOrBlank()) return null
            for (pair in rawQuery.split("&")) {
                val index = pair.indexOf('=')
                if (index <= 0) continue
                if (pair.substring(0, index) == name) {
                    return java.net.URLDecoder.decode(pair.substring(index + 1), "UTF-8")
                }
            }
            return null
        }
    }
}
