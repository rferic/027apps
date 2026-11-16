package com.rferic.zero27apps.ui.screens

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.patrykandpatrick.vico.compose.cartesian.CartesianChartHost
import com.patrykandpatrick.vico.compose.cartesian.data.CartesianChartModelProducer
import com.patrykandpatrick.vico.compose.cartesian.data.columnSeries
import com.patrykandpatrick.vico.compose.cartesian.layer.ColumnCartesianLayer
import com.patrykandpatrick.vico.compose.cartesian.layer.rememberColumnCartesianLayer
import com.patrykandpatrick.vico.compose.cartesian.rememberCartesianChart
import com.patrykandpatrick.vico.compose.common.Fill
import com.patrykandpatrick.vico.compose.common.component.rememberLineComponent
import com.rferic.zero27apps.data.OweBalanceDto
import com.rferic.zero27apps.data.OweCategoryTotalDto
import com.rferic.zero27apps.data.OweGroupSummaryDto
import com.rferic.zero27apps.ui.components.PrivacyEye
import com.rferic.zero27apps.ui.i18n.LocalStrings
import com.rferic.zero27apps.ui.privacy.LocalPrivacyMasked
import com.rferic.zero27apps.ui.privacy.maskedMoney
import com.rferic.zero27apps.ui.theme.LocalPalette
import java.time.YearMonth
import java.time.format.TextStyle
import java.util.Locale

private data class PersonRow(val name: String, val paid: Long, val consumed: Long, val net: Long)

private data class MonthBar(val month: YearMonth, val amount: Long)

/**
 * The group at a glance: the month's total, where the money went, who paid
 * versus who consumed, and the last six months. Every figure respects the
 * privacy mask; the charts keep their shape but lose the numbers. The totals
 * come from the server summary, so they cover every movement instead of only
 * the pages the list has loaded.
 */
@Composable
fun OweSummaryScreen(
    summary: OweGroupSummaryDto?,
    balances: List<OweBalanceDto>,
    settlementCount: Int,
    currency: String,
    locale: String,
    onBack: () -> Unit = {},
    embedded: Boolean = false,
) {
    val strings = LocalStrings.current
    if (summary == null) {
        EmptyCard(strings.noMovements)
        return
    }
    if (embedded) {
        SummaryBody(summary, balances, settlementCount, currency, locale)
        return
    }
    val palette = LocalPalette.current
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) {
                Icon(Icons.Filled.ArrowBack, contentDescription = strings.back, tint = palette.foreground)
            }
            Text(
                strings.summary,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.weight(1f),
            )
            PrivacyEye()
        }
        SummaryBody(summary, balances, settlementCount, currency, locale)
    }
}

