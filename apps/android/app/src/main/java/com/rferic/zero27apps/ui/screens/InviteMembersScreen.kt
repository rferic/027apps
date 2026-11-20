package com.rferic.zero27apps.ui.screens

import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.net.Uri
import android.view.WindowManager
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rferic.zero27apps.data.AdminInvitationRequestDto
import com.rferic.zero27apps.data.InvitationQuotaDto
import com.rferic.zero27apps.data.InvitationRequestDto
import com.rferic.zero27apps.data.InviteeDto
import com.rferic.zero27apps.data.MemberInvitationDto
import com.rferic.zero27apps.data.UserDto
import com.rferic.zero27apps.ui.InviteMembersError
import com.rferic.zero27apps.ui.InviteMembersState
import com.rferic.zero27apps.ui.InviteJoinError
import com.rferic.zero27apps.ui.JoinCodeState
import com.rferic.zero27apps.ui.components.AppAlertDialog
import com.rferic.zero27apps.ui.components.BrandWordmark
import com.rferic.zero27apps.ui.i18n.LocalStrings
import com.rferic.zero27apps.ui.i18n.Strings
import com.rferic.zero27apps.ui.migration.joinCodeQrContent
import com.rferic.zero27apps.ui.migration.qrBitmap
import com.rferic.zero27apps.ui.theme.LocalPalette
import java.time.Instant
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** The quota bar: spent seats over the total the level plus grants allow. */
fun quotaFraction(quota: InvitationQuotaDto): Float {
    if (quota.unlimited) return 0f
    val total = quota.base + quota.granted
    if (total <= 0) return 0f
    return ((quota.used + quota.reserved).toFloat() / total.toFloat()).coerceIn(0f, 1f)
}

/**
 * Whether the QR countdown should mint a fresh join code. The 90-second code is
 * renewed once it drops to 15 seconds, so a scan near the end never gets a dead
 * code mid-flow; the old one stays valid until its own TTL.
 */
fun shouldRenewJoinCode(remainingSeconds: Long): Boolean = remainingSeconds in 1..15

private tailrec fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}

/**
 * How long a pending link has left, as the row shows it: hours and minutes for
 * a day-scale link ("47 h 30 min"), minutes alone under an hour, and the bare
 * hours when the remainder is zero so a fresh 48-hour link reads "48 h" instead
 * of "47 h 59 min". Everything rounds up: truncating printed "0 h" for a
 * one-hour link the second it was minted.
 */
internal fun expiryLabel(
    remainingMillis: Long,
    hoursMinutes: String,
    hours: String,
    minutes: String,
): String {
    val totalMinutes = ((remainingMillis.coerceAtLeast(0) + 59_999) / 60_000).coerceAtLeast(1)
    val wholeHours = totalMinutes / 60
    val restMinutes = totalMinutes % 60
    return when {
        wholeHours == 0L -> minutes.replace("{minutes}", restMinutes.toString())
        restMinutes == 0L -> hours.replace("{hours}", wholeHours.toString())
        else -> hoursMinutes
            .replace("{hours}", wholeHours.toString())
            .replace("{minutes}", restMinutes.toString())
    }
}

/**
 * The one-line message a failed action shows: it replaces the action, so it
 * says what to do next instead of only naming the error.
 */
private fun inviteActionMessage(error: InviteMembersError, strings: Strings): String = when (error) {
    InviteMembersError.RATE_LIMITED -> strings.inviteRateLimitedHint
    InviteMembersError.QUOTA -> strings.inviteNoSeatsHint
    else -> strings.inviteLoadFailedHint
}

/**
 * The invitation screen: the caller's quota, the Invite/Ask actions, their
 * invitees and pending links, their quota requests, and — for an administrator
 * — a read-only list of the pending requests (managed in the panel).
 */
