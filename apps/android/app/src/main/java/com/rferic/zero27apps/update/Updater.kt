package com.rferic.zero27apps.update

import com.rferic.zero27apps.BuildConfig

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
        expectedSha256: String? = null,
        onResult: (Result<Unit>) -> Unit,
    ) {
        val absolute = if (apkUrl.startsWith("http")) apkUrl else baseUrl.trimEnd('/') + apkUrl
        // Exact origin, not a string prefix: `https://example.com.evil.tld` used to
        // pass for `https://example.com`.
        if (!UpdatePolicy.trustedUrl(absolute, baseUrl, BuildConfig.DEBUG)) {
            onResult(Result.failure(IllegalArgumentException("update source is not trusted")))
            return
        }
        if (UpdatePolicy.digestRequired(BuildConfig.DEBUG) && !UpdatePolicy.validDigest(expectedSha256)) {
            // A release without a published digest cannot be verified, so it is refused.
            onResult(Result.failure(IllegalArgumentException("update has no published digest")))
            return
        }
        thread(name = "027apps-update") {
            val result = runCatching {
                val dir = File(context.cacheDir, DIRECTORY).apply { mkdirs() }
                // A fixed name means an old, half-downloaded file is replaced
                // instead of adding another one.
                val target = File(dir, FILE_NAME)
                target.delete()
                download(absolute, baseUrl)
                if (!expectedSha256.isNullOrBlank()) {
                    val actual = sha256(target)
                    if (!actual.equals(expectedSha256, ignoreCase = true)) {
                        target.delete()
                        error("downloaded APK does not match the published digest")
                    }
                }
                install(target)
            }
            onResult(result)
        }
    }

    /** SHA-256 of a file, lowercase hex; used only when the release publishes it. */
    private fun sha256(file: File): String {
        val digest = java.security.MessageDigest.getInstance("SHA-256")
        file.inputStream().use { stream ->
            val buffer = ByteArray(64 * 1024)
            while (true) {
                val read = stream.read(buffer)
                if (read <= 0) break
                digest.update(buffer, 0, read)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    /**
     * Downloads following at most three redirects, and only to a location the
     * same policy trusts: a redirect cannot move the download to another host.
     */
    private fun download(url: String, baseUrl: String) {
        var current = url
        repeat(MAX_REDIRECTS + 1) { attempt ->
            val connection = (URL(current).openConnection() as HttpURLConnection).apply {
                connectTimeout = 15_000
                readTimeout = 60_000
                instanceFollowRedirects = false
                requestMethod = "GET"
            }
            try {
                when (connection.responseCode) {
                    in 200..299 -> {
                        connection.inputStream.use { input ->
                            val dir = File(context.cacheDir, DIRECTORY).apply { mkdirs() }
                            File(dir, FILE_NAME).outputStream().use { output -> input.copyTo(output) }
                        }
                        return
                    }
                    in 300..399 -> {
                        val location = connection.getHeaderField("Location") ?: error("redirect without a location")
                        val next = if (location.startsWith("http")) location else URL(URL(current), location).toString()
                        if (attempt == MAX_REDIRECTS || !UpdatePolicy.trustedUrl(next, baseUrl, BuildConfig.DEBUG)) {
                            error("redirect to an untrusted location")
                        }
                        current = next
                    }
                    else -> error("download answered ${connection.responseCode}")
                }
            } finally {
                connection.disconnect()
            }
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
        const val MAX_REDIRECTS = 3
    }
}
