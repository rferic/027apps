package com.rferic.zero27apps.data

/**
 * Outcome of renewing the Supabase session. `NoSession` is a revoked or
 * expired refresh token; `Network` is a retryable failure and must never clear
 * the stored session (sprint 16, task 03).
 */
sealed interface RefreshResult {
    data object Refreshed : RefreshResult
    data object NoSession : RefreshResult
    data object Network : RefreshResult
}
