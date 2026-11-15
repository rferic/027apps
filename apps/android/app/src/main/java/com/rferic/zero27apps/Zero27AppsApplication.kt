package com.rferic.zero27apps

import android.app.Application
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.decode.SvgDecoder
import com.rferic.zero27apps.update.Updater
import com.rferic.zero27apps.widget.OweWidgetWorker

/**
 * Initializes Firebase from the persisted public config on every process start,
 * including the cold start FCM performs to deliver a data-only message.
 */
class Zero27AppsApplication : Application(), ImageLoaderFactory {

    override fun newImageLoader(): ImageLoader =
        ImageLoader.Builder(this)
            .components { add(SvgDecoder.Factory()) }
            .build()

    override fun onCreate() {
        super.onCreate()
        FcmRegistrar.initializeFromStorage(this)
        // The APK downloaded by the last update is no longer needed: this process
        // started after the installer finished (or failed), so drop it now.
        Updater(this).cleanup()
        // The home widget refreshes on its own schedule; the app only keeps it scheduled.
        OweWidgetWorker.schedule(this)
    }
}
