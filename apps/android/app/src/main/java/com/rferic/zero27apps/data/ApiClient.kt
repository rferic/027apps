package com.rferic.zero27apps.data

import com.rferic.zero27apps.BuildConfig

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.HttpClientEngine
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.header
import io.ktor.client.request.request
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import io.ktor.serialization.kotlinx.json.json
import java.io.Closeable
import java.io.IOException
import kotlinx.serialization.json.Json

/**
 * The Core API client. It carries the Supabase access token, retries exactly
 * once after a 401 by refreshing the session, and maps the Core's error
 * envelope to [ApiException] so the UI can switch on a code instead of text.
 *
 * The engine is injected: production passes OkHttp, tests pass a MockEngine.
 */
class ApiClient(
    private val baseUrl: String,
    engine: HttpClientEngine,
    private val token: () -> String?,
    private val refresh: suspend () -> RefreshResult,
    /**
     * Runs once when the session is definitively gone: the refresh token was
     * rejected, or the Core still answers 401 after refreshing. The app clears
     * what it stored and explains it on the login screen. A callback failure
     * never hides the [ApiException] the caller still gets.
     */
    private val onSessionEnded: suspend () -> Unit = {},
) : Closeable {
    /** A screen can have several requests in flight; the app hears it once. */
    private val sessionEnded = java.util.concurrent.atomic.AtomicBoolean(false)
    private val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        encodeDefaults = false
    }

    private val http = HttpClient(engine) {
        expectSuccess = false
        install(ContentNegotiation) { json(json) }
    }

    /** Absolute URL of a module icon; the request still carries the session. */
    fun moduleIconUrl(key: String): String = "$baseUrl/api/v1/modules/$key/icon"

    /**
     * Re-arms the revoked-session signal. The client outlives a logout, so a
     * new sign-in must be able to report a second revocation.
     */
    fun resetSessionState() {
        sessionEnded.set(false)
    }

    suspend fun instance(): InstanceResponse = read(request(HttpMethod.Get, "/api/v1/instance"))

    suspend fun me(): UserDto = read<MeResponse>(request(HttpMethod.Get, "/api/v1/me")).user

    suspend fun myModules(limit: Int = 50): MyModulesResponse =
        read(request(HttpMethod.Get, "/api/v1/me/modules?limit=$limit"))

    /** Native widgets the modules contribute to one surface of the app. */
    suspend fun dashboard(surface: String): DashboardResponse =
        read(request(HttpMethod.Get, "/api/v1/me/dashboard?surface=$surface"))

    // --- OweNo module -------------------------------------------------------

    suspend fun oweGroups(): List<OweGroupDto> = read<OweGroupList>(request(HttpMethod.Get, "/api/v1/owe-no/groups")).groups

    suspend fun oweGroup(id: String): OweGroupDetail =
        read(request(HttpMethod.Get, "/api/v1/owe-no/groups/$id"))

    suspend fun oweCreateGroup(name: String, currency: String, locale: String? = null): OweGroupDto =
        read<OweGroupResponse>(
            request(HttpMethod.Post, "/api/v1/owe-no/groups", OweCreateGroupBody(name, currency, locale)),
        ).group

    /** One slice of movements, newest first: the app asks for the next page on demand. */
    suspend fun oweMovements(
        groupId: String,
        limit: Int = 50,
        offset: Int = 0,
    ): List<OweMovementDto> =
        read<OweMovementList>(
            request(
                HttpMethod.Get,
                "/api/v1/owe-no/groups/$groupId/movements?limit=$limit&offset=$offset",
            ),
        ).movements

    suspend fun oweBalances(groupId: String): List<OweBalanceDto> =
        read<OweBalanceList>(request(HttpMethod.Get, "/api/v1/owe-no/groups/$groupId/balances")).balances

    suspend fun oweSettlement(groupId: String): OweSettlementDto =
        read(request(HttpMethod.Get, "/api/v1/owe-no/groups/$groupId/settlement"))

    suspend fun oweCreateMovement(groupId: String, body: OweCreateMovementBody): OweMovementDto =
        read<OweMovementResponse>(
            request(HttpMethod.Post, "/api/v1/owe-no/groups/$groupId/movements", body),
        ).movement

    suspend fun oweAcceptInvitation(groupId: String) {
        expectSuccess(request(HttpMethod.Post, "/api/v1/owe-no/groups/$groupId/members/accept"))
    }

    suspend fun oweDeclineInvitation(groupId: String) {
        expectSuccess(request(HttpMethod.Post, "/api/v1/owe-no/groups/$groupId/members/decline"))
    }

    suspend fun oweAddMember(groupId: String, body: OweAddMemberBody): OweMemberDto =
        read<OweMemberResponse>(
            request(HttpMethod.Post, "/api/v1/owe-no/groups/$groupId/members", body),
        ).member

    suspend fun oweRemoveMember(groupId: String, memberId: String, mode: String? = null) {
        expectSuccess(
            request(
                HttpMethod.Delete,
                "/api/v1/owe-no/groups/$groupId/members/$memberId" + (mode?.let { "?mode=$it" } ?: ""),
            ),
        )
    }

    suspend fun oweCreateCategory(groupId: String, name: String): OweCategoryDto =
        read<OweCategoryResponse>(
            request(
                HttpMethod.Post,
                "/api/v1/owe-no/groups/$groupId/categories",
                OweCategoryBody(name = name),
            ),
        ).category

    suspend fun oweUpdateCategory(
        groupId: String,
        categoryId: String,
        name: String? = null,
        archived: Boolean? = null,
    ): OweCategoryDto =
        read<OweCategoryResponse>(
            request(
                HttpMethod.Patch,
                "/api/v1/owe-no/groups/$groupId/categories/$categoryId",
                OweCategoryBody(name = name, archived = archived),
            ),
        ).category

    suspend fun oweUpdateMovement(groupId: String, movementId: String, body: OweCreateMovementBody) {
        expectSuccess(
            request(
                HttpMethod.Patch,
                "/api/v1/owe-no/groups/$groupId/movements/$movementId",
                body,
            ),
        )
    }

    suspend fun oweDeleteMovement(groupId: String, movementId: String) {
        expectSuccess(
            request(HttpMethod.Delete, "/api/v1/owe-no/groups/$groupId/movements/$movementId"),
        )
    }

    suspend fun oweLinkMember(groupId: String, memberId: String, userId: String) {
        expectSuccess(
            request(
                HttpMethod.Post,
                "/api/v1/owe-no/groups/$groupId/members/$memberId/link",
                OweLinkBody(userId),
            ),
        )
    }

    suspend fun oweBlockMember(groupId: String, memberId: String, mode: String? = null) {
        expectSuccess(
            request(
                HttpMethod.Post,
                "/api/v1/owe-no/groups/$groupId/members/$memberId/block" + (mode?.let { "?mode=$it" } ?: ""),
            ),
        )
    }

    suspend fun oweUnblockMember(groupId: String, memberId: String) {
        expectSuccess(
            request(HttpMethod.Delete, "/api/v1/owe-no/groups/$groupId/members/$memberId/block"),
        )
    }

    suspend fun oweLeaveGroup(groupId: String) {
        expectSuccess(request(HttpMethod.Post, "/api/v1/owe-no/groups/$groupId/leave"))
    }

    suspend fun oweCategories(groupId: String): List<OweCategoryDto> =
        read<OweCategoryList>(
            request(HttpMethod.Get, "/api/v1/owe-no/groups/$groupId/categories"),
        ).categories

    suspend fun oweIdentities(groupId: String): List<OweIdentityDto> =
        read<OweIdentityList>(
            request(HttpMethod.Get, "/api/v1/owe-no/groups/$groupId/imports/identities"),
        ).identities

    suspend fun oweSummary(groupId: String): OweGroupSummaryDto =
        read<OweGroupSummaryResponse>(
            request(HttpMethod.Get, "/api/v1/owe-no/groups/$groupId/summary"),
        ).summary

    suspend fun oweMappingOptions(groupId: String): List<OweMappingOptionDto> =
        read<OweMappingOptionList>(
            request(HttpMethod.Get, "/api/v1/owe-no/groups/$groupId/imports/mapping"),
        ).options

    suspend fun oweImportPreview(groupId: String, csv: String): OweImportPreviewDto =
        read(request(HttpMethod.Post, "/api/v1/owe-no/groups/$groupId/imports/preview", OweImportPreviewBody(csv)))

    suspend fun oweImportCommit(
        groupId: String,
        csv: String,
        mapping: Map<String, String>?,
        confirmDuplicates: Boolean,
    ): OweImportResultDto =
        read(
            request(
                HttpMethod.Post,
                "/api/v1/owe-no/groups/$groupId/imports",
                OweImportCommitBody(csv, mapping, if (confirmDuplicates) true else null),
            ),
        )

    /** Latest Android build published by this instance (public, no session). */
    suspend fun androidApp(): AndroidReleaseDto = read(request(HttpMethod.Get, "/api/v1/app/android"))

    /** Public invitation redemption; the token travels in the path, never logged. */
    suspend fun redeemInvitation(token: String, request: RedeemRequest): RedeemResponse =
        read(request(HttpMethod.Post, "/api/v1/invitations/$token/redeem", request))

    suspend fun patchMe(patch: PatchMeRequest): UserDto =
        read<MeResponse>(request(HttpMethod.Patch, "/api/v1/me", patch)).user

    /** Runs a request; a 401 refreshes the session and retries once. */
    private suspend fun request(
        method: HttpMethod,
        path: String,
        body: Any? = null,
    ): HttpResponse {
        val first = send(method, path, body)
        if (first.status != HttpStatusCode.Unauthorized) return first
        return when (refresh()) {
            RefreshResult.Refreshed -> {
                val second = send(method, path, body)
                if (second.status == HttpStatusCode.Unauthorized) sessionRevoked()
                second
            }
            RefreshResult.NoSession -> sessionRevoked()
            RefreshResult.Network ->
                throw ApiException.networkFailure(IOException("network while refreshing the session"))
        }
    }

    /**
     * Ends the session in the app, then fails the request. The two are
     * separate: the app must learn the session is gone even if the screen that
     * made the call only knows how to show an error.
     */
    private suspend fun sessionRevoked(): Nothing {
        if (sessionEnded.compareAndSet(false, true)) {
            try {
                onSessionEnded()
            } catch (error: kotlinx.coroutines.CancellationException) {
                throw error
            } catch (_: Exception) {
                // Clearing the session must not depend on the callback's health.
            }
        }
        throw ApiException("unauthorized", 401, "Session revoked")
    }

    private suspend fun send(method: HttpMethod, path: String, body: Any?): HttpResponse =
        try {
            http.request("${baseUrl.trimEnd('/')}$path") {
                this.method = method
                token()?.let { header(HttpHeaders.Authorization, "Bearer $it") }
                if (body != null) {
                    contentType(ContentType.Application.Json)
                    setBody(body)
                }
            }
        } catch (error: IOException) {
            throw ApiException.networkFailure(error)
        }

    private suspend fun expectSuccess(response: HttpResponse) {
        if (!response.status.isSuccess()) throw errorOf(response)
    }

    private suspend inline fun <reified T> read(response: HttpResponse): T {
        if (!response.status.isSuccess()) throw errorOf(response)
        return response.body()
    }

    private suspend fun errorOf(response: HttpResponse): ApiException {
        val status = response.status.value
        if (BuildConfig.DEBUG) {
            // Status and a path with ids redacted; never the body (it can carry a token).
            runCatching {
                val path = response.call.request.url.encodedPath.replace(
                    Regex("/[0-9a-f-]{16,}"),
                    "/:id",
                )
                android.util.Log.w("027api", "HTTP $status $path")
            }
        }
        val envelope = runCatching { response.body<ErrorEnvelope>() }.getOrNull()
        return if (envelope != null) {
            val detail = envelope.error.details
                ?.get("code")
                ?.let { (it as? kotlinx.serialization.json.JsonPrimitive)?.content }
            ApiException(envelope.error.code, status, envelope.error.message, detail)
        } else {
            ApiException("http_$status", status, "HTTP $status")
        }
    }

    override fun close() = http.close()
}
