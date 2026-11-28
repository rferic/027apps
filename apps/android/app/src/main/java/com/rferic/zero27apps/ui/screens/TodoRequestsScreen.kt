package com.rferic.zero27apps.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rferic.zero27apps.data.TodoRequestDto
import com.rferic.zero27apps.ui.i18n.LocalStrings
import com.rferic.zero27apps.ui.theme.LocalPalette

/**
 * The inbox (spec §10): what they ask of me and what I asked, with the same
 * Accept/Deny the notification offers. It stays the source of truth when the
 * push could not be answered.
 */
@Composable
fun TodoRequestsPane(
    requests: List<TodoRequestDto>,
    tab: String,
    onTab: (String) -> Unit,
    onAccept: (TodoRequestDto) -> Unit,
    onDeny: (TodoRequestDto) -> Unit,
) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            TodoPill(
                "${strings.todoIncoming} ${requests.count { it.state == "pending" }}",
                tab == "incoming",
            ) { if (tab != "incoming") onTab("incoming") }
            TodoPill(strings.todoOutgoing, tab == "outgoing") { if (tab != "outgoing") onTab("outgoing") }
        }
        Spacer(Modifier.height(8.dp))
        LazyColumn(
            Modifier.fillMaxSize().padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            if (requests.isEmpty()) item {
                Text(strings.todoEmpty, color = palette.mutedForeground, fontSize = 13.sp)
            }
            items(requests) { request ->
                Column(
                    Modifier
                        .fillMaxWidth()
                        .background(palette.surface, RoundedCornerShape(14.dp))
                        .border(1.dp, palette.border, RoundedCornerShape(14.dp))
                        .padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Text(
                        "«${request.taskTitle}»",
                        color = palette.foreground,
                        fontSize = 13.5.sp,
                        fontWeight = FontWeight.Medium,
                    )
                    Text(
                        if (tab == "incoming") {
                            "${request.requesterName} · ${request.groupName}"
                        } else {
                            "${request.groupName} · ${expiry(request.expiresAt, strings.todoExpires)}"
                        },
                        color = palette.mutedForeground,
                        fontSize = 11.5.sp,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (request.state == "pending") {
                            if (tab == "incoming") {
                                TodoAction(strings.todoAccept) { onAccept(request) }
                                TodoAction(strings.todoDeny) { onDeny(request) }
                            } else {
                                TodoTag(strings.todoExpires.replace("{date}", request.expiresAt.take(16)), palette.mutedForeground)
                            }
                        } else {
                            TodoTag(
                                when (request.state) {
                                    "accepted" -> "✓ ${strings.todoRequestAccepted}"
                                    "denied" -> "✕ ${strings.todoRequestDenied}"
                                    else -> strings.todoRequestExpired
                                },
                                if (request.state == "accepted") palette.accent else palette.destructive,
                            )
                        }
                    }
                }
            }
        }
    }
}

/** ISO timestamp → "expires 2026-11-29 08:03", short enough for a row. */
private fun expiry(iso: String, template: String): String =
    template.replace("{date}", iso.take(16).replace('T', ' '))
