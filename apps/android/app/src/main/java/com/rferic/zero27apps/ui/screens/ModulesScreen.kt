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
fun ModulesScreen(modules: List<ModuleDto>, onOpen: (String) -> Unit) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current

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
                        ModuleTile(module, Modifier.weight(1f)) { onOpen(module.key) }
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
    modifier: Modifier = Modifier,
    onClick: () -> Unit = {},
) {
    val palette = LocalPalette.current
    Column(
        modifier = modifier
            .clickable(onClick = onClick)
            .background(palette.successSubtle, RoundedCornerShape(18.dp))
            .border(1.dp, palette.border, RoundedCornerShape(18.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            modifier = Modifier
                .size(52.dp)
                .background(palette.accent, RoundedCornerShape(14.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                module.name.take(1).uppercase(),
                color = palette.background,
                fontWeight = FontWeight.Bold,
                fontSize = 22.sp,
            )
        }
        Text(module.name, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
        Text("v${module.version}", fontSize = 12.sp, color = palette.mutedForeground)
    }
}
