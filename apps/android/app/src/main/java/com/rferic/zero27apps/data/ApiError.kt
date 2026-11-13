package com.rferic.zero27apps.data

import java.io.IOException

/**
 * A failed API call. The `code` is the Core's envelope code (ADR 0007), which
 * is what the UI switches on; `message` is only a fallback for logs and rare
 * unknown codes, never the primary UI text.
 */
class ApiException(
    val code: String,
    val status: Int,
    override val message: String = code,
    /** True when the request never reached the server (offline, DNS, TLS). */
    val network: Boolean = false,
) : Exception(message) {
    companion object {
        fun networkFailure(cause: IOException): ApiException =
            ApiException("network_error", 0, cause.message ?: "network error", network = true)
    }
}
