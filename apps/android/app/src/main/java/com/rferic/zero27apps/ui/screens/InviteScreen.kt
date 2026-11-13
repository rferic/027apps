package com.rferic.zero27apps.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rferic.zero27apps.auth.InvitationLink
import com.rferic.zero27apps.ui.InviteError
import com.rferic.zero27apps.ui.InviteState
import com.rferic.zero27apps.ui.components.EyeIcon
import com.rferic.zero27apps.ui.i18n.LocalStrings
import com.rferic.zero27apps.ui.theme.LocalPalette

@Composable
private fun inviteErrorText(error: InviteError): String {
    val strings = LocalStrings.current
    return when (error) {
        InviteError.EXPIRED -> strings.inviteExpired
        InviteError.USED -> strings.inviteUsed
        InviteError.NOT_FOUND -> strings.inviteNotFound
        InviteError.EMAIL_MISMATCH -> strings.inviteEmailMismatch
        InviteError.NETWORK -> strings.failureNetwork
        InviteError.GENERIC -> strings.inviteFailed
    }
}

/**
 * Invitation redemption: the invitee picks email, name and password here, the
 * app redeems on the link's instance and signs in. The token stays in the deep
 * link, never in the UI copy.
 */
@Composable
fun InviteScreen(
    link: InvitationLink,
    state: InviteState,
    onSubmit: (email: String, password: String, displayName: String?) -> Unit,
    onCancel: () -> Unit,
) {
    var email by rememberSaveable { mutableStateOf("") }
    var displayName by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var passwordVisible by rememberSaveable { mutableStateOf(false) }
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    val valid = email.isNotBlank() && password.length >= 12

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(strings.inviteTitle, style = MaterialTheme.typography.headlineSmall)
        Spacer(Modifier.height(4.dp))
        Text(link.instance, style = MaterialTheme.typography.bodySmall, color = palette.mutedForeground)
        Spacer(Modifier.height(20.dp))

        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text(strings.email) },
            singleLine = true,
            enabled = !state.pending,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(
            value = displayName,
            onValueChange = { displayName = it },
            label = { Text(strings.inviteName) },
            singleLine = true,
            enabled = !state.pending,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text(strings.password) },
            singleLine = true,
            enabled = !state.pending,
            visualTransformation = if (passwordVisible) {
                androidx.compose.ui.text.input.VisualTransformation.None
            } else {
                PasswordVisualTransformation()
            },
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Password,
                imeAction = ImeAction.Done,
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
            supportingText = { Text(strings.invitePasswordHint, fontSize = 11.sp) },
            modifier = Modifier.fillMaxWidth(),
        )

        state.error?.let { error ->
            Spacer(Modifier.height(10.dp))
            Text(inviteErrorText(error), color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
        }

        Spacer(Modifier.height(18.dp))
        Button(
            onClick = { onSubmit(email, password, displayName) },
            enabled = !state.pending && valid,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(if (state.pending) strings.joining else strings.join)
        }
        TextButton(onClick = onCancel) { Text(strings.notNow) }
    }
}
