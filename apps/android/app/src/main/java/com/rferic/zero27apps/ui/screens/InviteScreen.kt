package com.rferic.zero27apps.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rferic.zero27apps.auth.InvitationLink
import com.rferic.zero27apps.data.InvitationPreviewDto
import com.rferic.zero27apps.ui.InviteError
import com.rferic.zero27apps.ui.InviteState
import com.rferic.zero27apps.ui.components.BrandTile
import com.rferic.zero27apps.ui.components.BrandWordmark
import com.rferic.zero27apps.ui.components.EyeIcon
import com.rferic.zero27apps.ui.i18n.AppStrings
import com.rferic.zero27apps.ui.i18n.LocalStrings
import com.rferic.zero27apps.ui.i18n.Strings
import com.rferic.zero27apps.ui.theme.LocalPalette
import com.rferic.zero27apps.ui.theme.appGradient
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Locale

private fun inviteErrorText(error: InviteError, strings: Strings): String = when (error) {
    InviteError.EXPIRED -> strings.inviteExpired
    InviteError.USED -> strings.inviteUsed
    InviteError.NOT_FOUND -> strings.inviteNotFound
    InviteError.NETWORK -> strings.failureNetwork
    InviteError.WRONG_CREDENTIALS -> strings.inviteWrongPassword
    InviteError.EXISTING_SIGNIN_REQUIRED -> strings.inviteSignInRequired
    InviteError.RATE_LIMITED -> strings.inviteRateLimited
    InviteError.CONFLICT -> strings.inviteAccountDeactivated
    InviteError.GENERIC -> strings.inviteFailed
}

/** The invitation's expiry in its own locale and time zone, or the ISO value. */
private fun expiryText(preview: InvitationPreviewDto): String = runCatching {
    DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM)
        .withLocale(Locale.forLanguageTag(preview.locale))
        .withZone(ZoneId.of(preview.timezone))
        .format(Instant.parse(preview.expiresAt))
}.getOrDefault(preview.expiresAt)

@Composable
private fun Detail(label: String, value: String) {
    val palette = LocalPalette.current
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            label,
            fontSize = 12.sp,
            color = palette.mutedForeground,
            modifier = Modifier.weight(1f),
        )
        Text(value, fontSize = 13.sp, textAlign = TextAlign.End, modifier = Modifier.weight(1f))
    }
}

