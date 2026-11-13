package com.rferic.zero27apps.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
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
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rferic.zero27apps.BuildConfig
import com.rferic.zero27apps.ui.LoginState
import com.rferic.zero27apps.ui.theme.LocalPalette

/**
 * Email and password against the instance's Supabase. There is no URL field:
 * the instance is the one the app targets (or the one chosen in Settings).
 */
@Composable
fun LoginScreen(
    instance: String,
    state: LoginState,
    onLogin: (email: String, password: String) -> Unit,
    onChangeInstance: (String) -> Boolean,
) {
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var editingInstance by rememberSaveable { mutableStateOf(false) }
    var url by rememberSaveable { mutableStateOf(instance) }
    var invalidInstance by rememberSaveable { mutableStateOf(false) }
    val palette = LocalPalette.current

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("027Apps", style = MaterialTheme.typography.headlineMedium, color = palette.accent)
        Spacer(Modifier.height(4.dp))
        Text(instance, style = MaterialTheme.typography.bodySmall, color = palette.mutedForeground)
        if (BuildConfig.DEBUG) {
            Text("debug build", style = MaterialTheme.typography.labelSmall, color = palette.accent)
        }
        Spacer(Modifier.height(12.dp))

        if (editingInstance) {
            OutlinedTextField(
                value = url,
                onValueChange = {
                    url = it
                    invalidInstance = false
                },
                label = { Text("Instance URL") },
                singleLine = true,
                isError = invalidInstance,
                modifier = Modifier.fillMaxWidth(),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { invalidInstance = !onChangeInstance(url) }) { Text("Use") }
                TextButton(onClick = { editingInstance = false }) { Text("Cancel") }
            }
            if (invalidInstance) {
                Text(
                    "That URL is not valid for this build.",
                    color = MaterialTheme.colorScheme.error,
                    fontSize = 12.sp,
                )
            }
            Spacer(Modifier.height(16.dp))
        } else {
            TextButton(onClick = { editingInstance = true }) { Text("Change instance") }
            Spacer(Modifier.height(16.dp))
        }

        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Email") },
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
            label = { Text("Password") },
            singleLine = true,
            enabled = !state.pending,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Password,
                imeAction = ImeAction.Done,
            ),
            modifier = Modifier.fillMaxWidth(),
        )

        if (state.error != null) {
            Spacer(Modifier.height(12.dp))
            Text(
                state.error,
                color = MaterialTheme.colorScheme.error,
                fontSize = 13.sp,
            )
        }

        Spacer(Modifier.height(20.dp))
        Button(
            onClick = { onLogin(email, password) },
            enabled = !state.pending && email.isNotBlank() && password.isNotEmpty(),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(if (state.pending) "Signing in…" else "Sign in")
        }
    }
}
