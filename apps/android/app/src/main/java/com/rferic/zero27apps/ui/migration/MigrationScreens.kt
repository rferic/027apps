package com.rferic.zero27apps.ui.migration

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.view.WindowManager
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.google.zxing.BarcodeFormat
import com.google.zxing.BinaryBitmap
import com.google.zxing.DecodeHintType
import com.google.zxing.MultiFormatReader
import com.google.zxing.PlanarYUVLuminanceSource
import com.google.zxing.common.HybridBinarizer
import com.rferic.zero27apps.auth.MigrationLink
import com.rferic.zero27apps.ui.MigrationError
import com.rferic.zero27apps.ui.MigrationState
import com.rferic.zero27apps.ui.components.BrandTile
import com.rferic.zero27apps.ui.components.BrandWordmark
import com.rferic.zero27apps.ui.i18n.LocalStrings
import com.rferic.zero27apps.ui.i18n.Strings
import com.rferic.zero27apps.ui.theme.LocalPalette
import com.rferic.zero27apps.ui.theme.appGradient
import java.time.Instant
import java.util.concurrent.Executors
import kotlinx.coroutines.delay
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

private tailrec fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}

private fun migrationErrorText(
    error: MigrationError,
    strings: Strings,
    fallback: String,
): String = when (error) {
    MigrationError.NETWORK -> strings.failureNetwork
    MigrationError.AUTH -> strings.migrationInvalid
    MigrationError.SIGNED_IN -> strings.migrationSignedIn
    MigrationError.GENERIC -> fallback
}

/**
 * Old phone: shows the 60-second QR in a white card, keeps the window out of
 * screenshots (`FLAG_SECURE`) and renews it near expiry while the previous code
 * remains valid until its own TTL.
 */
