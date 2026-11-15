package com.rferic.zero27apps.ui.privacy

import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.material3.Text
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.sp
import com.rferic.zero27apps.ui.i18n.LocalStrings

/** Whether the app masks amounts right now (the eye in the header). */
val LocalPrivacyMasked = staticCompositionLocalOf { false }

private const val MASK = "•••"

/**
 * Money as the user sees it. When privacy is on the amount is masked **and** its
 * real value never reaches the semantics tree, so a screen reader cannot read it.
 */
fun maskedMoney(masked: Boolean, amountMinor: Long, currency: String, locale: String): String =
    if (masked) "$MASK ${currencySymbol(currency)}" else formatMoney(amountMinor, currency, locale)

/** "EUR" -> "€", so a masked amount still reads as money, not as a code. */
fun currencySymbol(currency: String): String = when (currency.uppercase()) {
    "EUR" -> "€"
    "USD" -> "$"
    "GBP" -> "£"
    else -> currency.uppercase()
}

fun formatMoney(amountMinor: Long, currency: String, locale: String): String =
    runCatching {
        java.text.NumberFormat.getCurrencyInstance(java.util.Locale.forLanguageTag(locale)).apply {
            this.currency = java.util.Currency.getInstance(currency)
        }.format(amountMinor / 100.0)
    }.getOrDefault("${amountMinor / 100.0} $currency")

/** The only way a read-only screen prints money, so the mask cannot be bypassed. */
@Composable
fun Amount(
    amountMinor: Long,
    currency: String,
    locale: String,
    style: TextStyle = TextStyle(fontSize = 13.sp),
    color: androidx.compose.ui.graphics.Color = androidx.compose.ui.graphics.Color.Unspecified,
    modifier: Modifier = Modifier,
) {
    val masked = LocalPrivacyMasked.current
    val strings = LocalStrings.current
    Text(
        maskedMoney(masked, amountMinor, currency, locale),
        style = if (color == androidx.compose.ui.graphics.Color.Unspecified) style else style.copy(color = color),
        modifier = if (masked) {
            modifier.semantics { contentDescription = strings.amountHidden }
        } else {
            modifier
        },
    )
}

/** Signed impact ("+10,00 €" / "−4,00 €"), masked as a whole when privacy is on. */
@Composable
fun SignedAmount(
    amountMinor: Long,
    currency: String,
    locale: String,
    style: TextStyle = TextStyle(fontSize = 13.sp),
    color: androidx.compose.ui.graphics.Color = androidx.compose.ui.graphics.Color.Unspecified,
    modifier: Modifier = Modifier,
) {
    val masked = LocalPrivacyMasked.current
    val strings = LocalStrings.current
    val sign = if (amountMinor >= 0) "+" else "−"
    Text(
        if (masked) "$MASK ${currencySymbol(currency)}" else sign + formatMoney(if (amountMinor < 0) -amountMinor else amountMinor, currency, locale),
        style = if (color == androidx.compose.ui.graphics.Color.Unspecified) style else style.copy(color = color),
        modifier = if (masked) {
            modifier.semantics { contentDescription = strings.amountHidden }
        } else {
            modifier
        },
    )
}
