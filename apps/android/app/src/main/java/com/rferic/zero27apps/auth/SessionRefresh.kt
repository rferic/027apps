package com.rferic.zero27apps.auth

import com.rferic.zero27apps.data.RefreshResult
import io.github.jan.supabase.auth.exception.AuthErrorCode
import io.github.jan.supabase.auth.exception.AuthRestException
import io.github.jan.supabase.auth.exception.AuthSessionMissingException
import java.io.IOException

/**
 * Turns a `refreshCurrentSession` failure into the three outcomes the app
 * needs. A network problem, a 5xx or an unknown error keeps the session; only
 * a refresh token that Supabase rejected ends it.
 */
fun refreshOutcome(error: Throwable): RefreshResult {
    if (error is kotlinx.coroutines.CancellationException) throw error
    if (error is AuthSessionMissingException) return RefreshResult.NoSession
    if (error is AuthRestException) {
        return when (error.errorCode) {
            AuthErrorCode.SessionNotFound,
            AuthErrorCode.SessionExpired,
            AuthErrorCode.RefreshTokenNotFound,
            AuthErrorCode.RefreshTokenAlreadyUsed,
            AuthErrorCode.UserNotFound,
            AuthErrorCode.UserBanned,
            -> RefreshResult.NoSession

            else -> RefreshResult.Network
        }
    }
    // IOException, timeouts, TLS and unknown failures are retryable.
    if (error is IOException || error.cause is IOException) return RefreshResult.Network
    return RefreshResult.Network
}