@Composable
fun MigrationQrScreen(
    instance: String,
    email: String,
    state: MigrationState,
    onStart: () -> Unit,
    onStop: () -> Unit,
    onClose: () -> Unit,
) {
    val strings = LocalStrings.current
    val palette = LocalPalette.current
    val context = LocalContext.current
    val activity = remember(context) { context.findActivity() }

    DisposableEffect(Unit) {
        activity?.window?.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        onStart()
        onDispose {
            activity?.window?.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
            onStop()
        }
    }

    var remaining by remember { mutableStateOf(0L) }
    LaunchedEffect(state.expiresAt) {
        val end = runCatching { Instant.parse(state.expiresAt.orEmpty()) }.getOrNull()
        while (end != null) {
            remaining = ((end.toEpochMilli() - System.currentTimeMillis()) / 1000).coerceAtLeast(0)
            if (remaining <= 0) break
            delay(1_000)
        }
    }

    // Renew once when the code is about to expire; the old one stays valid until
    // its own TTL, so a slow scan never gets a dead code mid-flow.
    var renewedFor by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(state.token, remaining) {
        val token = state.token
        if (token != null && remaining in 1..15 && renewedFor != token) {
            renewedFor = token
            onStart()
        }
    }

    val bitmap = remember(state.token) {
        state.token?.let { token ->
            runCatching { qrBitmap(migrationQrContent(instance, token)) }.getOrNull()
        }
    }

    Box(
        modifier = Modifier.fillMaxSize().background(appGradient(palette)),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            BrandTile(size = 56.dp)
            Spacer(Modifier.height(12.dp))
            BrandWordmark(height = 26.dp)
            Spacer(Modifier.height(16.dp))
            Text(strings.migrationTitle, style = MaterialTheme.typography.headlineSmall)
            Spacer(Modifier.height(6.dp))
            Text(
                strings.migrationQrCaption,
                fontSize = 13.sp,
                color = palette.mutedForeground,
                textAlign = TextAlign.Center,
            )

            when {
                // Renewing with a code still on screen: keep it and show a
                // quiet progress line, so nobody loses the code mid-scan.
                state.loading && bitmap != null -> {
                    Spacer(Modifier.height(12.dp))
                    CircularProgressIndicator(color = palette.accent, modifier = Modifier.size(20.dp))
                }

                state.loading -> {
                    Spacer(Modifier.height(24.dp))
                    CircularProgressIndicator(color = palette.accent)
                    Spacer(Modifier.height(8.dp))
                    Text(strings.migrationGenerating, fontSize = 12.sp, color = palette.mutedForeground)
                }

                state.state == "used" -> {
                    Spacer(Modifier.height(24.dp))
                    Text(
                        strings.migrationUsed,
                        color = palette.accent,
                        textAlign = TextAlign.Center,
                        fontSize = 14.sp,
                    )
                }

                // A dead code must not look scannable: the server already says
                // `expired`, so the screen hides it and offers a new one.
                state.state == "expired" -> {
                    Spacer(Modifier.height(24.dp))
                    Text(
                        strings.migrationExpired,
                        color = MaterialTheme.colorScheme.error,
                        textAlign = TextAlign.Center,
                        fontSize = 13.sp,
                    )
                    Spacer(Modifier.height(8.dp))
                    Button(onClick = onStart) { Text(strings.migrationGenerate) }
                }

                state.error != null -> {
                    Spacer(Modifier.height(24.dp))
                    Text(
                        migrationErrorText(state.error, strings, strings.migrationCreateFailed),
                        color = MaterialTheme.colorScheme.error,
                        textAlign = TextAlign.Center,
                        fontSize = 13.sp,
                    )
                    Spacer(Modifier.height(8.dp))
                    Button(onClick = onStart) { Text(strings.migrationGenerate) }
                }

                bitmap != null -> {
                    Spacer(Modifier.height(20.dp))
                    Box(
                        modifier = Modifier
                            .background(androidx.compose.ui.graphics.Color.White, RoundedCornerShape(12.dp))
                            .border(1.dp, palette.border, RoundedCornerShape(12.dp))
                            .padding(10.dp),
                    ) {
                        Image(
                            bitmap = bitmap.asImageBitmap(),
                            contentDescription = strings.migrationTitle,
                            modifier = Modifier.size(260.dp),
                        )
                    }
                    Spacer(Modifier.height(12.dp))
                    Text(
                        "${strings.migrationExpiresIn} $remaining s",
                        fontSize = 13.sp,
                        color = if (remaining <= 15) MaterialTheme.colorScheme.error else palette.mutedForeground,
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(email, fontSize = 12.sp, color = palette.mutedForeground)
                    Text(
                        instance.removePrefix("https://").removePrefix("http://"),
                        fontSize = 11.sp,
                        color = palette.mutedForeground,
                    )
                    Spacer(Modifier.height(6.dp))
                    Text(
                        strings.migrationScreenSecure,
                        fontSize = 11.sp,
                        color = palette.mutedForeground,
                        textAlign = TextAlign.Center,
                    )
                    Spacer(Modifier.height(10.dp))
                    Button(onClick = onStart) { Text(strings.migrationGenerate) }
                }
            }

            TextButton(onClick = onClose) { Text(strings.migrationClose) }
        }
    }
}

/**
 * New phone: scans the old phone's QR with CameraX + ZXing (no Play Services).
 * The link's instance is taken from the QR, never from the current app.
 */
