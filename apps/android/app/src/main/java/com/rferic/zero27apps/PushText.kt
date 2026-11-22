package com.rferic.zero27apps

import java.text.NumberFormat
import java.util.Currency
import java.util.Locale

/**
 * Notification copy, kept out of the service so it can be tested. The amount is
 * shown only when the user keeps amounts visible: the privacy switch lives in
 * the app, and a lock screen must not show money the owner chose to hide.
 *
 * Invitation pushes carry a `key` and, since the QA round, a `seats` count: they
 * render a localized sentence naming how many invitations are involved, with no
 * actor name and no money, instead of the amount/description composition the
 * expense pushes use.
 */
object PushText {
    fun title(module: String?): String = when (module) {
        "owe-no" -> "OweNo"
        null, "" -> "027Apps"
        else -> module.replaceFirstChar { it.uppercase() }
    }

    fun body(data: Map<String, String>, masked: Boolean, locale: String, fallback: String): String {
        when (data["key"]) {
            "push.invitation_requested" -> return invitation(locale).requested(seats(data))
            "push.invitation_request_resolved" -> {
                val copy = invitation(locale)
                return if (data["state"] == "rejected") copy.rejected else copy.approved(seats(data))
            }
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

    /** The seat count the server put in `seats`, when it is a sane one. */
    private fun seats(data: Map<String, String>): Int? =
        data["seats"]?.toIntOrNull()?.takeIf { it in 1..100 }

    /**
     * The invitation notifications' copy, one per shipped locale. The count is
     * filled in when the event carries `seats`; a push queued before the field
     * existed falls back to the generic sentence, and a rejected request never
     * names granted seats because there are none.
     */
    private data class InvitationCopy(
        val requestedMany: String,
        val requestedOne: String,
        val requestedGeneric: String,
        val approvedMany: String,
        val approvedOne: String,
        val approvedGeneric: String,
        val rejected: String,
    ) {
        fun requested(seats: Int?): String = when (seats) {
            null -> requestedGeneric
            1 -> requestedOne.replace("{count}", "1")
            else -> requestedMany.replace("{count}", seats.toString())
        }

        fun approved(seats: Int?): String = when (seats) {
            null -> approvedGeneric
            1 -> approvedOne.replace("{count}", "1")
            else -> approvedMany.replace("{count}", seats.toString())
        }
    }

    private fun invitation(locale: String): InvitationCopy =
        INVITATION[locale.substringBefore('-').lowercase()] ?: INVITATION.getValue("en")

    private val INVITATION: Map<String, InvitationCopy> = mapOf(
        "en" to InvitationCopy(
            requestedMany = "Request for {count} invitations",
            requestedOne = "Request for {count} invitation",
            requestedGeneric = "New invitation request",
            approvedMany = "Request approved · {count} seats",
            approvedOne = "Request approved · {count} seat",
            approvedGeneric = "Request approved",
            rejected = "Request rejected",
        ),
        "es" to InvitationCopy(
            requestedMany = "Solicitud de {count} invitaciones",
            requestedOne = "Solicitud de {count} invitación",
            requestedGeneric = "Nueva solicitud de invitación",
            approvedMany = "Solicitud aprobada · {count} plazas",
            approvedOne = "Solicitud aprobada · {count} plaza",
            approvedGeneric = "Solicitud aprobada",
            rejected = "Solicitud rechazada",
        ),
        "ca" to InvitationCopy(
            requestedMany = "Sol·licitud de {count} invitacions",
            requestedOne = "Sol·licitud de {count} invitació",
            requestedGeneric = "Nova sol·licitud d'invitació",
            approvedMany = "Sol·licitud aprovada · {count} places",
            approvedOne = "Sol·licitud aprovada · {count} plaça",
            approvedGeneric = "Sol·licitud aprovada",
            rejected = "Sol·licitud rebutjada",
        ),
        "gl" to InvitationCopy(
            requestedMany = "Solicitude de {count} invitacións",
            requestedOne = "Solicitude de {count} invitación",
            requestedGeneric = "Nova solicitude de invitación",
            approvedMany = "Solicitude aprobada · {count} prazas",
            approvedOne = "Solicitude aprobada · {count} praza",
            approvedGeneric = "Solicitude aprobada",
            rejected = "Solicitude rexeitada",
        ),
        "eu" to InvitationCopy(
            requestedMany = "{count} gonbidapen eskaera",
            requestedOne = "{count} gonbidapen eskaera",
            requestedGeneric = "Gonbidapen eskaera berria",
            approvedMany = "Eskaera onartua · {count} leku",
            approvedOne = "Eskaera onartua · {count} leku",
            approvedGeneric = "Eskaera onartua",
            rejected = "Eskaera baztertua",
        ),
        "pt" to InvitationCopy(
            requestedMany = "Pedido de {count} convites",
            requestedOne = "Pedido de {count} convite",
            requestedGeneric = "Novo pedido de convite",
            approvedMany = "Pedido aprovado · {count} lugares",
            approvedOne = "Pedido aprovado · {count} lugar",
            approvedGeneric = "Pedido aprovado",
            rejected = "Pedido recusado",
        ),
        "fr" to InvitationCopy(
            requestedMany = "Demande de {count} invitations",
            requestedOne = "Demande de {count} invitation",
            requestedGeneric = "Nouvelle demande d'invitation",
            approvedMany = "Demande approuvée · {count} places",
            approvedOne = "Demande approuvée · {count} place",
            approvedGeneric = "Demande approuvée",
            rejected = "Demande refusée",
        ),
        "it" to InvitationCopy(
            requestedMany = "Richiesta di {count} inviti",
            requestedOne = "Richiesta di {count} invito",
            requestedGeneric = "Nuova richiesta di invito",
            approvedMany = "Richiesta approvata · {count} posti",
            approvedOne = "Richiesta approvata · {count} posto",
            approvedGeneric = "Richiesta approvata",
            rejected = "Richiesta rifiutata",
        ),
        "de" to InvitationCopy(
            requestedMany = "Anfrage für {count} Einladungen",
            requestedOne = "Anfrage für {count} Einladung",
            requestedGeneric = "Neue Einladungsanfrage",
            approvedMany = "Anfrage genehmigt · {count} Plätze",
            approvedOne = "Anfrage genehmigt · {count} Platz",
            approvedGeneric = "Anfrage genehmigt",
            rejected = "Anfrage abgelehnt",
        ),
    )
}
