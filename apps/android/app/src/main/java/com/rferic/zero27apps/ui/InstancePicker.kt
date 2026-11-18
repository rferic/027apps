package com.rferic.zero27apps.ui

import com.rferic.zero27apps.ui.components.AppAlertDialog
import com.rferic.zero27apps.ui.components.AppFormSheet
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rferic.zero27apps.ui.i18n.LocalStrings
import com.rferic.zero27apps.ui.theme.LocalPalette

/**
 * Instance chooser shared by the login screen and Settings: pick one of the
 * instances this install already knows, or type a new one (validated by
 * [onAdd], which returns the normalised URL or null).
 */
@Composable
fun InstancePickerDialog(
    known: List<String>,
    current: String,
    onAdd: (String) -> String?,
    onPick: (String) -> Unit,
    onRemove: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    var selected by rememberSaveable { mutableStateOf(current) }
    var newUrl by rememberSaveable { mutableStateOf("") }
    var invalid by rememberSaveable { mutableStateOf(false) }
    // The row waiting for a "really remove it?" answer; the item survives until
    // the person confirms, so a stray tap never forgets a server.
    var pendingRemove by rememberSaveable { mutableStateOf<String?>(null) }
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    val removable = known.filterNot { it == current || it == known.first() }

    pendingRemove?.let { url ->
        AppAlertDialog(
            onDismissRequest = { pendingRemove = null },
            title = { Text(strings.removeInstanceTitle) },
            text = { Text(strings.removeInstanceBody.replace("{instance}", url)) },
            confirmButton = {
                TextButton(onClick = {
                    onRemove(url)
                    pendingRemove = null
                    if (selected == url) selected = current
                }) { Text(strings.remove) }
            },
            dismissButton = {
                TextButton(onClick = { pendingRemove = null }) { Text(strings.cancel) }
            },
        )
    }

    AppFormSheet(
        onDismissRequest = onDismiss,
        title = { Text(strings.instance) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Column(
                    modifier = Modifier
                        .heightIn(max = 260.dp)
                        .verticalScroll(rememberScrollState()),
                ) {
                    for (url in known) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .selectable(selected = url == selected, onClick = { selected = url })
                                .padding(vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            RadioButton(
                                selected = url == selected,
                                onClick = { selected = url },
                            )
                            Text(
                                url,
                                fontSize = 13.sp,
                                color = palette.foreground,
                                modifier = Modifier.weight(1f),
                            )
                            if (url in removable) {
                                TextButton(onClick = { pendingRemove = url }) {
                                    Text(strings.remove, fontSize = 12.sp)
                                }
                            }
                        }
                    }
                }

                OutlinedTextField(
                    value = newUrl,
                    onValueChange = {
                        newUrl = it
                        invalid = false
                    },
                    label = { Text(strings.newInstanceUrl) },
                    singleLine = true,
                    isError = invalid,
                    modifier = Modifier.fillMaxWidth(),
                )
                Button(
                    onClick = {
                        val normalized = onAdd(newUrl)
                        if (normalized == null) {
                            invalid = true
                        } else {
                            selected = normalized
                            newUrl = ""
                        }
                    },
                    enabled = newUrl.isNotBlank(),
                ) {
                    Text(strings.add)
                }
                if (invalid) {
                    Text(
                        strings.invalidUrl,
                        color = MaterialTheme.colorScheme.error,
                        fontSize = 12.sp,
                    )
                }
            }
        },
        confirmButton = {
            TextButton(onClick = { onPick(selected) }) { Text(strings.use) }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text(strings.cancel) }
        },
    )
}
