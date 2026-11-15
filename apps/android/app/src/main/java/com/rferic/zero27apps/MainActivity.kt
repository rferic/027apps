package com.rferic.zero27apps

import android.Manifest
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.mutableStateOf
import androidx.core.app.ActivityCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.rferic.zero27apps.ui.AppRoot

/** One activity, Compose only; the shell owns the session and the push registration. */
class MainActivity : ComponentActivity() {
    /** The invitation link that opened (or re-opened) the activity. */
    private val deepLink = mutableStateOf<String?>(null)
    /** A quick action, e.g. the widget's "+" (`owe_expense`). */
    private val startAction = mutableStateOf<String?>(null)
    /** The group a notification points at, when it does. */
    private val startGroup = mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        consumeIntent(intent)
        if (Build.VERSION.SDK_INT >= 33) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                1,
            )
        }
        setContent {
            AppRoot(
                deepLink = deepLink.value,
                startAction = startAction.value,
                startGroup = startGroup.value,
            )
        }
    }

    /**
     * Reads the launch extras and clears them: a rotation or a re-creation used
     * to replay the same "open this group / start an expense" request, and an
     * external app could aim the same extras at us again.
     */
    private fun consumeIntent(intent: Intent?) {
        val group = intent?.getStringExtra(EXTRA_GROUP)?.takeIf(::isUuid)
        deepLink.value = intent?.dataString
        startAction.value = intent?.getStringExtra(EXTRA_START)?.takeIf { it in START_ACTIONS }
        startGroup.value = group
        intent?.removeExtra(EXTRA_START)
        intent?.removeExtra(EXTRA_GROUP)
        intent?.data = null
    }

    private fun isUuid(value: String): Boolean = UUID_PATTERN.matches(value)

    private companion object {
        const val EXTRA_START = "start"
        const val EXTRA_GROUP = "group"
        val START_ACTIONS = setOf("owe_group", "owe_expense", "modules", "settings")
        val UUID_PATTERN =
            Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        consumeIntent(intent)
    }
}
