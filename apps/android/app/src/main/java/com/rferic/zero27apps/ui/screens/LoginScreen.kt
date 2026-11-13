package com.rferic.zero27apps.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rferic.zero27apps.BuildConfig
import com.rferic.zero27apps.ui.InstancePickerDialog
import com.rferic.zero27apps.ui.components.BrandTile
import com.rferic.zero27apps.ui.LoginError
import com.rferic.zero27apps.ui.LoginState
import com.rferic.zero27apps.ui.UpdateState
import com.rferic.zero27apps.ui.i18n.LocalStrings
import com.rferic.zero27apps.ui.theme.LocalPalette

/** A newer build is available: same notice as Home, before signing in. */
@Composable
private fun UpdateNotice(update: UpdateState, onInstall: () -> Unit) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    when (update) {
        is UpdateState.Available -> Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(palette.successSubtle, RoundedCornerShape(12.dp))
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                "${strings.updateAvailable} · v${update.version}",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.weight(1f),
            )
            Button(onClick = onInstall) { Text(strings.updateInstall, fontSize = 12.sp) }
        }
        UpdateState.Downloading -> Text(strings.updateDownloading, fontSize = 12.sp, color = palette.mutedForeground)
        UpdateState.Installing -> Text(strings.updateInstalling, fontSize = 12.sp, color = palette.mutedForeground)
        UpdateState.Failed -> Text(strings.updateFailed, fontSize = 12.sp, color = palette.destructive)
        UpdateState.None -> Unit
    }
}

@Composable
private fun loginErrorText(error: LoginError): String {
    val strings = LocalStrings.current
    return when (error) {
        LoginError.WRONG_CREDENTIALS -> strings.loginWrong
        LoginError.EMAIL_UNCONFIRMED -> strings.loginUnconfirmed
        LoginError.GENERIC -> strings.loginFailed
    }
}

/**
 * Email and password against the instance's Supabase. There is no URL field:
 * the instance is the one the app targets (or the one chosen in the picker).
 */
@Composable
fun LoginScreen(
    instance: String,
    knownInstances: List<String>,
    state: LoginState,
    update: UpdateState,
    onLogin: (email: String, password: String) -> Unit,
    onRememberInstance: (String) -> String?,
    onChangeInstance: (String) -> Boolean,
    onInstallUpdate: () -> Unit,
) {
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var showPicker by rememberSaveable { mutableStateOf(false) }
    val palette = LocalPalette.current
    val strings = LocalStrings.current

    if (showPicker) {
        InstancePickerDialog(
            known = knownInstances,
            current = instance,
            onAdd = onRememberInstance,
            onPick = { url ->
                showPicker = false
                onChangeInstance(url)
            },
            onDismiss = { showPicker = false },
        )
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        BrandTile(size = 64.dp)
        Spacer(Modifier.height(16.dp))
        Text("027Apps", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = palette.foreground)
        Spacer(Modifier.height(4.dp))
        Text(instance, style = MaterialTheme.typography.bodySmall, color = palette.mutedForeground)
        if (BuildConfig.DEBUG) {
            Text(strings.debugBuild, style = MaterialTheme.typography.labelSmall, color = palette.accent)
        }
        Spacer(Modifier.height(12.dp))

        TextButton(onClick = { showPicker = true }) { Text(strings.changeInstance) }
        Spacer(Modifier.height(16.dp))

        UpdateNotice(update, onInstallUpdate)

        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text(strings.email) },
            singleLine = true,
            enabled = !state.pending,
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Email,
                imeAction = ImeAction.Next,
            ),
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text(strings.password) },
            singleLine = true,
            enabled = !state.pending,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Password,
                imeAction = ImeAction.Done,
            ),
            modifier = Modifier.fillMaxWidth(),
        )

        state.error?.let { error ->
            Spacer(Modifier.height(12.dp))
            Text(loginErrorText(error), color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
        }

        Spacer(Modifier.height(20.dp))
        Button(
            onClick = { onLogin(email, password) },
            enabled = !state.pending && email.isNotBlank() && password.isNotEmpty(),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(if (state.pending) strings.signingIn else strings.signIn)
        }
    }
}
