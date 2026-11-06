package com.rferic.zero27apps

import android.app.Application

/**
 * Initializes Firebase from the persisted public config on every process start,
 * including the cold start FCM performs to deliver a data-only message.
 */
class Zero27AppsApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        FcmRegistrar.initializeFromStorage(this)
    }
}