@Composable
fun MigrationScanScreen(
    state: MigrationState,
    onScanned: (MigrationLink) -> Unit,
    onCancel: () -> Unit,
) {
    val strings = LocalStrings.current
    val palette = LocalPalette.current
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    var granted by remember { mutableStateOf(false) }
    var previewView by remember { mutableStateOf<PreviewView?>(null) }
    var handled by remember { mutableStateOf(false) }
    val executor = remember { Executors.newSingleThreadExecutor() }
    val analyzer = remember {
        QrAnalyzer { text ->
            if (!handled) {
                MigrationLink.parse(text)?.let { link ->
                    handled = true
                    onScanned(link)
                }
            }
        }
    }

    val permissionLauncher = androidx.activity.compose.rememberLauncherForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.RequestPermission(),
    ) { granted = it }
    LaunchedEffect(Unit) {
        granted = ContextCompat.checkSelfPermission(
            context,
            android.Manifest.permission.CAMERA,
        ) == android.content.pm.PackageManager.PERMISSION_GRANTED
        if (!granted) permissionLauncher.launch(android.Manifest.permission.CAMERA)
    }

    DisposableEffect(Unit) {
        onDispose {
            runCatching { ProcessCameraProvider.getInstance(context).get().unbindAll() }
            executor.shutdown()
        }
    }

    LaunchedEffect(granted, previewView) {
        val view = previewView
        if (!granted || view == null) return@LaunchedEffect
        val provider = context.cameraProvider()
        val preview = Preview.Builder().build().also { it.surfaceProvider = view.surfaceProvider }
        val analysis = ImageAnalysis.Builder()
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .build()
        analysis.setAnalyzer(executor, analyzer)
        runCatching {
            provider.unbindAll()
            provider.bindToLifecycle(
                lifecycleOwner,
                CameraSelector.DEFAULT_BACK_CAMERA,
                preview,
                analysis,
            )
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(palette.background)) {
        AndroidView(
            factory = { ctx ->
                PreviewView(ctx).also {
                    it.scaleType = PreviewView.ScaleType.FILL_CENTER
                    previewView = it
                }
            },
            modifier = Modifier.fillMaxSize(),
        )

        Column(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .background(palette.surface.copy(alpha = 0.94f))
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(strings.migrationScanTitle, style = MaterialTheme.typography.titleMedium)
            Text(
                when (state.error) {
                    null -> if (granted) strings.migrationScanLead else strings.migrationCameraDenied
                    else -> migrationErrorText(state.error, strings, strings.migrationMoveFailed)
                },
                fontSize = 13.sp,
                color = if (state.error == null) palette.mutedForeground else MaterialTheme.colorScheme.error,
                textAlign = TextAlign.Center,
            )
            if (state.loading) CircularProgressIndicator(color = palette.accent)
            // A denied permission is not a dead end: Android stops showing the
            // dialog after "don't ask again", so offer the app's settings too.
            if (!granted && state.error == null) {
                Button(onClick = {
                    permissionLauncher.launch(android.Manifest.permission.CAMERA)
                }, shape = RoundedCornerShape(12.dp)) {
                    Text(strings.tryAgain)
                }
                TextButton(onClick = { context.openAppSettings() }) {
                    Text(strings.migrationOpenSettings)
                }
            }
            TextButton(onClick = onCancel) { Text(strings.migrationClose) }
        }
    }
}

/** Opens this app's system settings page, where a blocked permission is undone. */
private fun Context.openAppSettings() {
    val intent = android.content.Intent(
        android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
        android.net.Uri.fromParts("package", packageName, null),
    ).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
    runCatching { startActivity(intent) }
}

/** CameraX provider as a suspend value (the future only completes on the main thread). */
private suspend fun Context.cameraProvider(): ProcessCameraProvider =
    suspendCancellableCoroutine { continuation ->
        val future = ProcessCameraProvider.getInstance(this)
        future.addListener(
            {
                try {
                    continuation.resume(future.get())
                } catch (error: Exception) {
                    continuation.resumeWithException(error)
                }
            },
            ContextCompat.getMainExecutor(this),
        )
    }

/** ZXing decoder for the Y plane of a CameraX frame. */
private class QrAnalyzer(private val onText: (String) -> Unit) : ImageAnalysis.Analyzer {
    override fun analyze(image: ImageProxy) {
        try {
            val plane = image.planes[0]
            val buffer = plane.buffer
            val bytes = ByteArray(buffer.remaining())
            buffer.get(bytes)
            decodeQrFromLuminance(
                frame = bytes,
                width = image.width,
                height = image.height,
                rowStride = plane.rowStride,
            )?.let(onText)
        } finally {
            image.close()
        }
    }
}
