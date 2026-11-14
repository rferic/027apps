package com.rferic.zero27apps.data

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.HttpClientEngine
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.header
import io.ktor.client.request.request
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
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
    private val refresh: suspend () -> Boolean,
) : Closeable {
    private val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        encodeDefaults = false
    }

    private val http = HttpClient(engine) {
        expectSuccess = false
        install(ContentNegotiation) { json(json) }
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

    suspend fun oweCreateGroup(name: String, currency: String): OweGroupDto =
        read<OweGroupResponse>(
            request(HttpMethod.Post, "/api/v1/owe-no/groups", OweCreateGroupBody(name, currency)),
        ).group

    suspend fun oweMovements(groupId: String): List<OweMovementDto> =
        read<OweMovementList>(request(HttpMethod.Get, "/api/v1/owe-no/groups/$groupId/movements")).movements

    suspend fun oweBalances(groupId: String): List<OweBalanceDto> =
        read<OweBalanceList>(request(HttpMethod.Get, "/api/v1/owe-no/groups/$groupId/balances")).balances

    suspend fun oweSettlement(groupId: String): OweSettlementDto =
        read(request(HttpMethod.Get, "/api/v1/owe-no/groups/$groupId/settlement"))

    suspend fun oweCreateMovement(groupId: String, body: OweCreateMovementBody): OweMovementDto =
        read<OweMovementResponse>(
            request(HttpMethod.Post, "/api/v1/owe-no/groups/$groupId/movements", body),
        ).movement

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
        if (!refresh()) throw ApiException("unauthorized", 401)
        val second = send(method, path, body)
        if (second.status == HttpStatusCode.Unauthorized) throw ApiException("unauthorized", 401)
        return second
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

    private suspend inline fun <reified T> read(response: HttpResponse): T {
        if (!response.status.isSuccess()) throw errorOf(response)
        return response.body()
    }

    private suspend fun errorOf(response: HttpResponse): ApiException {
        val status = response.status.value
        val envelope = runCatching { response.body<ErrorEnvelope>() }.getOrNull()
        return if (envelope != null) {
            ApiException(envelope.error.code, status, envelope.error.message)
        } else {
            ApiException("http_$status", status, "HTTP $status")
        }
    }

    override fun close() = http.close()
}
