package com.rferic.zero27apps.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.provideContent
import androidx.glance.appwidget.updateAll
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.padding
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import com.rferic.zero27apps.MainActivity
import com.rferic.zero27apps.ui.i18n.AppStrings

/**
 * The OweNo home widget: your net balance and the groups that move it, painted
 * from the last snapshot so it never blocks on the network.
 */
class OweWidget : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val snapshot = WidgetSnapshotStore(context).read()
        provideContent { Content(snapshot) }
    }

    @Composable
    private fun Content(snapshot: WidgetSnapshot) {
        val strings = AppStrings.forLanguage(snapshot.locale)
        val context = androidx.glance.LocalContext.current
        // Same palette as the app: the widget never invents its own colours.
        // Resource colours carry a night variant, so the widget follows the system theme.
        val surface = ColorProvider(com.rferic.zero27apps.R.color.owe_widget_surface)
        val ink = ColorProvider(com.rferic.zero27apps.R.color.owe_widget_ink)
        val muted = ColorProvider(com.rferic.zero27apps.R.color.owe_widget_muted)
        val accent = ColorProvider(com.rferic.zero27apps.R.color.owe_widget_accent)
        val danger = ColorProvider(com.rferic.zero27apps.R.color.owe_widget_danger)

        Column(
            modifier = GlanceModifier
                .fillMaxSize()
                .background(surface)
                .padding(14.dp)
                .clickable(actionStartActivity(android.content.Intent(context, MainActivity::class.java))),
        ) {
            Row(modifier = GlanceModifier.fillMaxWidth()) {
                Text(
                    "OweNo",
                    style = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.Bold, color = ink),
                )
                Text(
                    "+",
                    modifier = GlanceModifier
                        .clickable(
                            actionStartActivity(
                                android.content.Intent(context, MainActivity::class.java)
                                    .putExtra("start", "owe_expense"),
                            ),
                        )
                        .padding(start = 10.dp, end = 4.dp),
                    style = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Bold, color = accent),
                )
            }
            val line = when {
                !snapshot.signedIn -> strings.signIn
                snapshot.netMinor > 0 -> strings.owedToYou.replace(
                    "{amount}",
                    money(snapshot.netMinor, snapshot.currency),
                )
                snapshot.netMinor < 0 -> strings.youOwe.replace(
                    "{amount}",
                    money(-snapshot.netMinor, snapshot.currency),
                )
                else -> strings.youSettled
            }
            Text(
                line,
                modifier = GlanceModifier.padding(top = 6.dp),
                style = TextStyle(
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (snapshot.netMinor < 0 && snapshot.signedIn) danger else accent,
                ),
            )
            if (snapshot.signedIn && (snapshot.owedToYouMinor > 0 || snapshot.youOweMinor > 0)) {
                Row(modifier = GlanceModifier.fillMaxWidth().padding(top = 6.dp)) {
                    if (snapshot.owedToYouMinor > 0) {
                        Text(
                            strings.owedToYou.replace("{amount}", money(snapshot.owedToYouMinor, snapshot.currency)),
                            style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Medium, color = accent),
                        )
                    }
                    if (snapshot.owedToYouMinor > 0 && snapshot.youOweMinor > 0) {
                        Text("  ·  ", style = TextStyle(fontSize = 12.sp, color = muted))
                    }
                    if (snapshot.youOweMinor > 0) {
                        Text(
                            strings.youOwe.replace("{amount}", money(snapshot.youOweMinor, snapshot.currency)),
                            style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Medium, color = danger),
                        )
                    }
                }
            }
            if (snapshot.lastDescription != null) {
                Text(
                    "${strings.lastActivity}: ${snapshot.lastDescription}",
                    modifier = GlanceModifier.padding(top = 6.dp),
                    style = TextStyle(fontSize = 11.sp, color = muted),
                )
            }
            if (snapshot.groups.isEmpty()) {
                Text(
                    if (snapshot.signedIn) strings.activityEmpty else "",
                    modifier = GlanceModifier.padding(top = 4.dp),
                    style = TextStyle(fontSize = 11.sp, color = muted),
                )
            }
            snapshot.groups.take(3).forEach { group ->
                Row(
                    modifier = GlanceModifier.fillMaxWidth().padding(top = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        group.name,
                        modifier = GlanceModifier.defaultWeight(),
                        style = TextStyle(fontSize = 12.sp, color = ink),
                    )
                    Text(
                        money(group.amountMinor, snapshot.currency),
                        style = TextStyle(
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            color = if (group.amountMinor < 0) {
                                danger
                            } else {
                                accent
                            },
                        ),
                    )
                }
            }
        }
    }

    private fun money(amountMinor: Long, currency: String): String =
        runCatching {
            java.text.NumberFormat.getCurrencyInstance().apply {
                this.currency = java.util.Currency.getInstance(currency)
            }.format(amountMinor / 100.0)
        }.getOrDefault("${amountMinor / 100.0} $currency")
}

class OweWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = OweWidget()
}
