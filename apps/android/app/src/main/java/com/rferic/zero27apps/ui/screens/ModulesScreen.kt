package com.rferic.zero27apps.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rferic.zero27apps.data.ModuleDto
import com.rferic.zero27apps.ui.i18n.LocalStrings
import com.rferic.zero27apps.ui.theme.LocalPalette

/** Módulos: the launcher. Only the modules the Core says this user can open. */
@Composable
fun ModulesScreen(modules: List<ModuleDto>) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(strings.modules, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        if (modules.isEmpty()) {
            Text(
                strings.noModulesLauncher,
                color = palette.mutedForeground,
                fontSize = 13.sp,
            )
        } else {
            for (module in modules) ModuleRow(module)
        }
    }
}
