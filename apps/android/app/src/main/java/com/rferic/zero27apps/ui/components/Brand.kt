package com.rferic.zero27apps.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rferic.zero27apps.R
import com.rferic.zero27apps.ui.theme.LocalPalette

/** The heartbeat glyph alone, tinted with the brand colour. */
@Composable
fun BrandMark(size: Dp = 24.dp, tint: androidx.compose.ui.graphics.Color = LocalPalette.current.brand) {
    Icon(
        painter = painterResource(R.drawable.ic_brand_heart),
        contentDescription = "027Apps",
        tint = tint,
        modifier = Modifier.size(size),
    )
}

/** The mark on a rounded tile, as the splash and the app icon show it. */
@Composable
fun BrandTile(size: Dp = 56.dp, background: androidx.compose.ui.graphics.Color = LocalPalette.current.brand) {
    Box(
        modifier = Modifier
            .size(size)
            .background(background, RoundedCornerShape(size / 3.2f)),
        contentAlignment = Alignment.Center,
    ) {
        BrandMark(size = size * 0.5f, tint = LocalPalette.current.background)
    }
}

/** Mark + product name, the lockup the mockup puts on the splash and login. */
@Composable
fun BrandLockup(name: String = "027Apps", subtitle: String? = null) {
    val palette = LocalPalette.current
    Row(verticalAlignment = Alignment.CenterVertically) {
        BrandMark(size = 22.dp)
        androidx.compose.foundation.layout.Spacer(Modifier.size(8.dp))
        androidx.compose.foundation.layout.Column {
            Text(name, fontWeight = FontWeight.Bold, fontSize = 17.sp, color = palette.foreground)
            if (subtitle != null) {
                Text(subtitle, fontSize = 11.sp, color = palette.mutedForeground)
            }
        }
    }
}
