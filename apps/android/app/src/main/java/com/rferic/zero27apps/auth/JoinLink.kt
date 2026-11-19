package com.rferic.zero27apps.auth

import com.rferic.zero27apps.BuildConfig
import com.rferic.zero27apps.ServerUrl
import java.net.URI

/**
 * A join link from a member's QR: the `027_join_` code and the instance that
 * minted it. Opening it exchanges the code for a 15-minute invitation, so the
 * token never appears in the link. Same instance rules as [InvitationLink]: a
 * link cannot point the app at a plain `http://` server outside debug.
 */
data class JoinLink(val code: String, val instance: String) {
    companion object {
        private val TOKEN = Regex("^027_join_[A-Za-z0-9_-]{1,200}$")
        private const val PRODUCTION_HOST = "027apps.ericrf.com"
        private const val PATH_PREFIX = "/join/"

        private val CUSTOM = Regex(
            "^(zero27apps|zero27apps-dev|027apps|027apps-dev)://join/?([^?#]*)(?:\\?([^#]*))?$",
            RegexOption.IGNORE_CASE,
        )

        fun parse(raw: String): JoinLink? {
            val trimmed = raw.trim()
            val custom = CUSTOM.find(trimmed)
            val code: String
            val instanceRaw: String
            if (custom != null) {
                code = custom.groupValues[2].trimEnd('/')
                val query = custom.groupValues[3].ifEmpty { null }
                instanceRaw = queryParam(query, "instance") ?: "https://$PRODUCTION_HOST"
            } else {
                val uri = runCatching { URI(trimmed) }.getOrNull() ?: return null
                if (uri.scheme?.lowercase() != "https") return null
                val host = uri.host?.lowercase() ?: return null
                val path = uri.path.orEmpty()
                if (!path.startsWith(PATH_PREFIX)) return null
                code = path.removePrefix(PATH_PREFIX).trimEnd('/')
                instanceRaw = "https://$host"
            }
            if (!TOKEN.matches(code)) return null
            val instance = ServerUrl.normalize(instanceRaw, requireHttps = !BuildConfig.DEBUG) ?: return null
            return JoinLink(code, instance)
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