@Composable
private fun SummaryBody(
    summary: OweGroupSummaryDto,
    balances: List<OweBalanceDto>,
    settlementCount: Int,
    currency: String,
    locale: String,
) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    val masked = LocalPrivacyMasked.current
    var tab by remember { mutableStateOf(0) }

    val total = summary.monthTotal
    val previousTotal = summary.previousMonthTotal
    val delta = if (previousTotal > 0) ((total - previousTotal) * 100 / previousTotal) else null

    val people = summary.peopleTotals.map { person ->
        PersonRow(
            person.name,
            person.paid,
            person.consumed,
            balances.firstOrNull { it.memberId == person.memberId }?.amountMinor ?: 0L,
        )
    }

    val months = summary.months.mapNotNull { entry ->
        runCatching { MonthBar(YearMonth.parse(entry.month), entry.total) }.getOrNull()
    }

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.linearGradient(
                        listOf(palette.accent.copy(alpha = 0.28f), palette.accent.copy(alpha = 0.06f)),
                    ),
                    RoundedCornerShape(24.dp),
                )
                .border(1.dp, palette.accent.copy(alpha = 0.35f), RoundedCornerShape(24.dp))
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text(strings.thisMonth.uppercase(), fontSize = 11.sp, letterSpacing = 1.2.sp, color = palette.mutedForeground)
            Text(
                maskedMoney(masked, total, currency, locale),
                fontSize = 38.sp,
                fontWeight = FontWeight.Bold,
                color = palette.foreground,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                if (delta != null) {
                    Text(
                        (if (delta > 0) "↑ " else "↓ ") + "${kotlin.math.abs(delta)} %",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = if (delta > 0) palette.destructive else palette.accent,
                    )
                    Text(strings.vsLastMonth, fontSize = 12.sp, color = palette.mutedForeground)
                } else {
                    Text(strings.firstMonth, fontSize = 12.sp, color = palette.mutedForeground)
                }
            }
            Text(
                when (settlementCount) {
                    0 -> strings.settledUp
                    1 -> strings.pendingTransferOne
                    else -> strings.pendingTransfers.replace("{count}", settlementCount.toString())
                },
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                color = if (settlementCount == 0) palette.accent else palette.foreground,
            )
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(strings.byCategory, strings.byPerson, strings.evolution).forEachIndexed { index, label ->
                val on = tab == index
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .background(
                            if (on) palette.accent.copy(alpha = 0.14f) else palette.surface,
                            RoundedCornerShape(12.dp),
                        )
                        .border(1.dp, if (on) palette.accent else palette.border, RoundedCornerShape(12.dp))
                        .clickable { tab = index }
                        .padding(vertical = 10.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        label,
                        fontSize = 12.sp,
                        fontWeight = if (on) FontWeight.SemiBold else FontWeight.Normal,
                        color = if (on) palette.accent else palette.mutedForeground,
                    )
                }
            }
        }

        when (tab) {
            0 -> CategoryReport(
                month = summary.categoryTotals,
                history = summary.categoryHistory,
                monthTotal = summary.monthTotal,
                historyTotal = summary.expensesTotal,
                currency = currency,
                locale = locale,
                masked = masked,
            )
            1 -> PeopleReport(people, currency, locale, masked)
            else -> MonthsReport(months, currency, locale)
        }
    }
}

@Composable
private fun CategoryReport(
    month: List<OweCategoryTotalDto>,
    history: List<OweCategoryTotalDto>,
    monthTotal: Long,
    historyTotal: Long,
    currency: String,
    locale: String,
    masked: Boolean,
) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    var historical by remember { mutableStateOf(false) }
    val categories = if (historical) history else month
    val total = if (historical) historyTotal else monthTotal
    if (categories.isEmpty() || (total == 0L && !historical)) {
        EmptyCard(strings.noMovements)
        return
    }
    val max = categories.maxOf { it.total }.coerceAtLeast(1)

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(palette.surface, RoundedCornerShape(24.dp))
            .border(1.dp, palette.border, RoundedCornerShape(24.dp))
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(strings.thisMonth to false, strings.allHistory to true).forEach { (label, value) ->
                val on = historical == value
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .background(
                            if (on) palette.accent.copy(alpha = 0.14f) else palette.background,
                            RoundedCornerShape(10.dp),
                        )
                        .border(1.dp, if (on) palette.accent else palette.border, RoundedCornerShape(10.dp))
                        .clickable { historical = value }
                        .padding(vertical = 8.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        label,
                        fontSize = 11.sp,
                        fontWeight = if (on) FontWeight.SemiBold else FontWeight.Normal,
                        color = if (on) palette.accent else palette.mutedForeground,
                    )
                }
            }
        }
        Text(
            maskedMoney(masked, total, currency, locale),
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
        )
        categories.forEach { entry ->
            val percent = if (total > 0) ((entry.total * 100) / total).toInt() else 0
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        entry.name.ifEmpty { strings.noCategory },
                        modifier = Modifier.weight(1f),
                        fontSize = 12.sp,
                        maxLines = 1,
                    )
                    Text(
                        "${maskedMoney(masked, entry.total, currency, locale)} · $percent %",
                        fontSize = 11.sp,
                        color = palette.mutedForeground,
                    )
                }
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(8.dp)
                        .background(palette.mutedForeground.copy(alpha = 0.12f), RoundedCornerShape(4.dp)),
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(if (entry.total == 0L) 0f else (entry.total.toFloat() / max).coerceIn(0f, 1f))
                            .height(8.dp)
                            .background(palette.accent, RoundedCornerShape(4.dp)),
                    )
                }
            }
        }
    }
}