@Composable
fun InviteMembersScreen(
    instance: String,
    user: UserDto,
    state: InviteMembersState,
    joinCode: JoinCodeState,
    createdLink: String?,
    onBack: () -> Unit,
    onRefresh: () -> Unit,
    onCreateLink: () -> Unit,
    onConsumeCreatedLink: () -> Unit,
    onRevoke: (String) -> Unit,
    onRequest: (Int, String?) -> Unit,
    onCancelRequest: (String) -> Unit,
    onConsumeError: () -> Unit,
    onMintQr: () -> Unit,
    onStopQr: () -> Unit,
) {
    val strings = LocalStrings.current
    val palette = LocalPalette.current
    val context = LocalContext.current
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    var showQr by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(Unit) { onRefresh() }

    // A link minted by "Crear enlace" is handed to the clipboard exactly once.
    LaunchedEffect(createdLink) {
        val link = createdLink ?: return@LaunchedEffect
        copyToClipboard(context, link)
        onConsumeCreatedLink()
        scope.launch { snackbar.showSnackbar(strings.inviteCopied) }
    }

    // A failed action used to be silent once the quota was loaded: the error was
    // only drawn while there was no data at all, so "Crear enlace" could answer
    // 429 and look like a dead button.
    LaunchedEffect(state.error, state.quota) {
        val error = state.error ?: return@LaunchedEffect
        if (state.quota == null) return@LaunchedEffect
        snackbar.showSnackbar(inviteActionMessage(error, strings))
        onConsumeError()
    }

    if (showQr) {
        InviteQrScreen(
            instance = instance,
            user = user,
            state = joinCode,
            onMint = onMintQr,
            onStop = onStopQr,
            onClose = { showQr = false },
        )
        return
    }

    Box(Modifier.fillMaxSize().background(palette.background)) {
        Column(
            modifier = Modifier.fillMaxSize().safeDrawingPadding().verticalScroll(rememberScrollState()).padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = onBack, contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp)) {
                    Text("‹", fontSize = 24.sp, color = palette.foreground)
                }
                Spacer(Modifier.size(6.dp))
                Text(
                    strings.invitations,
                    fontSize = 26.sp,
                    fontWeight = FontWeight.Bold,
                )
            }

            when {
                state.loading && state.quota == null -> Box(
                    Modifier.fillMaxWidth().padding(top = 48.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator(color = palette.accent)
                }

                state.error != null && state.quota == null -> ErrorCard(state.error, strings, palette, onRefresh)

                isAdmin(user) -> AdminRequestsSection(
                    requests = state.adminRequests,
                    onManagePanel = { openUrl(context, "$instance/panel/requests") },
                )

                state.quota != null -> MemberContent(
                    quota = state.quota,
                    invitations = state.invitations,
                    invitees = state.invitees,
                    requests = state.requests,
                    onShowQr = { showQr = true },
                    onCreateLink = onCreateLink,
                    onRevoke = onRevoke,
                    onRequest = onRequest,
                    onCancelRequest = onCancelRequest,
                )

                else -> Text(strings.inviteEmpty, color = palette.mutedForeground, fontSize = 13.sp)
            }
        }
        SnackbarHost(snackbar, Modifier.align(Alignment.BottomCenter))
    }
}

private fun isAdmin(user: UserDto): Boolean =
    user.role == "admin" || user.role == "super_admin"

/** The member view: quota, actions, invitees, pending links and requests. */
@Composable
private fun MemberContent(
    quota: InvitationQuotaDto,
    invitations: List<MemberInvitationDto>,
    invitees: List<InviteeDto>,
    requests: List<InvitationRequestDto>,
    onShowQr: () -> Unit,
    onCreateLink: () -> Unit,
    onRevoke: (String) -> Unit,
    onRequest: (Int, String?) -> Unit,
    onCancelRequest: (String) -> Unit,
) {
    val strings = LocalStrings.current
    val palette = LocalPalette.current

    QuotaCard(quota)

    if (quota.remaining > 0) {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Button(
                onClick = onShowQr,
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = palette.accent,
                    contentColor = palette.accentForeground,
                ),
            ) { Text(strings.inviteShowQr, fontSize = 13.sp) }
            Button(
                onClick = onCreateLink,
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = palette.primary,
                    contentColor = palette.primaryForeground,
                ),
            ) { Text(strings.inviteCreateLink, fontSize = 13.sp) }
        }
    } else {
        val pending = quota.pendingRequest
        if (pending != null) {
            PendingRequestCard(pending.id, pending.amount, onCancelRequest)
        } else {
            RequestForm(onSubmit = onRequest)
        }
    }

    InvitedCard(invitees, invitations, onRevoke)

    val resolved = requests.filter { it.state != "pending" }
    if (resolved.isNotEmpty()) {
        for (request in resolved) RequestResultCard(request, quota)
    }

    Text(
        strings.inviteQuotaNote,
        fontSize = 12.sp,
        color = palette.mutedForeground,
    )
}

