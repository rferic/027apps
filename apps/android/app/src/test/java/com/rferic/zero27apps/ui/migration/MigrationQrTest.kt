package com.rferic.zero27apps.ui.migration

import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter
import com.rferic.zero27apps.auth.MigrationLink
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The QR is the only place the code appears, so what it encodes has to be a
 * link the app itself can read back: the https URL on a deployed instance and
 * the debug scheme on a local http one (no App Link can verify there). The
 * decoder is exercised with the same padded luma plane the camera delivers.
 */
class MigrationQrTest {
    private val token = "027_mig_testtoken123"

    private fun luminanceOf(content: String, size: Int = 200): ByteArray {
        val matrix = QRCodeWriter().encode(content, BarcodeFormat.QR_CODE, size, size)
        return ByteArray(size * size) { index ->
            val x = index % size
            val y = index / size
            if (matrix[x, y]) 0.toByte() else 255.toByte()
        }
    }

    @Test
    fun `an https instance encodes the app link the app parses`() {
        val content = migrationQrContent("https://027apps.ericrf.com/", token)
        assertEquals("https://027apps.ericrf.com/migrate/$token", content)
        val parsed = MigrationLink.parse(content)
        assertEquals(token, parsed?.token)
        assertEquals("https://027apps.ericrf.com", parsed?.instance)
    }

    @Test
    fun `a local http instance encodes the debug scheme with its instance`() {
        val content = migrationQrContent("http://192.168.1.108:3003", token)
        assertTrue(content.startsWith("zero27apps-dev://migrate/$token?instance="))
        val parsed = MigrationLink.parse(content)
        assertEquals(token, parsed?.token)
        assertEquals("http://192.168.1.108:3003", parsed?.instance)
    }

    @Test
    fun `the decoder reads a padded camera frame back to the same link`() {
        val content = migrationQrContent("http://192.168.1.108:3003", token)
        val size = 200
        val luma = luminanceOf(content, size)
        val width = 200
        val rowStride = 256
        // A padded frame: each row carries the first 200 pixels plus 56 bytes of
        // padding, exactly what CameraX hands the analyzer.
        val padded = ByteArray(rowStride * size)
        for (row in 0 until size) {
            luma.copyInto(padded, row * rowStride, row * size, row * size + width)
        }
        assertEquals(content, decodeQrFromLuminance(padded, width, size, rowStride))
    }

    @Test
    fun `a frame that is too short decodes to null instead of throwing`() {
        assertNull(decodeQrFromLuminance(ByteArray(10), 200, 200, 256))
    }
}
