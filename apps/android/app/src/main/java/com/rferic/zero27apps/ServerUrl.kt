package com.rferic.zero27apps

import java.net.URI

object ServerUrl {
    fun normalize(raw: String): String? {
        val trimmed = raw.trim().trimEnd('/')
        val uri = runCatching { URI(trimmed) }.getOrNull() ?: return null
        val isHttp = uri.scheme.equals("http", ignoreCase = true) ||
            uri.scheme.equals("https", ignoreCase = true)
        return if (isHttp && !uri.host.isNullOrEmpty()) trimmed else null
    }
}
