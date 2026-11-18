package com.rferic.zero27apps.ui.migration

import android.graphics.Bitmap
import android.graphics.Color
import com.google.zxing.BarcodeFormat
import com.google.zxing.BinaryBitmap
import com.google.zxing.DecodeHintType
import com.google.zxing.MultiFormatReader
import com.google.zxing.PlanarYUVLuminanceSource
import com.google.zxing.common.HybridBinarizer
import com.google.zxing.qrcode.QRCodeWriter

/**
 * Pure bitmap and luminance work for the new phone's scanner; no network and no
 * state. `decodeQrFromLuminance` takes the Y plane of a CameraX frame exactly as
 * it arrives (with its row padding), so it is the same code the analyzer runs.
 */
fun qrBitmap(content: String, size: Int = 720): Bitmap {
    val matrix = QRCodeWriter().encode(content, BarcodeFormat.QR_CODE, size, size)
    val pixels = IntArray(size * size)
    for (y in 0 until size) {
        val row = y * size
        for (x in 0 until size) {
            pixels[row + x] = if (matrix[x, y]) Color.BLACK else Color.WHITE
        }
    }
    return Bitmap.createBitmap(pixels, size, size, Bitmap.Config.ARGB_8888)
}

/**
 * What the QR encodes: the https App Link when the instance is https (the
 * system camera can open it), and the debug-only scheme for a local http
 * instance (no App Link can verify there).
 */
fun migrationQrContent(instance: String, token: String): String {
    val base = instance.trimEnd('/')
    return if (base.startsWith("https://")) {
        "$base/migrate/$token"
    } else {
        "zero27apps-dev://migrate/$token?instance=${java.net.URLEncoder.encode(base, "UTF-8")}"
    }
}

/**
 * Reads a QR from the luma plane of a frame. `rowStride` is usually larger than
 * `width` (the camera pads each row), hence the copy row by row.
 */
fun decodeQrFromLuminance(
    frame: ByteArray,
    width: Int,
    height: Int,
    rowStride: Int,
): String? {
    if (width <= 0 || height <= 0 || rowStride < width) return null
    val luminance = ByteArray(width * height)
    for (row in 0 until height) {
        val offset = row * rowStride
        if (offset + width > frame.size) return null
        frame.copyInto(luminance, row * width, offset, offset + width)
    }
    val source = PlanarYUVLuminanceSource(luminance, width, height, 0, 0, width, height, false)
    val reader = MultiFormatReader().apply {
        setHints(mapOf(DecodeHintType.POSSIBLE_FORMATS to listOf(BarcodeFormat.QR_CODE)))
    }
    return runCatching {
        reader.decodeWithState(BinaryBitmap(HybridBinarizer(source))).text
    }.getOrNull()
}
