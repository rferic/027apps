package com.rferic.zero27apps

import com.rferic.zero27apps.data.ApiClient
import com.rferic.zero27apps.data.RefreshResult
import com.rferic.zero27apps.ui.InviteMembersError
import com.rferic.zero27apps.ui.InviteMembersStore
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The invitation screen's state machine, driven with a MockEngine and real
 * coroutines. Each test waits for the state it asserts instead of draining a
 * virtual scheduler, because Ktor completes the HTTP call on its own
 * dispatcher; the wait makes the transition — not the dispatcher — the thing
 * under test.
 */
class InviteMembersStoreTest {
    private val json = headersOf(HttpHeaders.ContentType, "application/json")
    private val timeoutMs = 5_000L

    private fun store(
        engine: MockEngine,
        scope: CoroutineScope,
        isAdmin: Boolean = false,
    ) = InviteMembersStore(
        scope = scope,
        api = {
            ApiClient("https://example.test", engine, { "token" }, { RefreshResult.NoSession }, {})
        },
        isAdmin = { isAdmin },
        instanceBase = { "https://example.test" },
    )

    private val meWithPending = """
        {"quota":{"level":1,"base":5,"granted":0,"used":5,"reserved":0,"remaining":0,
          "unlimited":false,"pending_request":{"id":"r9","amount":2,"created_at":"2026-11-18T10:00:00.000Z"}},
         "invitations":[],"invitees":[],"requests":[]}
    """.trimIndent()

    @Test
    fun `creating a link exposes the path once and reloads the invitation`() = runBlocking {
        var posts = 0
        var gets = 0
        val engine = MockEngine { request ->
            when {
                request.method == HttpMethod.Post && request.url.encodedPath == "/api/v1/me/invitations" -> {
                    posts++
                    respond(
                        """{"invitation":{"id":"i2"},"token":"027_inv_new","path":"/invite/027_inv_new"}""",
                        HttpStatusCode.Created,
                        json,
                    )
                }
                request.url.encodedPath == "/api/v1/me/invitations" -> {
                    gets++
                    respond(
                        """{"quota":{"base":5,"granted":0,"used":0,"reserved":1,"remaining":4,"unlimited":false},
                            "invitations":[{"id":"i2","state":"pending","source":"member"}],"invitees":[],"requests":[]}""",
                        HttpStatusCode.OK,
                        json,
                    )
                }
                else -> respond("{}", HttpStatusCode.OK, json)
            }
        }
        val store = store(engine, this)

        store.createLink()

        val link = withTimeout(timeoutMs) { store.createdLink.first { it != null } }
        assertEquals(1, posts)
        assertEquals("https://example.test/invite/027_inv_new", link)
        store.consumeCreatedLink()
        assertNull(store.createdLink.value)

        withTimeout(timeoutMs) { store.state.first { it.invitations.size == 1 } }
        assertEquals(1, gets)
    }

    @Test
    fun `a rejected link keeps the quota and reports why, once`() = runBlocking {
        val engine = MockEngine { request ->
            when {
                request.method == HttpMethod.Post && request.url.encodedPath == "/api/v1/me/invitations" ->
                    respond(
                        """{"error":{"code":"rate_limited"}}""",
                        HttpStatusCode.TooManyRequests,
                        json,
                    )
                else -> respond(
                    """{"quota":{"base":5,"granted":0,"used":0,"reserved":0,"remaining":5,"unlimited":false},
                        "invitations":[],"invitees":[],"requests":[]}""",
                    HttpStatusCode.OK,
                    json,
                )
            }
        }
        val store = store(engine, this)
        store.load()
        withTimeout(timeoutMs) { store.state.first { it.quota != null } }

        store.createLink()

        // The quota stays on screen: only the message is new, so the button is
        // not replaced by a full-screen error card.
        val failed = withTimeout(timeoutMs) { store.state.first { it.error != null } }
        assertEquals(InviteMembersError.RATE_LIMITED, failed.error)
        assertEquals(5, failed.quota?.remaining)

        store.consumeError()
        assertNull(store.state.value.error)
        assertEquals(5, store.state.value.quota?.remaining)
    }

    @Test
    fun `a spent quota is reported as such`() = runBlocking {
        val engine = MockEngine { request ->
            when {
                request.method == HttpMethod.Post && request.url.encodedPath == "/api/v1/me/invitations" ->
                    respond(
                        """{"error":{"code":"invitation_quota_exhausted"}}""",
                        HttpStatusCode.Conflict,
                        json,
                    )
                else -> respond(
                    """{"quota":{"base":5,"granted":0,"used":0,"reserved":0,"remaining":5,"unlimited":false},
                        "invitations":[],"invitees":[],"requests":[]}""",
                    HttpStatusCode.OK,
                    json,
                )
            }
        }
        val store = store(engine, this)

        store.createLink()

        val failed = withTimeout(timeoutMs) { store.state.first { it.error != null } }
        assertEquals(InviteMembersError.QUOTA, failed.error)
    }

