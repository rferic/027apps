package com.rferic.zero27apps

import java.text.NumberFormat
import java.util.Currency
import java.util.Locale

/**
 * Notification copy, kept out of the service so it can be tested. The amount is
 * shown only when the user keeps amounts visible: the privacy switch lives in
 * the app, and a lock screen must not show money the owner chose to hide.
 *
 * Invitation pushes carry a `key` and no money: they render as a fixed,
 * localized sentence with no actor name and no seat count, instead of the
 * amount/description composition the expense pushes use.
 */
object PushText {
    fun title(module: String?): String = when (module) {
        "owe-no" -> "OweNo"
        null, "" -> "027Apps"
        else -> module.replaceFirstChar { it.uppercase() }
    }

    fun body(data: Map<String, String>, masked: Boolean, locale: String, fallback: String): String {
        when (data["key"]) {
            "push.invitation_requested" -> return invitation(locale).requested
            "push.invitation_request_resolved" ->
                return if (data["state"] == "rejected") invitation(locale).rejected else invitation(locale).approved
        }
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

    /** The two invitation notifications' copy, one per shipped locale. */
    private data class InvitationCopy(
        val requested: String,
        val approved: String,
        val rejected: String,
    )

    private fun invitation(locale: String): InvitationCopy =
        INVITATION[locale.substringBefore('-').lowercase()] ?: INVITATION.getValue("en")

    private val INVITATION: Map<String, InvitationCopy> = mapOf(
        "en" to InvitationCopy("New invitation request", "Request approved", "Request rejected"),
        "es" to InvitationCopy("Nueva solicitud de invitación", "Solicitud aprobada", "Solicitud rechazada"),
        "ca" to InvitationCopy("Nova sol·licitud d'invitació", "Sol·licitud aprovada", "Sol·licitud rebutjada"),
        "gl" to InvitationCopy("Nova solicitude de invitación", "Solicitude aprobada", "Solicitude rexeitada"),
        "eu" to InvitationCopy("Gonbidapen eskaera berria", "Eskaera onartua", "Eskaera baztertua"),
        "pt" to InvitationCopy("Novo pedido de convite", "Pedido aprovado", "Pedido recusado"),
        "fr" to InvitationCopy("Nouvelle demande d'invitation", "Demande approuvée", "Demande refusée"),
        "it" to InvitationCopy("Nuova richiesta di invito", "Richiesta approvata", "Richiesta rifiutata"),
        "de" to InvitationCopy("Neue Einladungsanfrage", "Anfrage genehmigt", "Anfrage abgelehnt"),
    )
}
