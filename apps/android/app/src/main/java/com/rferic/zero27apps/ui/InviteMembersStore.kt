package com.rferic.zero27apps.ui

import com.rferic.zero27apps.data.ApiClient
import com.rferic.zero27apps.data.ApiException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Owns the invitation screen's state transitions. A plain class with no Android
 * dependency, so the tests drive it with a MockEngine and a test dispatcher —
 * the AppViewModel delegates to one instance and the UI stays a thin renderer.
 *
 * The join-code token and the created link live only here, in memory: the token
 * is returned once by the API and is never persisted.
 */
class InviteMembersStore(
    private val scope: CoroutineScope,
    /** The signed-in client, or null when there is no session yet. */
    private val api: () -> ApiClient?,
    /** Whether the caller is an administrator (drives the read-only list). */
    private val isAdmin: () -> Boolean,
    /** The instance base URL, to build the shareable link. */
    private val instanceBase: () -> String,
) {
    private val _state = MutableStateFlow(InviteMembersState())
    val state: StateFlow<InviteMembersState> = _state.asStateFlow()

    private val _joinCode = MutableStateFlow(JoinCodeState())
    val joinCode: StateFlow<JoinCodeState> = _joinCode.asStateFlow()

    /** The full link to copy after `POST /me/invitations`; consumed by the screen. */
    private val _createdLink = MutableStateFlow<String?>(null)
    val createdLink: StateFlow<String?> = _createdLink.asStateFlow()

    /** Loads the quota, invitations, invitees and requests (and admin list). */
    fun load() {
        val client = api() ?: return
        _state.value = _state.value.copy(loading = true, error = null)
        scope.launch {
            try {
                fetch(client)
            } catch (error: Exception) {
                if (error is CancellationException) throw error
                _state.value = InviteMembersState(error = inviteError(error))
            }
        }
    }

    private suspend fun fetch(client: ApiClient) {
        val data = client.myInvitations()
        val adminRequests = if (isAdmin()) {
            runCatching { client.adminInvitationRequests() }.getOrDefault(emptyList())
        } else {
            emptyList()
        }
        _state.value = InviteMembersState(
            quota = data.quota,
            invitations = data.invitations,
            invitees = data.invitees,
            requests = data.requests,
            adminRequests = adminRequests,
        )
    }

    /** Silently refreshes the state after a change, keeping the data on failure. */
    private fun reload() {
        val client = api() ?: return
        scope.launch { runCatching { fetch(client) } }
    }

    /** `POST /me/invitations`: mints a link and exposes its URL exactly once. */
    fun createLink() {
        val client = api() ?: return
        scope.launch {
            try {
                val created = client.createMemberInvitation()
                _createdLink.value = instanceBase().trimEnd('/') + created.path
                reload()
            } catch (error: Exception) {
                if (error is CancellationException) throw error
                _state.value = _state.value.copy(error = inviteError(error))
            }
        }
    }

    /** Consumes the link the screen copied, so a re-open does not copy it twice. */
    fun consumeCreatedLink() {
        _createdLink.value = null
    }

    /**
     * Clears a mutation failure once the screen has shown it. The state keeps
     * the loaded quota and links: only the one-shot message is consumed, so the
     * next failure of the same kind shows up again.
     */
    fun consumeError() {
        _state.value = _state.value.copy(error = null)
    }

    /** `DELETE /me/invitations/{id}`: revoke one of the caller's pending invitations. */
    fun revoke(id: String) {
        val client = api() ?: return
        scope.launch {
            try {
                client.revokeMemberInvitation(id)
                reload()
            } catch (error: Exception) {
                if (error is CancellationException) throw error
                _state.value = _state.value.copy(error = inviteError(error))
            }
        }
    }

    /** `POST /me/invitation-requests`: ask the administrator for more seats. */
    fun request(amount: Int, reason: String?) {
        val client = api() ?: return
        scope.launch {
            try {
                client.requestInvitationQuota(amount, reason)
                reload()
            } catch (error: Exception) {
                if (error is CancellationException) throw error
                _state.value = _state.value.copy(error = inviteError(error))
            }
        }
    }

    /** `POST /me/invitation-requests/{id}/cancel`: withdraw a pending request. */
    fun cancelRequest(id: String) {
        val client = api() ?: return
        scope.launch {
            try {
                client.cancelInvitationRequest(id)
                reload()
            } catch (error: Exception) {
                if (error is CancellationException) throw error
                _state.value = _state.value.copy(error = inviteError(error))
            }
        }
    }

    /** `POST /me/join-codes`: mint a 90-second QR code; the screen renews it. */
    fun createJoinCode() {
        val client = api() ?: return
        // Keep the current code on screen while a renewal is in flight: the old
        // one stays valid until its own TTL, so nothing needs to be hidden.
        _joinCode.value = _joinCode.value.copy(loading = true, error = null)
        scope.launch {
            try {
                val created = client.createJoinCode()
                _joinCode.value = JoinCodeState(
                    code = created.code,
                    path = created.path,
                    expiresAt = created.expiresAt,
                )
            } catch (error: Exception) {
                if (error is CancellationException) throw error
                _joinCode.value = JoinCodeState(error = joinCodeError(error))
            }
        }
    }

    /** Leaving the QR screen forgets the code; the token is never persisted. */
    fun stopJoinCode() {
        _joinCode.value = JoinCodeState()
    }

    private fun inviteError(error: Exception): InviteMembersError = when {
        error is java.io.IOException || error.cause is java.io.IOException -> InviteMembersError.NETWORK
        (error as? ApiException)?.code == "rate_limited" -> InviteMembersError.RATE_LIMITED
        (error as? ApiException)?.code == "invitation_quota_exhausted" -> InviteMembersError.QUOTA
        else -> InviteMembersError.GENERIC
    }

    private fun joinCodeError(error: Exception): InviteJoinError = when {
        error is java.io.IOException || error.cause is java.io.IOException -> InviteJoinError.NETWORK
        (error as? ApiException)?.code == "invitation_quota_exhausted" -> InviteJoinError.QUOTA_EXHAUSTED
        (error as? ApiException)?.code == "rate_limited" -> InviteJoinError.RATE_LIMITED
        else -> InviteJoinError.GENERIC
    }
}