    @Test
    fun `a join code is minted and replaced by a new one`() = runBlocking {
        var mints = 0
        val engine = MockEngine { _ ->
            mints++
            respond(
                """{"id":"c$mints","code":"027_join_code$mints","expires_at":"2026-11-18T10:01:30.000Z","path":"/join/027_join_code$mints"}""",
                HttpStatusCode.Created,
                json,
            )
        }
        val store = store(engine, this)

        store.createJoinCode()
        val first = withTimeout(timeoutMs) { store.joinCode.first { !it.loading && it.code != null } }
        assertEquals(null, first.error)
        assertEquals("027_join_code1", first.code)

        // A renewal mints a fresh code, replacing the previous one.
        store.createJoinCode()
        val second = withTimeout(timeoutMs) { store.joinCode.first { it.code == "027_join_code2" } }
        assertEquals("027_join_code2", second.code)
        assertEquals(2, mints)
    }

    @Test
    fun `a request shows pending and can be cancelled`() = runBlocking {
        val cancelled = CompletableDeferred<Unit>()
        val engine = MockEngine { request ->
            when {
                request.method == HttpMethod.Post &&
                    request.url.encodedPath == "/api/v1/me/invitation-requests/r9/cancel" -> {
                    cancelled.complete(Unit)
                    respond("", HttpStatusCode.NoContent)
                }
                else -> respond(meWithPending, HttpStatusCode.OK, json)
            }
        }
        val store = store(engine, this)

        store.load()
        val loaded = withTimeout(timeoutMs) {
            store.state.first { it.quota?.pendingRequest?.id == "r9" }
        }
        assertEquals(2, loaded.quota?.pendingRequest?.amount)

        store.cancelRequest("r9")
        withTimeout(timeoutMs) { cancelled.await() }
    }

    @Test
    fun `requesting quota posts the amount and reason`() = runBlocking {
        val body = CompletableDeferred<String>()
        val engine = MockEngine { request ->
            if (request.method == HttpMethod.Post &&
                request.url.encodedPath == "/api/v1/me/invitation-requests"
            ) {
                body.complete((request.body as io.ktor.http.content.TextContent).text)
                respond(
                    """{"request":{"id":"r9","amount":2,"state":"pending","created_at":"2026-11-18T10:00:00.000Z"}}""",
                    HttpStatusCode.Created,
                    json,
                )
            } else {
                respond(meWithPending, HttpStatusCode.OK, json)
            }
        }
        val store = store(engine, this)

        store.request(2, "mi hermana")

        val payload = withTimeout(timeoutMs) { body.await() }
        assertTrue(payload.contains("\"amount\":2"))
        assertTrue(payload.contains("mi hermana"))
    }

    @Test
    fun `an admin sees the pending requests read only`() = runBlocking {
        val engine = MockEngine { request ->
            when (request.url.encodedPath) {
                "/api/v1/invitation-requests" -> respond(
                    """{"requests":[
                        {"id":"r1","requester":{"id":"u1","display_name":"Ana","level":1},"amount":2,"state":"pending","created_at":"2026-11-18T09:00:00.000Z"},
                        {"id":"r2","requester":{"id":"u2","display_name":"Luis","level":3},"amount":1,"state":"pending","created_at":"2026-11-17T09:00:00.000Z"}],
                       "total":2}""",
                    HttpStatusCode.OK,
                    json,
                )
                else -> respond(meWithPending, HttpStatusCode.OK, json)
            }
        }
        val store = store(engine, this, isAdmin = true)

        store.load()

        val state = withTimeout(timeoutMs) { store.state.first { it.adminRequests.size == 2 } }
        assertEquals("Ana", state.adminRequests.first().requester.displayName)
    }

    @Test
    fun `a member never fetches the admin list`() = runBlocking {
        var adminCalled = false
        val engine = MockEngine { request ->
            if (request.url.encodedPath == "/api/v1/invitation-requests") adminCalled = true
            respond(meWithPending, HttpStatusCode.OK, json)
        }
        val store = store(engine, this, isAdmin = false)

        store.load()
        withTimeout(timeoutMs) { store.state.first { it.quota?.pendingRequest?.id == "r9" } }

        assertFalse(adminCalled)
        assertTrue(store.state.value.adminRequests.isEmpty())
    }
}
