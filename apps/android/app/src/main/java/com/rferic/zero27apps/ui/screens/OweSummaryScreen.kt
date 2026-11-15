package com.rferic.zero27apps.ui.screens

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
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
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.patrykandpatrick.vico.compose.cartesian.CartesianChartHost
import com.patrykandpatrick.vico.compose.cartesian.rememberCartesianChart
import com.patrykandpatrick.vico.compose.cartesian.axis.HorizontalAxis
import com.patrykandpatrick.vico.compose.cartesian.data.CartesianChartModelProducer
import com.patrykandpatrick.vico.compose.cartesian.data.columnSeries
import com.patrykandpatrick.vico.compose.cartesian.layer.ColumnCartesianLayer
import com.patrykandpatrick.vico.compose.cartesian.layer.rememberColumnCartesianLayer
import com.patrykandpatrick.vico.compose.common.Fill
import com.patrykandpatrick.vico.compose.common.component.rememberLineComponent
import com.rferic.zero27apps.data.OweBalanceDto
import com.rferic.zero27apps.data.OweCategoryDto
import com.rferic.zero27apps.data.OweMemberDto
import com.rferic.zero27apps.data.OweMovementDto
import com.rferic.zero27apps.ui.components.PrivacyEye
import com.rferic.zero27apps.ui.i18n.LocalStrings
import com.rferic.zero27apps.ui.privacy.LocalPrivacyMasked
import com.rferic.zero27apps.ui.privacy.maskedMoney
import com.rferic.zero27apps.ui.theme.LocalPalette
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

private data class CategorySlice(val name: String, val amount: Long, val color: Color)

private data class PersonRow(val name: String, val paid: Long, val consumed: Long, val net: Long)

private data class MonthBar(val month: YearMonth, val amount: Long)

/**
 * The group at a glance: the month's total, where the money went, who paid
 * versus who consumed, and the last six months. Every number goes through the
 * privacy mask; the charts keep their shape but lose the figures.
 */
@Composable
fun OweSummaryScreen(
    movements: List<OweMovementDto>,
    members: List<OweMemberDto>,
    categories: List<OweCategoryDto>,
    balances: List<OweBalanceDto>,
    settlementCount: Int,
    currency: String,
    locale: String,
    onBack: () -> Unit,
) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    val masked = LocalPrivacyMasked.current
    var tab by remember { mutableStateOf(0) }

    val month = YearMonth.now()
    val previous = month.minusMonths(1)
    fun inMonth(movement: OweMovementDto, target: YearMonth): Boolean =
        runCatching { YearMonth.from(LocalDate.parse(movement.occurredOn)) == target }.getOrDefault(false)

    val current = movements.filter { it.kind == "expense" && inMonth(it, month) }
    val past = movements.filter { it.kind == "expense" && inMonth(it, previous) }
    val total = current.sumOf { it.amountMinor }
    val previousTotal = past.sumOf { it.amountMinor }
    val delta = if (previousTotal > 0) ((total - previousTotal) * 100 / previousTotal) else null

    // Categories of this month, biggest first, with the tail grouped.
    val names = categories.associate { it.id to it.name }
    val paletteColors = listOf(
        palette.accent,
        Color(0xFF3B82F6),
        Color(0xFF8B5CF6),
        Color(0xFFF59E0B),
        Color(0xFFEC4899),
        palette.mutedForeground,
    )
    val grouped = current.groupBy { it.categoryId }.entries
        .map { (id, rows) -> (names[id] ?: strings.noCategory) to rows.sumOf { it.amountMinor } }
        .filter { it.second > 0 }
        .sortedByDescending { it.second }
    val top = grouped.take(5)
    val rest = grouped.drop(5).sumOf { it.second }
    val slices = (top + if (rest > 0) listOf(strings.category to rest) else emptyList())
        .mapIndexed { index, (name, amount) -> CategorySlice(name, amount, paletteColors[index % paletteColors.size]) }

    val byMember = members.filter { it.state == "active" || it.state == "invited" }
    val people = byMember.map { member ->
        val paid = current.filter { it.paidBy == member.id }.sumOf { it.amountMinor }
        val consumed = current.sumOf { movement ->
            movement.shares.firstOrNull { it.memberId == member.id }?.amountMinor ?: 0L
        }
        PersonRow(member.displayName, paid, consumed, balances.firstOrNull { it.memberId == member.id }?.amountMinor ?: 0L)
    }.filter { it.paid > 0 || it.consumed > 0 }

    val months = (5 downTo 0).map { back ->
        val target = month.minusMonths(back.toLong())
        MonthBar(target, movements.filter { it.kind == "expense" && inMonth(it, target) }.sumOf { it.amountMinor })
    }

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

        // Hero: the month's number, oversized, over the module's own wash.
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
            0 -> CategoryReport(slices, total, currency, locale, masked)
            1 -> PeopleReport(people, currency, locale, masked)
            else -> MonthsReport(months, currency, locale)
        }

        Spacer(Modifier.height(8.dp))
    }
}

@Composable
private fun CategoryReport(
    slices: List<CategorySlice>,
    total: Long,
    currency: String,
    locale: String,
    masked: Boolean,
) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    if (slices.isEmpty() || total == 0L) {
        EmptyCard(strings.noMovements)
        return
    }
    var progress by remember { mutableStateOf(0f) }
    LaunchedEffect(Unit) { progress = 1f }
    val sweep by animateFloatAsState(progress, tween(700), label = "donut")

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(palette.surface, RoundedCornerShape(24.dp))
            .border(1.dp, palette.border, RoundedCornerShape(24.dp))
            .padding(18.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        Box(modifier = Modifier.size(140.dp), contentAlignment = Alignment.Center) {
            Canvas(Modifier.size(140.dp)) {
                val stroke = 18.dp.toPx()
                var start = -90f
                val gap = 3f
                for (slice in slices) {
                    val angle = (slice.amount.toFloat() / total.toFloat()) * 360f
                    drawArc(
                        color = slice.color,
                        startAngle = start + gap / 2,
                        sweepAngle = (angle - gap).coerceAtLeast(1f) * sweep,
                        useCenter = false,
                        style = Stroke(width = stroke, cap = StrokeCap.Round),
                    )
                    start += angle
                }
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    maskedMoney(masked, total, currency, locale),
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                )
                Text(strings.thisMonth, fontSize = 10.sp, color = palette.mutedForeground)
            }
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            for (slice in slices) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(9.dp).background(slice.color, RoundedCornerShape(3.dp)))
                    Text(
                        slice.name,
                        modifier = Modifier.weight(1f).padding(start = 8.dp),
                        fontSize = 12.sp,
                        maxLines = 1,
                    )
                    Text(
                        maskedMoney(masked, slice.amount, currency, locale),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
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
    val strings = LocalStrings.current
    val masked = LocalPrivacyMasked.current
    val max = months.maxOfOrNull { it.amount }?.coerceAtLeast(1) ?: 1
    var progress by remember { mutableStateOf(0f) }
    LaunchedEffect(Unit) { progress = 1f }
    val grow by animateFloatAsState(progress, tween(700), label = "months")

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
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
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
