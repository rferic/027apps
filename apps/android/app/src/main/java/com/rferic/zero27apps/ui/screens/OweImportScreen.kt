package com.rferic.zero27apps.ui.screens

import com.rferic.zero27apps.ui.components.AppFormSheet
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
import com.rferic.zero27apps.data.OweImportNewMember
import com.rferic.zero27apps.data.OweImportPreviewDto
import com.rferic.zero27apps.data.OweImportResultDto
import com.rferic.zero27apps.data.OweMappingOptionDto
import com.rferic.zero27apps.ui.i18n.LocalStrings
import com.rferic.zero27apps.ui.theme.LocalPalette
import java.io.IOException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** The server refuses files over 2 MB; reading more than that would only waste memory. */
private const val MAX_CSV_BYTES = 2 * 1024 * 1024

/**
 * Reads a text file the user picked, off the main thread and capped at the size
 * the API accepts: the picker also offers any text file, videos included.
 * Null when it cannot be opened; `tooBig` is signalled with an empty string.
 */
private suspend fun readCsv(context: Context, uri: android.net.Uri): String? =
    withContext(Dispatchers.IO) {
        runCatching {
            context.contentResolver.openInputStream(uri)?.use { stream ->
                val buffer = ByteArray(MAX_CSV_BYTES + 1)
                var read = 0
                while (read < buffer.size) {
                    val chunk = stream.read(buffer, read, buffer.size - read)
                    if (chunk <= 0) break
                    read += chunk
                }
                if (read > MAX_CSV_BYTES) "" else String(buffer, 0, read, Charsets.UTF_8)
            }
        }.getOrNull()
    }

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
    var mappingOptions by remember { mutableStateOf<List<OweMappingOptionDto>>(emptyList()) }
    var mapping by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    var pending by remember { mutableStateOf<Map<String, OweImportNewMember>>(emptyMap()) }
    var mappingName by remember { mutableStateOf<String?>(null) }
    var duplicates by remember { mutableStateOf(false) }
    var result by remember { mutableStateOf<OweImportResultDto?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        busy = true
        scope.launch {
            val text = readCsv(context, uri)
            if (text == null) {
                error = strings.fileError
                busy = false
                return@launch
            }
            if (text.isEmpty()) {
                error = strings.importTooBig
                busy = false
                return@launch
            }
            csv = text
            runCatching { api.oweImportPreview(groupId, text) }
                .onSuccess { value ->
                    preview = value
                    mappingOptions = runCatching { api.oweMappingOptions(groupId) }.getOrDefault(emptyList())
                }
                .onFailure { error = oweErrorText(it, strings) }
            busy = false
        }
    }

    fun mapName(name: String, option: OweMappingOptionDto?) {
        // Nothing is created here: the choice travels to the commit, which
        // creates the member in the import's own transaction. Cancelling the
        // screen must leave the group exactly as it was.
        val (nextMapping, nextPending) = chooseImportMapping(name, option, mapping, pending)
        mapping = nextMapping
        pending = nextPending
        mappingName = null
    }

    fun isMapped(name: String): Boolean = mapping.containsKey(name) || pending.containsKey(name)

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
                "${strings.errorsLabel}: ${result!!.errors}",
                "${strings.categoriesLabel}: ${result!!.categories}",
            ), palette.surface, palette.border, palette.mutedForeground)
            Button(onClick = onClose, modifier = Modifier.fillMaxWidth()) { Text(strings.done) }
            return@Column
        }

        Button(onClick = { picker.launch("text/*") }, modifier = Modifier.fillMaxWidth()) {
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

        if (current.errors.isNotEmpty()) {
            Text(
                "${strings.errorsLabel}: ${current.errors.size}",
                color = palette.destructive,
                fontSize = 12.sp,
            )
            current.errors.take(3).forEach { error ->
                Text("· ${error.line}: ${error.message}", fontSize = 11.sp, color = palette.destructive)
            }
        }

        if (current.unresolved.isNotEmpty()) {
            Text(strings.mapIdentity.uppercase(), fontSize = 11.sp, letterSpacing = 1.sp, color = palette.mutedForeground)
            for (name in current.unresolved) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(name, modifier = Modifier.weight(1f), fontSize = 13.sp)
                    if (isMapped(name)) {
                        Text("✓", color = palette.accent, fontSize = 14.sp)
                    } else {
                        TextButton(onClick = { mappingName = name }) { Text(strings.assign) }
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
            current.errors.isEmpty() &&
            current.unresolved.all { isMapped(it) } &&
            (current.duplicates == 0 || duplicates)
        val whyDisabled = when {
            current.currencies.size > 1 -> strings.multiCurrency
            current.errors.isNotEmpty() -> strings.fileError
            current.unresolved.any { !isMapped(it) } -> strings.mapIdentity
            current.duplicates > 0 && !duplicates -> strings.importDuplicates
            else -> null
        }
        if (whyDisabled != null) {
            Text(whyDisabled, fontSize = 12.sp, color = palette.mutedForeground)
        }
        Button(
            onClick = {
                val text = csv ?: return@Button
                busy = true
                scope.launch {
                    runCatching {
                        api.oweImportCommit(
                            groupId,
                            text,
                            mapping.ifEmpty { null },
                            pending.values.toList().ifEmpty { null },
                            duplicates,
                        )
                    }.onSuccess { result = it }.onFailure { error = oweErrorText(it, strings) }
                    busy = false
                }
            },
            enabled = ready && !busy,
            modifier = Modifier.fillMaxWidth(),
        ) { Text(strings.confirmImport) }
    }

    mappingName?.let { name ->
        AppFormSheet(
            onDismissRequest = { mappingName = null },
            title = { Text("$name · ${strings.mapIdentity}") },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    ranked(name, mappingOptions).forEach { option ->
                        TextButton(onClick = { mapName(name, option) }, modifier = Modifier.fillMaxWidth()) {
                            val marker = if (normalized(option.displayName) == normalized(name)) "✓ " else ""
                            val suffix = if (option.kind == "member") {
                                " · ${strings.inGroup}"
                            } else {
                                " · ${strings.account}"
                            }
                            Text("$marker${option.displayName}$suffix")
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

/**
 * What the mapping step decided for one CSV name: reuse an existing member, or
 * ask the commit to create one (a fictitious person, or a real account that
 * enters invited). Pure, so the screen never creates a member while mapping.
 */
internal fun chooseImportMapping(
    name: String,
    option: OweMappingOptionDto?,
    mapping: Map<String, String>,
    pending: Map<String, OweImportNewMember>,
): Pair<Map<String, String>, Map<String, OweImportNewMember>> =
    if (option?.kind == "member") {
        (mapping - name + (name to option.id)) to (pending - name)
    } else {
        (mapping - name) to (
            pending - name + (
                name to OweImportNewMember(
                    name = name,
                    // A real account is invited by the server; its display name
                    // may differ from the one written in the CSV.
                    displayName = option?.displayName ?: name,
                    userId = option?.id,
                )
            )
        )
    }

private fun normalized(value: String): String =
    java.text.Normalizer.normalize(value, java.text.Normalizer.Form.NFD)
        .replace(Regex("\\p{M}"), "")
        .lowercase()

/** Exact matches first, members before accounts, then similar names. */
private fun ranked(name: String, options: List<OweMappingOptionDto>): List<OweMappingOptionDto> {
    val wanted = normalized(name)
    return options.sortedWith(
        compareByDescending<OweMappingOptionDto> { normalized(it.displayName) == wanted }
            .thenByDescending { it.kind == "member" }
            .thenByDescending {
                val other = normalized(it.displayName)
                other.contains(wanted) || wanted.contains(other)
            }
            .thenBy { it.displayName },
    )
}

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