@Composable
private fun PeopleReport(people: List<PersonRow>, currency: String, locale: String, masked: Boolean) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    if (people.isEmpty()) {
        EmptyCard(strings.noMovements)
        return
    }
    val max = people.maxOf { maxOf(it.paid, it.consumed) }.coerceAtLeast(1)
    var progress by remember { mutableStateOf(0f) }
    LaunchedEffect(Unit) { progress = 1f }
    val grow by animateFloatAsState(progress, tween(700), label = "bars")

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(palette.surface, RoundedCornerShape(24.dp))
            .border(1.dp, palette.border, RoundedCornerShape(24.dp))
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            LegendDot(palette.accent, strings.paidLabel)
            LegendDot(palette.mutedForeground, strings.consumedLabel)
        }
        for (person in people) {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(person.name, modifier = Modifier.weight(1f), fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    Text(
                        signedMoney(person.net, currency, locale, masked),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = when {
                            person.net > 0 -> palette.accent
                            person.net < 0 -> palette.destructive
                            else -> palette.mutedForeground
                        },
                    )
                }
                Bar(palette.accent, person.paid.toFloat() / max, grow)
                Bar(palette.mutedForeground.copy(alpha = 0.45f), person.consumed.toFloat() / max, grow)
            }
        }
    }
}

@Composable
private fun Bar(color: Color, fraction: Float, grow: Float) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(10.dp)
            .background(color.copy(alpha = 0.12f), RoundedCornerShape(5.dp)),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth(fraction.coerceIn(0f, 1f) * grow)
                .height(10.dp)
                .background(color, RoundedCornerShape(5.dp)),
        )
    }
}

@Composable
private fun LegendDot(color: Color, label: String) {
    val palette = LocalPalette.current
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(9.dp).background(color, RoundedCornerShape(3.dp)))
        Text(label, fontSize = 11.sp, color = palette.mutedForeground, modifier = Modifier.padding(start = 6.dp))
    }
}

@Composable
private fun MonthsReport(months: List<MonthBar>, currency: String, locale: String) {
    val palette = LocalPalette.current
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(palette.surface, RoundedCornerShape(24.dp))
            .border(1.dp, palette.border, RoundedCornerShape(24.dp))
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        MonthColumns(months, palette.accent, locale)
    }
}

/** The evolution chart: Vico's column layer, styled with the module colour. */
@Composable
private fun MonthColumns(months: List<MonthBar>, accent: Color, locale: String) {
    val modelProducer = remember { CartesianChartModelProducer() }
    val labels = months.map {
        it.month.month.getDisplayName(TextStyle.SHORT, Locale.forLanguageTag(locale)).uppercase()
    }
    LaunchedEffect(months) {
        modelProducer.runTransaction {
            columnSeries { series(months.map { it.amount.toDouble() }) }
        }
    }
    CartesianChartHost(
        chart = rememberCartesianChart(
            rememberColumnCartesianLayer(
                columnProvider = ColumnCartesianLayer.ColumnProvider.series(
                    rememberLineComponent(Fill(accent), 18.dp, RoundedCornerShape(10.dp)),
                ),
            ),
            startAxis = null,
            bottomAxis = null,
        ),
        modelProducer = modelProducer,
        modifier = Modifier.fillMaxWidth().height(150.dp),
    )
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        for (label in labels) {
            Text(
                label,
                modifier = Modifier.weight(1f),
                fontSize = 10.sp,
                color = LocalPalette.current.mutedForeground,
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
private fun EmptyCard(text: String) {
    val palette = LocalPalette.current
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(palette.surface, RoundedCornerShape(24.dp))
            .border(1.dp, palette.border, RoundedCornerShape(24.dp))
            .padding(24.dp),
    ) {
        Text(text, fontSize = 13.sp, color = palette.mutedForeground)
    }
}

@Composable
private fun signedMoney(amount: Long, currency: String, locale: String, masked: Boolean): String {
    if (masked) return maskedMoney(true, 0, currency, locale)
    val sign = if (amount >= 0) "+" else "−"
    return sign + maskedMoney(false, if (amount < 0) -amount else amount, currency, locale)
}
