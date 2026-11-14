package com.rferic.zero27apps.ui.screens

import android.content.Context
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rferic.zero27apps.data.ApiClient
import com.rferic.zero27apps.data.OweAddMemberBody
import com.rferic.zero27apps.data.OweIdentityDto
import com.rferic.zero27apps.data.OweImportPreviewDto
import com.rferic.zero27apps.data.OweImportResultDto
import com.rferic.zero27apps.ui.i18n.LocalStrings
import com.rferic.zero27apps.ui.theme.LocalPalette
import java.io.IOException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** Reads a text file the user picked; null when it cannot be opened. */
private fun readCsv(context: Context, uri: android.net.Uri): String? =
    runCatching {
        context.contentResolver.openInputStream(uri)?.bufferedReader()?.use { it.readText() }
    }.getOrNull()

/**
 * Splitwise import, four steps: choose the CSV, dry-run it, map the names the
 * group does not know (an active account or a fictitious member) and commit.
 * Only the group creator reaches this screen; the API re-checks it.
 */
@Composable
fun OweImportScreen(api: ApiClient, groupId: String, onClose: () -> Unit) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var csv by remember { mutableStateOf<String?>(null) }
    var preview by remember { mutableStateOf<OweImportPreviewDto?>(null) }
    var identities by remember { mutableStateOf<List<OweIdentityDto>>(emptyList()) }
    var mapping by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    var mappingName by remember { mutableStateOf<String?>(null) }
    var duplicates by remember { mutableStateOf(false) }
    var result by remember { mutableStateOf<OweImportResultDto?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        val text = readCsv(context, uri)
        if (text == null) {
            error = strings.fileError
            return@rememberLauncherForActivityResult
        }
        csv = text
        busy = true
        scope.launch {
            runCatching { api.oweImportPreview(groupId, text) }
                .onSuccess { value ->
                    preview = value
                    identities = runCatching { api.oweIdentities(groupId) }.getOrDefault(emptyList())
                }
                .onFailure { error = it.message }
            busy = false
        }
    }

    fun mapName(name: String, inviteeId: String?) {
        busy = true
        scope.launch {
            runCatching {
                api.oweAddMember(
                    groupId,
                    OweAddMemberBody(if (inviteeId == null) name else displayNameFor(identities, inviteeId), inviteeId, active = true),
                )
            }.onSuccess { member ->
                mapping = mapping + (name to member.id)
                identities = identities.filterNot { it.id == inviteeId }
            }.onFailure { error = it.message }
            busy = false
            mappingName = null
        }
    }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onClose) {
                Icon(Icons.Filled.ArrowBack, contentDescription = strings.back, tint = palette.foreground)
            }
            Text(
                strings.importTitle,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.weight(1f),
            )
            if (busy) CircularProgressIndicator(modifier = Modifier.padding(4.dp))
        }

        error?.let { Text(it, color = palette.destructive, fontSize = 12.sp) }

        if (result != null) {
            Summary(strings.importResult, listOf(
                "${strings.created}: ${result!!.created}",
                "${strings.skipped}: ${result!!.skippedDuplicates}",
                "${strings.duplicates}: ${result!!.errors}",
                "${strings.categoriesLabel}: ${result!!.categories}",
            ), palette.surface, palette.border, palette.mutedForeground)
            Button(onClick = onClose, modifier = Modifier.fillMaxWidth()) { Text(strings.done) }
            return@Column
        }

        Button(onClick = { picker.launch("*/*") }, modifier = Modifier.fillMaxWidth()) {
            Text(strings.chooseCsv)
        }

        val current = preview
        if (current == null) return@Column

        Summary(
            strings.preview,
            listOf(
                "${strings.movements}: ${current.movements}",
                "${strings.payments}: ${current.payments}",
                "${strings.skipped}: ${current.skipped}",
                "${strings.duplicates}: ${current.duplicates}",
                "${strings.currencies}: ${current.currencies.joinToString(", ")}",
            ),
            palette.surface,
            palette.border,
            palette.mutedForeground,
        )

        if (current.currencies.size > 1) {
            Text(strings.multiCurrency, color = palette.destructive, fontSize = 12.sp)
        }

        if (current.unresolved.isNotEmpty()) {
            Text(strings.mapIdentity.uppercase(), fontSize = 11.sp, letterSpacing = 1.sp, color = palette.mutedForeground)
            for (name in current.unresolved) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(name, modifier = Modifier.weight(1f), fontSize = 13.sp)
                    if (mapping.containsKey(name)) {
                        Text("✓", color = palette.accent, fontSize = 14.sp)
                    } else {
                        TextButton(onClick = { mappingName = name }) { Text(strings.invite) }
                    }
                }
            }
        }

        if (current.duplicates > 0) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Checkbox(checked = duplicates, onCheckedChange = { duplicates = it })
                Text(strings.importDuplicates, fontSize = 12.sp)
            }
        }

        val ready = current.currencies.size <= 1 &&
            current.unresolved.all { mapping.containsKey(it) } &&
            (current.duplicates == 0 || duplicates)
        Button(
            onClick = {
                val text = csv ?: return@Button
                busy = true
                scope.launch {
                    runCatching {
                        api.oweImportCommit(groupId, text, mapping.ifEmpty { null }, duplicates)
                    }.onSuccess { result = it }.onFailure { error = it.message }
                    busy = false
                }
            },
            enabled = ready && !busy,
            modifier = Modifier.fillMaxWidth(),
        ) { Text(strings.confirmImport) }
    }

    mappingName?.let { name ->
        AlertDialog(
            onDismissRequest = { mappingName = null },
            title = { Text("$name · ${strings.mapIdentity}") },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    identities.forEach { identity ->
                        TextButton(onClick = { mapName(name, identity.id) }, modifier = Modifier.fillMaxWidth()) {
                            Text(identity.displayName)
                        }
                    }
                    TextButton(onClick = { mapName(name, null) }, modifier = Modifier.fillMaxWidth()) {
                        Text(strings.createFictitious)
                    }
                }
            },
            confirmButton = {},
            dismissButton = { TextButton(onClick = { mappingName = null }) { Text(strings.cancel) } },
        )
    }
}

private fun displayNameFor(identities: List<OweIdentityDto>, userId: String): String =
    identities.firstOrNull { it.id == userId }?.displayName ?: ""

@Composable
private fun Summary(
    title: String,
    lines: List<String>,
    surface: androidx.compose.ui.graphics.Color,
    border: androidx.compose.ui.graphics.Color,
    muted: androidx.compose.ui.graphics.Color,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(surface, RoundedCornerShape(16.dp))
            .border(1.dp, border, RoundedCornerShape(16.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(title.uppercase(), fontSize = 11.sp, letterSpacing = 1.sp, color = muted)
        lines.forEach { line -> Text(line, fontSize = 13.sp) }
    }
}
