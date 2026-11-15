package com.rferic.zero27apps.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.platform.LocalContext
import coil.compose.SubcomposeAsyncImage
import coil.imageLoader
import coil.request.ImageRequest
import com.rferic.zero27apps.ui.theme.moduleAccent
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rferic.zero27apps.data.ModuleDto
import com.rferic.zero27apps.ui.i18n.LocalStrings
import com.rferic.zero27apps.ui.theme.LocalPalette

/**
 * Módulos: the launcher, as the approved mockup's two-column grid with a tinted
 * card per module.
 */
@Composable
fun ModulesScreen(
    modules: List<ModuleDto>,
    onOpen: (String) -> Unit,
    iconUrl: (String) -> String? = { null },
    token: String? = null,
) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    val context = LocalContext.current
    // Warm the image cache as soon as the list exists: the icons then appear
    // without a blank beat when the tab opens.
    LaunchedEffect(modules.size, token) {
        val loader = context.imageLoader
        modules.forEach { module ->
            iconUrl(module.key)?.let { url ->
                loader.enqueue(
                    ImageRequest.Builder(context)
                        .data(url)
                        .apply { if (token != null) addHeader("Authorization", "Bearer $token") }
                        .build(),
                )
            }
        }
    }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Text(
            strings.modules,
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold,
            color = palette.foreground,
        )
        Text(strings.onlyActive, fontSize = 13.sp, color = palette.mutedForeground)

        if (modules.isEmpty()) {
            Text(strings.noModulesLauncher, color = palette.mutedForeground, fontSize = 13.sp)
        } else {
            modules.chunked(2).forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    for (module in row) {
                        ModuleTile(
                            module = module,
                            iconUrl = iconUrl(module.key),
                            token = token,
                            modifier = Modifier.weight(1f),
                        ) { onOpen(module.key) }
                    }
                    if (row.size == 1) Spacer(Modifier.weight(1f))
                }
            }
        }

    }
}

@Composable
private fun ModuleTile(
    module: ModuleDto,
    iconUrl: String? = null,
    token: String? = null,
    modifier: Modifier = Modifier,
    onClick: () -> Unit = {},
) {
    val palette = LocalPalette.current
    Column(
        modifier = modifier
            .clickable(onClick = onClick)
            .background(palette.surface, RoundedCornerShape(18.dp))
            .border(1.dp, palette.border, RoundedCornerShape(18.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            modifier = Modifier
                .size(52.dp)
                .background(moduleAccent(module.branding.color).copy(alpha = 0.14f), RoundedCornerShape(14.dp)),
            contentAlignment = Alignment.Center,
        ) {
            val context = LocalContext.current
            val accent = moduleAccent(module.branding.color)
            val fallback = if (module.key.startsWith("owe")) "€" else module.name.take(1).uppercase()
            if (iconUrl == null) {
                Text(fallback, color = accent, fontWeight = FontWeight.Bold, fontSize = 22.sp)
            } else {
                SubcomposeAsyncImage(
                    // Same header as the prefetch: a protected icon must not be
                    // requested twice, once with the token and once without it.
                    model = ImageRequest.Builder(context)
                        .data(iconUrl)
                        .apply { if (token != null) addHeader("Authorization", "Bearer $token") }
                        .build(),
                    contentDescription = null,
                    colorFilter = ColorFilter.tint(accent),
                    modifier = Modifier.size(26.dp),
                    loading = {
                        Text(fallback, color = accent, fontWeight = FontWeight.Bold, fontSize = 22.sp)
                    },
                    error = {
                        Text(fallback, color = accent, fontWeight = FontWeight.Bold, fontSize = 22.sp)
                    },
                )
            }
        }
        Text(module.name, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
        Text("v${module.version}", fontSize = 12.sp, color = palette.mutedForeground)
    }
}
