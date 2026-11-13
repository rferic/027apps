package com.rferic.zero27apps.data

import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.engine.mock.respondError
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import java.io.IOException
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ApiClientTest {
    private fun ok(body: String) = MockEngine { request ->
        respond(
            content = body,
            status = HttpStatusCode.OK,
            headers = headersOf(HttpHeaders.ContentType, "application/json"),
        )
    }

    private fun client(
        engine: MockEngine,
        token: () -> String? = { "token" },
        refresh: suspend () -> Boolean = { false },
    ) = ApiClient("https://example.test", engine, token, refresh)

    @Test
    fun `parses instance with the auth block and ignores unknown keys`() = runTest {
        val engine = ok(
            """
            {"version":"0.0.1","requires_setup":false,"setup_incomplete":false,
             "auth":{"supabase_url":"https://p.supabase.co","supabase_anon_key":"anon"},
             "settings_public":{"instance.name":"027Apps"},"future_field":true}
            """,
        )
        val instance = client(engine).instance()

        assertEquals("0.0.1", instance.version)
        assertEquals("https://p.supabase.co", instance.auth?.supabaseUrl)
        assertEquals("anon", instance.auth?.supabaseAnonKey)
    }

    @Test
    fun `parses me and the modules list`() = runTest {
        val me = ok(
            """{"user":{"id":"u1","display_name":"Ana","locale":"es","theme":"dark","role":"user"}}""",
        )
        assertEquals("Ana", client(me).me().displayName)
        assertEquals("dark", client(me).me().theme)

        val modules = ok(
            """{"modules":[{"key":"owe-no","name":"OweNo","state":"active"}],"total":1,"limit":50,"offset":0}""",
        )
        val list = client(modules).myModules()
        assertEquals(1, list.total)
        assertEquals("owe-no", list.modules.single().key)
    }

    @Test
    fun `maps the Core error envelope to a code`() = runTest {
        val engine = MockEngine {
            respond(
                content = """{"error":{"code":"invitation_expired","message":"The invitation is past its expiry"}}""",
                status = HttpStatusCode.Conflict,
                headers = headersOf(HttpHeaders.ContentType, "application/json"),
            )
        }
        val error = runCatching { client(engine).me() }.exceptionOrNull()

        assertTrue(error is ApiException)
        assertEquals("invitation_expired", (error as ApiException).code)
        assertEquals(409, error.status)
    }

    @Test
    fun `refreshes the session once after a 401 and retries`() = runTest {
        var calls = 0
        var token = "old"
        var refreshed = 0
        val engine = MockEngine {
            calls++
            if (calls == 1) {
                respondError(HttpStatusCode.Unauthorized)
            } else {
                respond(
                    content = """{"user":{"id":"u1","display_name":"Ana"}}""",
                    status = HttpStatusCode.OK,
                    headers = headersOf(HttpHeaders.ContentType, "application/json"),
                )
            }
        }
        val api = client(
            engine,
            token = { token },
            refresh = {
                refreshed++
                token = "new"
                true
            },
        )

        assertEquals("Ana", api.me().displayName)
        assertEquals(2, calls)
        assertEquals(1, refreshed)
        assertEquals("Bearer new", engine.requestHistory.last().headers[HttpHeaders.Authorization])
    }

    @Test
    fun `a second 401 ends the session`() = runTest {
        val engine = MockEngine { respondError(HttpStatusCode.Unauthorized) }
        val error = runCatching { client(engine, token = { "t" }).me() }.exceptionOrNull()

        assertTrue(error is ApiException)
        assertEquals("unauthorized", (error as ApiException).code)
    }

    @Test
    fun `reports a network failure separately from an API error`() = runTest {
        val engine = MockEngine { throw IOException("offline") }
        val error = runCatching { client(engine).instance() }.exceptionOrNull()

        assertTrue(error is ApiException)
        assertEquals("network_error", (error as ApiException).code)
        assertTrue(error.network)
    }
}
