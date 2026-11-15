package com.rferic.zero27apps

import java.text.NumberFormat
import java.util.Currency
import java.util.Locale

/**
 * Notification copy, kept out of the service so it can be tested. The amount is
 * shown only when the user keeps amounts visible: the privacy switch lives in
 * the app, and a lock screen must not show money the owner chose to hide.
 */
object PushText {
    fun title(module: String?): String = when (module) {
        "owe-no" -> "OweNo"
        null, "" -> "027Apps"
        else -> module.replaceFirstChar { it.uppercase() }
    }

    fun body(data: Map<String, String>, masked: Boolean, locale: String, fallback: String): String {
        val description = data["description"]?.takeIf { it.isNotBlank() }
        val group = data["group"]?.takeIf { it.isNotBlank() }
        val actor = data["actor"]?.takeIf { it.isNotBlank() }
        val amount = data["amount"]?.toLongOrNull()?.takeIf { !masked }

        val head = listOfNotNull(description, group).joinToString(" · ")
            .ifBlank { fallback }
        val parts = mutableListOf(head)
        if (actor != null) parts += actor
        if (amount != null) {
            val currency = data["currency"]?.takeIf { it.isNotBlank() } ?: "EUR"
            parts += money(amount, currency, locale)
        }
        return parts.joinToString(" · ").take(200)
    }

    private fun money(amountMinor: Long, currency: String, locale: String): String =
        runCatching {
            NumberFormat.getCurrencyInstance(Locale.forLanguageTag(locale)).apply {
                this.currency = Currency.getInstance(currency)
            }.format(amountMinor / 100.0)
        }.getOrDefault("${amountMinor / 100.0} $currency")
}
