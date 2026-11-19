package com.rferic.zero27apps

import com.rferic.zero27apps.data.AdminInvitationRequestDto
import com.rferic.zero27apps.data.ApiClient
import com.rferic.zero27apps.data.InvitationQuotaDto
import com.rferic.zero27apps.data.RefreshResult
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import com.rferic.zero27apps.ui.screens.quotaFraction
import com.rferic.zero27apps.ui.migration.joinCodeQrContent

/**
 * The invitation screen's plumbing, tested the same way as the rest of the app:
 * the quota bar is a pure fraction, the QR encodes a link the app reads back,
 * and every endpoint goes through [ApiClient] against a MockEngine so the DTO
 * fields are checked against the Core contract.
 */
class InviteMembersTest {
    private fun ok(body: String, status: HttpStatusCode = HttpStatusCode.OK) = MockEngine { _ ->
        respond(body, status, headersOf(HttpHeaders.ContentType, "application/json"))
    }

    private fun client(engine: MockEngine, token: () -> String? = { "token" }) =
        ApiClient("https://example.test", engine, token, { RefreshResult.NoSession }, {})

    // --- Quota bar ---------------------------------------------------------

    @Test
    fun `quota bar counts used plus reserved over base plus granted`() {
        val quota = InvitationQuotaDto(base = 5, granted = 1, used = 1, reserved = 1, remaining = 4)
        assertEquals(2f / 6f, quotaFraction(quota), 0.0001f)

        // Administrators have no quota bar to fill.
        assertEquals(0f, quotaFraction(InvitationQuotaDto(unlimited = true)), 0f)
        // A zeroed denominator (level 0, empty levels) fills nothing instead of dividing by zero.
        assertEquals(0f, quotaFraction(InvitationQuotaDto()), 0f)
        assertEquals(0f, quotaFraction(InvitationQuotaDto(used = 2, reserved = 1)), 0f)
    }

    @Test
    fun `quota bar is clamped when reservations exceed the top`() {
        val quota = InvitationQuotaDto(base = 1, granted = 0, used = 1, reserved = 1)
        assertEquals(1f, quotaFraction(quota), 0f)
    }

    // --- Member invitations --------------------------------------------------

    @Test
    fun `parses the member invitations response with quota, invitees and requests`() = runTest {
        val engine = ok(
            """
            {"quota":{"level":2,"base":2,"granted":1,"used":1,"reserved":1,"remaining":1,
              "unlimited":false,"pending_request":{"id":"r1","amount":2,"created_at":"2026-11-18T10:00:00.000Z"}},
             "invitations":[{"id":"i1","state":"pending","source":"member",
               "expires_at":"2026-11-20T10:00:00.000Z","path":null,"redeemed_by":null,
               "created_at":"2026-11-18T10:00:00.000Z"}],
             "invitees":[{"id":"u1","display_name":"Ana","level":3,"state":"active",
               "joined_at":"2026-11-10T10:00:00.000Z"}],
             "requests":[{"id":"r1","amount":2,"reason":null,"state":"approved",
               "granted_amount":2,"resolution_reason":null,"resolved_by":null,
               "resolved_at":"2026-11-18T11:00:00.000Z","created_at":"2026-11-18T10:00:00.000Z"}]}
            """,
        )
        val result = client(engine).myInvitations()

        val quota = result.quota
        assertEquals(2, quota.level)
        assertEquals(2, quota.base)
        assertEquals(1, quota.granted)
        assertEquals(1, quota.remaining)
        assertEquals("r1", quota.pendingRequest?.id)
        assertEquals(2, quota.pendingRequest?.amount)

        assertEquals("i1", result.invitations.single().id)
        assertEquals("member", result.invitations.single().source)
        assertEquals("Ana", result.invitees.single().displayName)
        assertEquals(3, result.invitees.single().level)
        assertEquals("approved", result.requests.single().state)
        assertEquals(2, result.requests.single().grantedAmount)
    }

    @Test
    fun `creating a link returns the token and path once`() = runTest {
        var seenMethod = HttpMethod.Get
        var seenPath = ""
        val engine = MockEngine { request ->
            seenMethod = request.method
            seenPath = request.url.encodedPath
            respond(
                """{"invitation":{"id":"i2","state":"pending"},"token":"027_inv_abcdefgh","path":"/invite/027_inv_abcdefgh"}""",
                HttpStatusCode.Created,
                headersOf(HttpHeaders.ContentType, "application/json"),
            )
        }
        val created = client(engine).createMemberInvitation()

        assertEquals(HttpMethod.Post, seenMethod)
        assertEquals("/api/v1/me/invitations", seenPath)
        assertEquals("027_inv_abcdefgh", created.token)
        assertEquals("/invite/027_inv_abcdefgh", created.path)
    }