/** The quota card: the big number, the breakdown and the progress bar. */
@Composable
private fun QuotaCard(quota: InvitationQuotaDto) {
    val strings = LocalStrings.current
    val palette = LocalPalette.current
    val used = quota.used + quota.reserved
    val total = quota.base + quota.granted
    val fraction = quotaFraction(quota)
    val full = quota.remaining <= 0

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(palette.surface, RoundedCornerShape(16.dp))
            .border(1.dp, if (full) palette.destructive else palette.border, RoundedCornerShape(16.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(strings.inviteYourQuota, fontSize = 12.sp, color = palette.mutedForeground, modifier = Modifier.weight(1f))
            if (full) {
                Chip(strings.inviteNoSeats, palette.destructive, palette.destructive.copy(alpha = 0.12f))
            } else if (quota.level != null) {
                Chip(strings.inviteLevelChip.replace("{level}", "${quota.level}"), palette.accent, palette.successSubtle)
            }
        }
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(
                strings.inviteSeatsOf.replace("{used}", "$used").replace("{total}", "$total"),
                fontSize = 30.sp,
                fontWeight = FontWeight.Bold,
                color = if (full) palette.destructive else palette.foreground,
            )
            Text(
                strings.inviteQuotaBreakdown
                    .replace("{used}", "${quota.used}")
                    .replace("{reserved}", "${quota.reserved}")
                    .replace("{base}", "${quota.base}")
                    .replace("{granted}", "${quota.granted}"),
                fontSize = 12.sp,
                color = palette.mutedForeground,
                modifier = Modifier.padding(bottom = 5.dp),
            )
        }
        QuotaBar(fraction, if (full) palette.destructive else palette.accent)
        Text(
            if (full) strings.inviteNoSeatsHint else strings.inviteCanInviteMore.replace("{count}", "${quota.remaining}"),
            fontSize = 12.sp,
            color = palette.mutedForeground,
        )
    }
}

/** A thin rounded progress bar filled to [fraction]. */
@Composable
private fun QuotaBar(fraction: Float, color: Color) {
    val palette = LocalPalette.current
    Box(
        Modifier
            .fillMaxWidth()
            .height(8.dp)
            .clip(RoundedCornerShape(999.dp))
            .background(palette.muted),
    ) {
        Box(
            Modifier
                .fillMaxHeight()
                .fillMaxWidth(fraction)
                .background(color),
        )
    }
}

/** A small labelled pill, the mockup's chip. */
@Composable
private fun Chip(label: String, color: Color, background: Color) {
    val palette = LocalPalette.current
    Text(
        label,
        fontSize = 10.sp,
        fontWeight = FontWeight.Bold,
        color = color,
        modifier = Modifier
            .background(background, RoundedCornerShape(999.dp))
            .padding(horizontal = 8.dp, vertical = 3.dp),
    )
}

