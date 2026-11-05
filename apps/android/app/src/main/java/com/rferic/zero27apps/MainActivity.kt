package com.rferic.zero27apps

import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.core.app.ActivityCompat

/** Minimal FCM acceptance screen until the real auth/onboarding flow lands. */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= 33) {
            ActivityCompat.requestPermissions(this, arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 1)
        }
        val registrar = FcmRegistrar(this)

        setContent {
            MaterialTheme {
                var instanceUrl by remember { mutableStateOf(registrar.instanceUrl.orEmpty()) }
                var jwt by remember { mutableStateOf(registrar.sessionToken.orEmpty()) }
                var status by remember { mutableStateOf("Instance URL and session JWT are required.") }
                var busy by remember { mutableStateOf(false) }

                Column(
                    modifier = Modifier.fillMaxSize().padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text("027Apps FCM", style = MaterialTheme.typography.headlineSmall)
                    OutlinedTextField(
                        value = instanceUrl,
                        onValueChange = { instanceUrl = it },
                        label = { Text("Instance URL") },
                        modifier = Modifier.fillMaxWidth(),
                    )
                    OutlinedTextField(
                        value = jwt,
                        onValueChange = { jwt = it },
                        label = { Text("Session JWT") },
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Button(
                        enabled = !busy,
                        onClick = {
                            busy = true
                            status = "Configuring Firebase and registering the device..."
                            registrar.configure(instanceUrl, jwt) { result ->
                                busy = false
                                status = result.fold(
                                    onSuccess = { "Device registered. Token: ${it.take(20)}..." },
                                    onFailure = { "Error: ${it.message}" },
                                )
                            }
                        },
                    ) {
                        Text("Configure FCM and register")
                    }
                    Text(status)
                }
            }
        }
    }
}
