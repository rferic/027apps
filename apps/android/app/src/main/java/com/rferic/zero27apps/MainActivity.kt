package com.rferic.zero27apps

import android.Manifest
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.mutableStateOf
import androidx.core.app.ActivityCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.rferic.zero27apps.ui.AppRoot

/**
 * One activity, Compose only. The shell owns the session; the FCM registration
 * screen is gone (notifications are wired to the real session in a later task).
 */
class MainActivity : ComponentActivity() {
    /** The invitation link that opened (or re-opened) the activity. */
    private val deepLink = mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        deepLink.value = intent?.dataString
        if (Build.VERSION.SDK_INT >= 33) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                1,
            )
        }
        setContent { AppRoot(deepLink = deepLink.value) }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        deepLink.value = intent.dataString
    }
}
