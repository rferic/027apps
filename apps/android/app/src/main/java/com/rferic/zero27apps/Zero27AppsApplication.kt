package com.rferic.zero27apps

import android.app.Application
import com.rferic.zero27apps.update.Updater

/**
 * Initializes Firebase from the persisted public config on every process start,
 * including the cold start FCM performs to deliver a data-only message.
 */
class Zero27AppsApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        FcmRegistrar.initializeFromStorage(this)
        // The APK downloaded by the last update is no longer needed: this process
        // started after the installer finished (or failed), so drop it now.
        Updater(this).cleanup()
    }
}
