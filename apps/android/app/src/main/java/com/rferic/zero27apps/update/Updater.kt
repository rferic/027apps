package com.rferic.zero27apps.update

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

/**
 * Self-update for a sideloaded app: download the new APK from the instance and
 * hand it to the package installer. Android still asks the user to allow
 * installs from this app the first time, which is the system's own consent and
 * cannot be skipped.
 */
class Updater(private val context: Context) {
    /**
     * The APK only has to exist while the system installer reads it. The process
     * is restarted by the install, so the next launch is the safe moment to drop
     * it: no leftover builds piling up in the cache.
     */
    fun cleanup() {
        val dir = File(context.cacheDir, DIRECTORY)
        if (!dir.exists()) return
        dir.listFiles()?.forEach { file -> runCatching { file.delete() } }
    }

    fun downloadAndInstall(
        apkUrl: String,
        baseUrl: String,
        onResult: (Result<Unit>) -> Unit,
    ) {
        val absolute = if (apkUrl.startsWith("http")) apkUrl else baseUrl.trimEnd('/') + apkUrl
        thread(name = "027apps-update") {
            val result = runCatching {
                val dir = File(context.cacheDir, DIRECTORY).apply { mkdirs() }
                // A fixed name means an old, half-downloaded file is replaced
                // instead of adding another one.
                val target = File(dir, FILE_NAME)
                download(absolute, target)
                install(target)
            }
            onResult(result)
        }
    }

    private fun download(url: String, target: File) {
        val connection = (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 15_000
            readTimeout = 60_000
            instanceFollowRedirects = true
            requestMethod = "GET"
        }
        try {
            if (connection.responseCode !in 200..299) {
                error("download answered ${connection.responseCode}")
            }
            connection.inputStream.use { input ->
                target.outputStream().use { output -> input.copyTo(output) }
            }
        } finally {
            connection.disconnect()
        }
    }

    private fun install(apk: File) {
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.updates", apk)
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }

    private companion object {
        const val DIRECTORY = "updates"
        const val FILE_NAME = "update.apk"
    }
}