@Composable
private fun InvitationCard(
    preview: InvitationPreviewDto,
    strings: Strings,
) {
    val palette = LocalPalette.current
    val role = when {
        !preview.roleApplies -> strings.inviteCurrentRole
        preview.role == "admin" -> strings.inviteAdmin
        else -> strings.inviteMember
    }
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(palette.surface, RoundedCornerShape(16.dp))
            .border(1.dp, palette.border, RoundedCornerShape(16.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Detail(strings.email, preview.email)
        Detail(strings.inviteDetailsName, preview.name)
        Detail(strings.inviteInstance, preview.instanceName)
        Detail(strings.inviteInvitedBy, preview.inviterName ?: preview.instanceName)
        Detail(strings.inviteRole, role)
        Detail(strings.inviteExpires, expiryText(preview))
    }
}

/**
 * Invitation redemption. Everything the token carries is a read-only card; only
 * the password (and its confirmation for a new account) is editable. The token
 * never reaches the UI copy and is only sent back to redeem.
 */
@Composable
fun InviteScreen(
    link: InvitationLink,
    state: InviteState,
    onSubmit: (password: String) -> Unit,
    onRetry: () -> Unit,
    onCancel: () -> Unit,
) {
    val palette = LocalPalette.current
    val fallback = LocalStrings.current
    val preview = state.preview
    val strings = remember(preview?.locale) {
        preview?.let { AppStrings.forLanguage(it.locale) } ?: fallback
    }
    var password by rememberSaveable { mutableStateOf("") }
    var confirmation by rememberSaveable { mutableStateOf("") }
    var passwordVisible by rememberSaveable { mutableStateOf(false) }
    val existing = preview?.accountExists == true
    val valid = when {
        existing -> password.isNotEmpty()
        else -> password.length >= 12 && confirmation == password
    }
    val context = LocalContext.current

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(appGradient(palette)),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .imePadding()
                .padding(horizontal = 24.dp, vertical = 32.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            BrandTile(size = 64.dp)
            Spacer(Modifier.height(16.dp))
            BrandWordmark(height = 28.dp)
            Spacer(Modifier.height(6.dp))
            Text(
                link.instance.removePrefix("https://").removePrefix("http://"),
                fontSize = 11.sp,
                color = palette.mutedForeground,
            )
            Spacer(Modifier.height(18.dp))
            Text(
                strings.inviteTitle,
                style = MaterialTheme.typography.headlineSmall,
                textAlign = TextAlign.Center,
            )

            when {
                state.loading -> {
                    Spacer(Modifier.height(24.dp))
                    CircularProgressIndicator(color = palette.accent)
                    Spacer(Modifier.height(10.dp))
                    Text(strings.inviteLoading, fontSize = 13.sp, color = palette.mutedForeground)
                }

                preview == null -> {
                    Spacer(Modifier.height(14.dp))
                    Text(
                        inviteErrorText(state.error ?: InviteError.GENERIC, strings),
                        color = MaterialTheme.colorScheme.error,
                        fontSize = 13.sp,
                        textAlign = TextAlign.Center,
                    )
                    Spacer(Modifier.height(10.dp))
                    // A momentary failure (offline, server restart) must not
                    // force the person back to the email to open the link again.
                    Button(onClick = onRetry, shape = RoundedCornerShape(12.dp)) {
                        Text(strings.tryAgain)
                    }
                    TextButton(onClick = onCancel) { Text(strings.inviteClose) }
                }

                preview.state != "pending" -> {
                    Spacer(Modifier.height(14.dp))
                    Text(
                        if (preview.state == "used") strings.inviteUsed else strings.inviteExpired,
                        color = MaterialTheme.colorScheme.error,
                        fontSize = 13.sp,
                        textAlign = TextAlign.Center,
                    )
                    TextButton(onClick = onCancel) { Text(strings.inviteClose) }
                }

                else -> {
                    Spacer(Modifier.height(18.dp))
                    InvitationCard(preview, strings)
                    Spacer(Modifier.height(14.dp))

                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it },
                        label = {
                            Text(
                                if (existing) strings.inviteCurrentPassword else strings.password,
                            )
                        },
                        singleLine = true,
                        enabled = !state.pending,
                        visualTransformation = if (passwordVisible) {
                            VisualTransformation.None
                        } else {
                            PasswordVisualTransformation()
                        },
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Password,
                            imeAction = if (existing) ImeAction.Done else ImeAction.Next,
                        ),
                        trailingIcon = {
                            IconButton(
                                onClick = { passwordVisible = !passwordVisible },
                                modifier = Modifier.semantics {
                                    contentDescription =
                                        if (passwordVisible) strings.hidePassword else strings.showPassword
                                },
                            ) {
                                EyeIcon(
                                    visible = passwordVisible,
                                    tint = palette.mutedForeground,
                                    modifier = Modifier.size(22.dp),
                                )
                            }
                        },
                        supportingText = {
                            Text(
                                if (existing) strings.inviteCurrentPasswordHint else strings.invitePasswordHint,
                                fontSize = 11.sp,
                            )
                        },
                        modifier = Modifier.fillMaxWidth(),
                    )

                    if (existing) {
                        TextButton(
                            onClick = {
                                val url = link.instance.trimEnd('/') + "/forgot-password"
                                runCatching {
                                    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                                }
                            },
                            enabled = !state.pending,
                        ) {
                            Text(strings.inviteForgot)
                        }
                    } else {
                        Spacer(Modifier.height(8.dp))
                        OutlinedTextField(
                            value = confirmation,
                            onValueChange = { confirmation = it },
                            label = { Text(strings.inviteConfirmPassword) },
                            singleLine = true,
                            enabled = !state.pending,
                            visualTransformation = if (passwordVisible) {
                                VisualTransformation.None
                            } else {
                                PasswordVisualTransformation()
                            },
                            keyboardOptions = KeyboardOptions(
                                keyboardType = KeyboardType.Password,
                                imeAction = ImeAction.Done,
                            ),
                            isError = confirmation.isNotEmpty() && confirmation != password,
                            supportingText = {
                                if (confirmation.isNotEmpty() && confirmation != password) {
                                    Text(strings.invitePasswordMismatch, fontSize = 11.sp)
                                }
                            },
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }

                    state.error?.let { error ->
                        Spacer(Modifier.height(10.dp))
                        Text(
                            inviteErrorText(error, strings),
                            color = MaterialTheme.colorScheme.error,
                            fontSize = 13.sp,
                            textAlign = TextAlign.Center,
                        )
                    }

                    Spacer(Modifier.height(16.dp))
                    Button(
                        onClick = { onSubmit(password) },
                        enabled = !state.pending && valid,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(
                            when {
                                state.pending -> strings.joining
                                existing -> strings.inviteSignInAndAccept
                                else -> strings.inviteAccept
                            },
                        )
                    }
                    TextButton(onClick = onCancel, enabled = !state.pending) {
                        Text(strings.notNow)
                    }
                }
            }
        }
    }
}