    @Test
    fun `revoking an invitation deletes the caller's own id`() = runTest {
        var seenPath = ""
        val engine = MockEngine { request ->
            seenPath = request.url.encodedPath
            respond("", HttpStatusCode.NoContent)
        }
        client(engine).revokeMemberInvitation("i1")

        assertEquals("/api/v1/me/invitations/i1", seenPath)
    }

    // --- QR join code --------------------------------------------------------

    @Test
    fun `a join code is minted with its path and expiry`() = runTest {
        val engine = ok(
            """{"id":"c1","code":"027_join_abcdefgh","expires_at":"2026-11-18T10:01:30.000Z","path":"/join/027_join_abcdefgh"}""",
            HttpStatusCode.Created,
        )
        val code = client(engine).createJoinCode()

        assertEquals("c1", code.id)
        assertTrue(code.code.startsWith("027_join_"))
        assertEquals("/join/${code.code}", code.path)
        assertEquals("2026-11-18T10:01:30.000Z", code.expiresAt)
    }

    @Test
    fun `an https instance encodes the join link and a local one the debug scheme`() {
        assertEquals(
            "https://027apps.ericrf.com/join/027_join_abcdefgh",
            joinCodeQrContent("https://027apps.ericrf.com/", "027_join_abcdefgh"),
        )
        val local = joinCodeQrContent("http://192.168.1.108:3003", "027_join_abcdefgh")
        assertTrue(local.startsWith("zero27apps-dev://join/027_join_abcdefgh?instance="))
    }

    // --- Quota requests -------------------------------------------------------

    @Test
    fun `a request is posted and parsed`() = runTest {
        var seenBody = ""
        val engine = MockEngine { request ->
            seenBody = (request.body as io.ktor.http.content.TextContent).text
            respond(
                """{"request":{"id":"r9","amount":2,"reason":"hermana","state":"pending",
                  "granted_amount":null,"resolution_reason":null,"resolved_by":null,
                  "resolved_at":null,"created_at":"2026-11-18T12:00:00.000Z"}}""",
                HttpStatusCode.Created,
                headersOf(HttpHeaders.ContentType, "application/json"),
            )
        }
        val request = client(engine).requestInvitationQuota(2, "hermana")

        assertTrue(seenBody.contains("\"amount\":2"))
        assertTrue(seenBody.contains("hermana"))
        assertEquals("r9", request.id)
        assertEquals("pending", request.state)
        assertEquals(2, request.amount)
    }

    @Test
    fun `a pending request can be cancelled`() = runTest {
        var seenPath = ""
        val engine = MockEngine { request ->
            seenPath = request.url.encodedPath
            respond("", HttpStatusCode.NoContent)
        }
        client(engine).cancelInvitationRequest("r9")

        assertEquals("/api/v1/me/invitation-requests/r9/cancel", seenPath)
    }

    // --- Admin read-only requests --------------------------------------------

    @Test
    fun `an admin sees pending requests read only`() = runTest {
        var seenPath = ""
        var seenState = ""
        val engine = MockEngine { request ->
            seenPath = request.url.encodedPath
            seenState = request.url.parameters["state"] ?: ""
            respond(
                """
                {"requests":[
                  {"id":"r1","requester":{"id":"u1","display_name":"Ana","level":1},
                   "amount":2,"reason":"mi hermana","state":"pending",
                   "created_at":"2026-11-18T09:00:00.000Z"},
                  {"id":"r2","requester":{"id":"u2","display_name":"Luis","level":3},
                   "amount":1,"reason":null,"state":"pending",
                   "created_at":"2026-11-17T09:00:00.000Z"}],
                 "total":2,"limit":20,"offset":0}
                """,
                HttpStatusCode.OK,
                headersOf(HttpHeaders.ContentType, "application/json"),
            )
        }
        val requests: List<AdminInvitationRequestDto> = client(engine).adminInvitationRequests()

        assertEquals("/api/v1/invitation-requests", seenPath)
        assertEquals("pending", seenState)
        assertEquals(2, requests.size)
        assertEquals("Ana", requests.first().requester.displayName)
        assertEquals(1, requests.first().requester.level)
        assertEquals(2, requests.first().amount)
        assertEquals("pending", requests.last().state)
    }
}
