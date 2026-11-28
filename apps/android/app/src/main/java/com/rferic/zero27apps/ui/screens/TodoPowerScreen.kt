package com.rferic.zero27apps.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rferic.zero27apps.data.TodoBoardDto
import com.rferic.zero27apps.data.TodoGroupDto
import com.rferic.zero27apps.data.TodoPowerRow
import com.rferic.zero27apps.data.TodoSeasonDto
import com.rferic.zero27apps.ui.i18n.LocalStrings
import com.rferic.zero27apps.ui.theme.LocalPalette

/**
 * The season in progress and the archive (spec §10). Closing is the owner's
 * call and only makes sense in `infinite` mode: a weekly, monthly or yearly
 * season closes itself.
 */
@Composable
fun TodoPowerPane(
    group: TodoGroupDto?,
    board: TodoBoardDto?,
    seasons: List<TodoSeasonDto>,
    isOwner: Boolean,
    onCloseSeason: () -> Unit,
    onOpenSeason: (Int) -> Unit,
) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    val rows = board?.rows ?: emptyList()
    val closed = seasons.filter { it.closedOn != null }

    Column(
        Modifier.fillMaxSize().padding(horizontal = 16.dp).verticalScroll(rememberScrollState()),
    ) {
        Text(
            "${strings.todoSeason} ${board?.seasonNumber ?: 1} · ${board?.period ?: group?.powerPeriod ?: ""}",
            color = palette.mutedForeground,
            fontSize = 12.sp,
        )
        Spacer(Modifier.height(10.dp))
        if (rows.isEmpty()) {
            Text(strings.todoEmpty, color = palette.mutedForeground, fontSize = 13.sp)
        }
        rows.forEach { row -> PowerRow(row) }

        Spacer(Modifier.height(16.dp))
        if (isOwner && group?.powerPeriod == "infinite") {
            Button(onClick = onCloseSeason, modifier = Modifier.fillMaxWidth()) {
                Text(strings.todoCloseSeason)
            }
            Text(
                strings.todoCloseSeasonHint,
                color = palette.mutedForeground,
                fontSize = 11.sp,
                modifier = Modifier.padding(top = 6.dp),
            )
        }

        if (closed.isNotEmpty()) {
            TodoSectionLabel(strings.todoArchive)
            closed.forEach { season ->
                Row(
                    Modifier
                        .fillMaxWidth()
                        .background(palette.surface, RoundedCornerShape(12.dp))
                        .border(1.dp, palette.border, RoundedCornerShape(12.dp))
                        .clickable { onOpenSeason(season.number) }
                        .padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        "${strings.todoSeason} ${season.number}",
                        color = palette.foreground,
                        fontSize = 13.sp,
                        modifier = Modifier.weight(1f),
                    )
                    Text(
                        strings.todoClosedOn.replace("{date}", season.closedOn ?: ""),
                        color = palette.mutedForeground,
                        fontSize = 11.sp,
                    )
                }
                Spacer(Modifier.height(8.dp))
            }
        }
    }
}

/** One archived season: winner and full ranking. */
@Composable
fun TodoSeasonPane(season: TodoSeasonDto?) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    val rows = season?.rows ?: emptyList()
    Column(
        Modifier.fillMaxSize().padding(horizontal = 16.dp).verticalScroll(rememberScrollState()),
    ) {
        if (season == null) {
            Text(strings.todoEmpty, color = palette.mutedForeground, fontSize = 13.sp)
            return@Column
        }
        Text(
            "${strings.todoSeason} ${season.number} · ${season.period}",
            color = palette.mutedForeground,
            fontSize = 12.sp,
        )
        season.closedOn?.let {
            Text(strings.todoClosedOn.replace("{date}", it), color = palette.mutedForeground, fontSize = 11.sp)
        }
        rows.firstOrNull()?.let { winner ->
            Text(
                strings.todoWinner.replace("{name}", winner.displayName),
                color = palette.foreground,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(vertical = 10.dp),
            )
        }
        rows.forEach { row -> PowerRow(row) }
    }
}

@Composable
private fun PowerRow(row: TodoPowerRow) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    Row(
        Modifier.fillMaxWidth().padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text("${row.position}.", color = palette.mutedForeground, fontSize = 12.sp, modifier = Modifier.padding(end = 10.dp))
        Text(row.displayName, color = palette.foreground, fontSize = 13.5.sp, modifier = Modifier.weight(1f))
        Text(
            "${row.points} ⚡ · ${row.tasksDone} " +
                (if (row.tasksDone == 1) strings.todoTasksDoneOne else strings.todoTasksDone),
            color = palette.mutedForeground,
            fontSize = 11.5.sp,
        )
    }
}