/** The people already brought in plus the pending links, with revoke. */
@Composable
private fun InvitedCard(
    invitees: List<InviteeDto>,
    invitations: List<MemberInvitationDto>,
    onRevoke: (String) -> Unit,
) {
    val strings = LocalStrings.current
    val palette = LocalPalette.current
    var revokeTarget by remember { mutableStateOf<String?>(null) }
    if (invitees.isEmpty() && invitations.none { it.state == "pending" }) return

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(palette.surface, RoundedCornerShape(16.dp))
            .border(1.dp, palette.border, RoundedCornerShape(16.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(strings.inviteInvited, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
        for (invitee in invitees) {
            Row(
                Modifier.fillMaxWidth().padding(vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Avatar(invitee.displayName, palette)
                Column(Modifier.weight(1f)) {
                    Text(invitee.displayName, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                    val level = invitee.level?.let { strings.inviteLevelChip.replace("{level}", "$it") }
                        ?: strings.inviteMember
                    Text(level, color = palette.mutedForeground, fontSize = 12.sp)
                }
                val active = invitee.state == "active"
                Chip(
                    if (active) strings.stateActive else strings.stateInactive,
                    if (active) palette.success else palette.mutedForeground,
                    if (active) palette.successSubtle else palette.muted,
                )
            }
        }
        for (invitation in invitations.filter { it.state == "pending" }) {
            Row(
                Modifier.fillMaxWidth().padding(vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Box(
                    Modifier.size(34.dp).background(palette.muted, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Text("·", color = palette.mutedForeground, fontWeight = FontWeight.Bold)
                }
                Column(Modifier.weight(1f)) {
                    Text(strings.invitePendingLink, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                    val remaining = runCatching {
                        Instant.parse(invitation.expiresAt).toEpochMilli() - System.currentTimeMillis()
                    }.getOrNull()
                    Text(
                        if (remaining != null) {
                            expiryLabel(
                                remaining,
                                strings.inviteExpiresInHoursMinutes,
                                strings.inviteExpiresInHours,
                                strings.inviteExpiresInMinutes,
                            )
                        } else {
                            strings.invitePendingLink
                        },
                        color = palette.mutedForeground,
                        fontSize = 12.sp,
                    )
                }
                TextButton(onClick = { revokeTarget = invitation.id }) {
                    Text(strings.inviteRevoke, color = palette.destructive, fontSize = 12.sp)
                }
            }
        }
    }

    // A destructive action: confirm before freeing the seat.
    val target = revokeTarget
    if (target != null) {
        AppAlertDialog(
            onDismissRequest = { revokeTarget = null },
            title = { Text(strings.inviteRevokeTitle) },
            text = { Text(strings.inviteRevokeBody) },
            confirmButton = {
                TextButton(onClick = {
                    revokeTarget = null
                    onRevoke(target)
                }) {
                    Text(strings.inviteRevoke, color = palette.destructive)
                }
            },
            dismissButton = {
                TextButton(onClick = { revokeTarget = null }) { Text(strings.cancel) }
            },
        )
    }
}

/** The "no seats" request form and the pending-request state. */
@Composable
private fun RequestForm(onSubmit: (Int, String?) -> Unit) {
    val strings = LocalStrings.current
    val palette = LocalPalette.current
    var amount by rememberSaveable { mutableStateOf("2") }
    var reason by rememberSaveable { mutableStateOf("") }
    val parsed = amount.toIntOrNull()
    val valid = parsed != null && parsed in 1..20

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(palette.surface, RoundedCornerShape(16.dp))
            .border(1.dp, palette.border, RoundedCornerShape(16.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(strings.inviteRequestTitle, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
        OutlinedTextField(
            value = amount,
            onValueChange = { input -> amount = input.filter(Char::isDigit).take(2) },
            label = { Text(strings.inviteRequestAmount) },
            singleLine = true,
            keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = reason,
            onValueChange = { reason = it.take(280) },
            label = { Text(strings.inviteRequestReason) },
            modifier = Modifier.fillMaxWidth(),
            minLines = 2,
        )
        Button(
            onClick = { if (valid) onSubmit(parsed, reason.trim().ifEmpty { null }) },
            enabled = valid,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
        ) { Text(strings.inviteRequestSubmit, fontSize = 13.sp) }
    }
}

@Composable
private fun PendingRequestCard(id: String, amount: Int, onCancel: (String) -> Unit) {
    val strings = LocalStrings.current
    val palette = LocalPalette.current
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(palette.muted, RoundedCornerShape(16.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(strings.inviteRequestPendingTitle, fontSize = 13.sp, modifier = Modifier.weight(1f))
            Chip(strings.inviteUnderReview, palette.warning, palette.warning.copy(alpha = 0.12f))
        }
        Text(
            strings.inviteRequestSeats.replace("{count}", "$amount"),
            fontSize = 12.sp,
            color = palette.mutedForeground,
        )
        TextButton(onClick = { onCancel(id) }, contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp)) {
            Text(strings.inviteRequestCancel, fontSize = 12.sp, color = palette.destructive)
        }
    }
}

/** The resolved outcome of a previous request, read-only. */
@Composable
private fun RequestResultCard(request: InvitationRequestDto, quota: InvitationQuotaDto) {
    val strings = LocalStrings.current
    val palette = LocalPalette.current
    val (label, color, bg) = when (request.state) {
        "approved" -> Triple(strings.inviteRequestApproved, palette.success, palette.successSubtle)
        "rejected" -> Triple(strings.inviteRequestRejected, palette.destructive, palette.destructive.copy(alpha = 0.12f))
        else -> Triple(strings.inviteRequestCancelled, palette.mutedForeground, palette.muted)
    }
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(palette.surface, RoundedCornerShape(16.dp))
            .border(1.dp, palette.border, RoundedCornerShape(16.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Chip(label, color, bg)
        val note = when (request.state) {
            "approved" -> strings.inviteRequestGranted
                .replace("{count}", "${request.grantedAmount ?: request.amount}") +
                "\n" + strings.inviteRequestGrantedNote.replace("{total}", "${quota.base + quota.granted}")
            "rejected" -> strings.inviteRequestRejectedNote.replace("{reason}", request.resolutionReason.orEmpty())
            else -> strings.inviteRequestCancelledNote
        }
        Text(note, fontSize = 12.sp, color = palette.mutedForeground)
    }
}

/** The administrator's read-only pending requests. */
@Composable
private fun AdminRequestsSection(
    requests: List<AdminInvitationRequestDto>,
    onManagePanel: () -> Unit,
) {
    val strings = LocalStrings.current
    val palette = LocalPalette.current

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(strings.inviteAdminRequestsTitle, fontSize = 20.sp, fontWeight = FontWeight.Bold)
        Text(strings.inviteAdminRequestsLead, fontSize = 12.sp, color = palette.mutedForeground)

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(palette.surface, RoundedCornerShape(16.dp))
                .border(1.dp, palette.border, RoundedCornerShape(16.dp))
                .padding(horizontal = 16.dp, vertical = 4.dp),
        ) {
            if (requests.isEmpty()) {
                Text(
                    strings.inviteEmpty,
                    fontSize = 13.sp,
                    color = palette.mutedForeground,
                    modifier = Modifier.padding(vertical = 16.dp),
                )
            } else {
                for (request in requests) {
                    Row(
                        Modifier.fillMaxWidth().padding(vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Avatar(request.requester.displayName, palette)
                        Column(Modifier.weight(1f)) {
                            Text(request.requester.displayName, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                            Text(
                                strings.inviteAdminRequestAsks.replace("{count}", "${request.amount}"),
                                color = palette.mutedForeground,
                                fontSize = 12.sp,
                            )
                        }
                        Chip(strings.pending, palette.warning, palette.warning.copy(alpha = 0.12f))
                    }
                }
            }
        }

        Button(
            onClick = onManagePanel,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
        ) { Text(strings.inviteManagePanel, fontSize = 13.sp) }
        Text(
            strings.inviteManagePanelNote,
            fontSize = 12.sp,
            color = palette.mutedForeground,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun Avatar(name: String, palette: com.rferic.zero27apps.ui.theme.Palette) {
    Box(
        Modifier.size(34.dp).background(palette.accent, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            name.trim().take(1).uppercase().ifEmpty { "?" },
            color = palette.accentForeground,
            fontWeight = FontWeight.Bold,
            fontSize = 13.sp,
        )
    }
}

/** The load error: offline or rate limited, with a retry. */
@Composable
private fun ErrorCard(
    error: InviteMembersError,
    strings: Strings,
    palette: com.rferic.zero27apps.ui.theme.Palette,
    onRetry: () -> Unit,
) {
    val title = when (error) {
        InviteMembersError.RATE_LIMITED -> strings.inviteTooManyRequests
        else -> strings.inviteLoadFailed
    }
    val hint = when (error) {
        InviteMembersError.RATE_LIMITED -> strings.inviteRateLimitedHint
        else -> strings.inviteLoadFailedHint
    }
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(palette.surface, RoundedCornerShape(16.dp))
            .border(1.dp, palette.destructive, RoundedCornerShape(16.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Chip(
            if (error == InviteMembersError.RATE_LIMITED) strings.inviteTooManyRequests else strings.inviteLoadFailed,
            palette.destructive,
            palette.destructive.copy(alpha = 0.12f),
        )
        Text(title, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
        Text(hint, fontSize = 12.sp, color = palette.mutedForeground)
        TextButton(onClick = onRetry, contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp)) {
            Text(strings.tryAgain, fontSize = 12.sp, color = palette.accent)
        }
    }
}

/** The rotating 90-second QR, protected from screenshots, renewed near expiry. */
@Composable
private fun InviteQrScreen(
    instance: String,
    user: UserDto,
    state: JoinCodeState,
    onMint: () -> Unit,
    onStop: () -> Unit,
    onClose: () -> Unit,
) {
    val strings = LocalStrings.current
    val palette = LocalPalette.current
    val context = LocalContext.current
    val activity = remember(context) { context.findActivity() }

    DisposableEffect(Unit) {
        activity?.window?.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        onMint()
        onDispose {
            activity?.window?.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
            onStop()
        }
    }

    var remaining by remember { mutableStateOf(0L) }
    LaunchedEffect(state.expiresAt) {
        val end = runCatching { Instant.parse(state.expiresAt.orEmpty()) }.getOrNull()
        while (end != null) {
            remaining = ((end.toEpochMilli() - System.currentTimeMillis()) / 1000).coerceAtLeast(0)
            if (remaining <= 0) break
            delay(1_000)
        }
    }

    // Renew once near expiry (~75 s of the 90 s TTL); the old code stays valid.
    var renewedFor by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(state.code, remaining) {
        val code = state.code
        if (code != null && shouldRenewJoinCode(remaining) && renewedFor != code) {
            renewedFor = code
            onMint()
        }
    }

    val bitmap = remember(state.code) {
        state.code?.let { code ->
            runCatching { qrBitmap(joinCodeQrContent(instance, code)) }.getOrNull()
        }
    }

    Box(Modifier.fillMaxSize().background(palette.background)) {
        Column(
            modifier = Modifier.fillMaxSize().safeDrawingPadding().verticalScroll(rememberScrollState()).padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = onClose, contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp)) {
                    Text("‹", fontSize = 24.sp, color = palette.foreground)
                }
                Spacer(Modifier.size(6.dp))
                Text(strings.inviteShowQr, fontSize = 20.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            }

            Spacer(Modifier.height(20.dp))
            Text(strings.inviteQrLead, style = MaterialTheme.typography.titleMedium, textAlign = TextAlign.Center)
            Spacer(Modifier.height(4.dp))
            Text(
                "${user.displayName} · ${instance.removePrefix("https://").removePrefix("http://")}",
                fontSize = 12.sp,
                color = palette.mutedForeground,
            )

            when {
                state.loading && bitmap == null -> {
                    Spacer(Modifier.height(24.dp))
                    CircularProgressIndicator(color = palette.accent)
                }

                state.error != null -> {
                    Spacer(Modifier.height(24.dp))
                    Text(
                        qrErrorText(state.error, strings),
                        color = MaterialTheme.colorScheme.error,
                        textAlign = TextAlign.Center,
                        fontSize = 13.sp,
                    )
                    Spacer(Modifier.height(8.dp))
                    Button(onClick = onMint) { Text(strings.tryAgain) }
                }

                bitmap != null -> {
                    Spacer(Modifier.height(20.dp))
                    Box(
                        Modifier
                            .background(Color.White, RoundedCornerShape(12.dp))
                            .border(1.dp, palette.border, RoundedCornerShape(12.dp))
                            .padding(10.dp),
                    ) {
                        Image(
                            bitmap = bitmap.asImageBitmap(),
                            contentDescription = strings.inviteQrDescription,
                            modifier = Modifier.size(240.dp),
                        )
                    }
                    Spacer(Modifier.height(12.dp))
                    Text(
                        "${strings.inviteQrExpiresIn} ${remaining}s",
                        fontSize = 13.sp,
                        color = if (remaining <= 15) MaterialTheme.colorScheme.error else palette.mutedForeground,
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(strings.inviteQrRenews, fontSize = 11.sp, color = palette.mutedForeground, textAlign = TextAlign.Center)
                    Spacer(Modifier.height(10.dp))
                    Button(
                        onClick = {
                            state.code?.let { code ->
                                copyToClipboard(context, joinCodeQrContent(instance, code))
                            }
                        },
                    ) { Text(strings.inviteQrCopyLink) }
                }
            }

            Spacer(Modifier.height(12.dp))
            Text(strings.inviteQrNote, fontSize = 11.sp, color = palette.mutedForeground, textAlign = TextAlign.Center)
            Spacer(Modifier.height(6.dp))
            Chip(strings.inviteQrSecure, palette.warning, palette.warning.copy(alpha = 0.12f))

            Spacer(Modifier.height(16.dp))
            BrandWordmark(height = 16.dp)
        }
    }
}

private fun qrErrorText(error: InviteJoinError, strings: Strings): String = when (error) {
    InviteJoinError.QUOTA_EXHAUSTED -> strings.inviteNoSeatsHint
    InviteJoinError.RATE_LIMITED -> strings.inviteRateLimitedHint
    InviteJoinError.NETWORK -> strings.inviteLoadFailedHint
    InviteJoinError.GENERIC -> strings.inviteLoadFailed
}

private fun copyToClipboard(context: Context, text: String) {
    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    clipboard.setPrimaryClip(ClipData.newPlainText("link", text))
}

private fun openUrl(context: Context, url: String) {
    runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
}
