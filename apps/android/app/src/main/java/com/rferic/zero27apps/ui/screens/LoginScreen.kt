package com.rferic.zero27apps.ui.screens

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
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rferic.zero27apps.BuildConfig
import com.rferic.zero27apps.ui.InstancePickerDialog
import com.rferic.zero27apps.ui.LoginError
import com.rferic.zero27apps.ui.LoginState
import com.rferic.zero27apps.ui.UpdateState
import com.rferic.zero27apps.ui.components.BrandTile
import com.rferic.zero27apps.ui.components.BrandWordmark
import com.rferic.zero27apps.ui.components.EyeIcon
import com.rferic.zero27apps.ui.i18n.LocalStrings
import com.rferic.zero27apps.ui.theme.LocalPalette

@Composable
private fun loginErrorText(error: LoginError): String {
    val strings = LocalStrings.current
    return when (error) {
        LoginError.WRONG_CREDENTIALS -> strings.loginWrong
        LoginError.EMAIL_UNCONFIRMED -> strings.loginUnconfirmed
        LoginError.GENERIC -> strings.loginFailed
    }
}

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
        UpdateState.Checking -> Text(strings.checking, fontSize = 12.sp, color = palette.mutedForeground)
        UpdateState.UpToDate -> Text(strings.upToDate, fontSize = 12.sp, color = palette.mutedForeground)
        UpdateState.Downloading -> Text(strings.updateDownloading, fontSize = 12.sp, color = palette.mutedForeground)
        UpdateState.Installing -> Text(strings.updateInstalling, fontSize = 12.sp, color = palette.mutedForeground)
        UpdateState.Failed -> Text(strings.updateFailed, fontSize = 12.sp, color = palette.destructive)
        UpdateState.None -> Unit
    }
}

/**
 * Login: the brand on a soft glow, one card with the two fields and the action,
 * and the quiet ways out (change instance, update). No URL field: the instance
 * is the one the app targets.
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
    var passwordVisible by rememberSaveable { mutableStateOf(false) }
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    val valid = email.isNotBlank() && password.isNotEmpty()

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

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    0f to palette.accent.copy(alpha = 0.16f),
                    0.30f to palette.background,
                    1f to palette.background,
                ),
            ),
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
            BrandTile(size = 68.dp)
            Spacer(Modifier.height(20.dp))
            BrandWordmark(height = 30.dp)
            Spacer(Modifier.height(10.dp))
            Text(
                "${strings.version} ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})" +
                    if (BuildConfig.DEBUG) " · ${strings.debugBuild}" else "",
                fontSize = 11.sp,
                color = palette.mutedForeground,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                instance.removePrefix("https://").removePrefix("http://"),
                fontSize = 12.sp,
                color = palette.mutedForeground,
                modifier = Modifier
                    .background(palette.muted, RoundedCornerShape(999.dp))
                    .padding(horizontal = 12.dp, vertical = 5.dp),
            )

            Spacer(Modifier.height(28.dp))

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(palette.surface, RoundedCornerShape(20.dp))
                    .border(1.dp, palette.border, RoundedCornerShape(20.dp))
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(
                    strings.welcome,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = palette.foreground,
                )
                field(
                    value = email,
                    onValueChange = { email = it },
                    label = strings.email,
                    enabled = !state.pending,
                    keyboard = KeyboardOptions(
                        keyboardType = KeyboardType.Email,
                        imeAction = ImeAction.Next,
                    ),
                )
                field(
                    value = password,
                    onValueChange = { password = it },
                    label = strings.password,
                    enabled = !state.pending,
                    secret = !passwordVisible,
                    keyboard = KeyboardOptions(
                        keyboardType = KeyboardType.Password,
                        imeAction = ImeAction.Done,
                    ),
                    actions = KeyboardActions(
                        onDone = { if (valid && !state.pending) onLogin(email, password) },
                    ),
                    trailing = {
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
                )

                state.error?.let { error ->
                    Text(loginErrorText(error), color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
                }

                Button(
                    onClick = { onLogin(email, password) },
                    enabled = !state.pending && valid,
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth().height(50.dp),
                ) {
                    Text(if (state.pending) strings.signingIn else strings.signIn)
                }
            }

            Spacer(Modifier.height(14.dp))
            UpdateNotice(update, onInstallUpdate)
            TextButton(onClick = { showPicker = true }) { Text(strings.changeInstance) }

        }
    }
}

@Composable
private fun field(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    enabled: Boolean,
    secret: Boolean = false,
    keyboard: KeyboardOptions,
    actions: KeyboardActions = KeyboardActions.Default,
    trailing: (@Composable () -> Unit)? = null,
) {
    val palette = LocalPalette.current
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label, fontSize = 13.sp) },
        singleLine = true,
        enabled = enabled,
        visualTransformation = if (secret) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
        keyboardOptions = keyboard,
        keyboardActions = actions,
        shape = RoundedCornerShape(14.dp),
        trailingIcon = trailing,
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = palette.accent,
            unfocusedBorderColor = palette.border,
            focusedLabelColor = palette.accent,
            cursorColor = palette.accent,
            focusedContainerColor = palette.background,
            unfocusedContainerColor = palette.background,
        ),
        modifier = Modifier.fillMaxWidth(),
    )
}
