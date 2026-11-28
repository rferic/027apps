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
        "todo" -> "NotNow"
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
        // NotNow pushes name the task, the group and who acted, in the phone's
        // language: one sentence per event, never an id.
        if (data["key"]?.startsWith("push.todo_") == true) {
            return todo(data, locale)
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

    /**
     * The NotNow sentence for one event. `{actor}`, `{title}` and `{group}` are
     * filled in when the event carries them; a push from before a field existed
     * simply drops that part instead of showing a placeholder.
     */
    private fun todo(data: Map<String, String>, locale: String): String {
        val copy = TODO[locale.substringBefore('-').lowercase()] ?: TODO.getValue("en")
        val title = data["description"]?.takeIf { it.isNotBlank() }
        val actor = data["actor"]?.takeIf { it.isNotBlank() }
        val group = data["group"]?.takeIf { it.isNotBlank() }
        val template = when (data["key"]) {
            "push.todo_task_created" -> copy.created
            "push.todo_task_created_assigned",
            "push.todo_task_assigned",
            -> copy.assigned
            "push.todo_task_released" -> copy.released
            "push.todo_task_completed" -> copy.completed
            "push.todo_task_overdue",
            "push.todo_task_overdue_assigned",
            -> copy.overdue
            "push.todo_task_missed_period",
            "push.todo_task_missed_period_assigned",
            -> copy.missed
            "push.todo_request_created" -> copy.request
            "push.todo_request_resolved" ->
                if (data["state"] == "accepted") copy.accepted else copy.denied
            "push.todo_season_closed" -> copy.season
            else -> copy.created
        }
        return template
            .replace("{title}", title ?: "")
            .replace("{actor}", actor ?: "")
            .replace("{group}", group ?: "")
            // A missing part leaves a double separator or a dangling sign.
            .replace(Regex("\\s*·\\s*(·|$)"), "")
            .replace(Regex("«\\s*»"), "")
            .trim()
            .take(200)
    }

    private data class TodoCopy(
        val created: String,
        val assigned: String,
        val released: String,
        val completed: String,
        val overdue: String,
        val missed: String,
        val request: String,
        val accepted: String,
        val denied: String,
        val season: String,
    )

    private val TODO: Map<String, TodoCopy> = mapOf(
        "en" to TodoCopy(
            created = "{actor} added «{title}» · {group}",
            assigned = "{actor} gave you «{title}»",
            released = "{actor} released «{title}»",
            completed = "{actor} finished «{title}» · {group}",
            overdue = "«{title}» is overdue · {group}",
            missed = "«{title}» was left undone · {group}",
            request = "{actor} asks for «{title}»",
            accepted = "You got «{title}»",
            denied = "«{title}» stays with its holder",
            season = "Season closed · {group}",
        ),
        "es" to TodoCopy(
            created = "{actor} añadió «{title}» · {group}",
            assigned = "{actor} te dio «{title}»",
            released = "{actor} soltó «{title}»",
            completed = "{actor} terminó «{title}» · {group}",
            overdue = "«{title}» está vencida · {group}",
            missed = "«{title}» quedó sin hacer · {group}",
            request = "{actor} pide «{title}»",
            accepted = "Ya es tuya «{title}»",
            denied = "«{title}» sigue con quien la tenía",
            season = "Temporada cerrada · {group}",
        ),
        "ca" to TodoCopy(
            created = "{actor} ha afegit «{title}» · {group}",
            assigned = "{actor} t'ha donat «{title}»",
            released = "{actor} ha deixat anar «{title}»",
            completed = "{actor} ha acabat «{title}» · {group}",
            overdue = "«{title}» està vençuda · {group}",
            missed = "«{title}» s'ha quedat sense fer · {group}",
            request = "{actor} demana «{title}»",
            accepted = "Ja és teva «{title}»",
            denied = "«{title}» segueix amb qui la tenia",
            season = "Temporada tancada · {group}",
        ),
        "it" to TodoCopy(
            created = "{actor} ha aggiunto «{title}» · {group}",
            assigned = "{actor} ti ha dato «{title}»",
            released = "{actor} ha lasciato «{title}»",
            completed = "{actor} ha finito «{title}» · {group}",
            overdue = "«{title}» è scaduta · {group}",
            missed = "«{title}» è rimasta da fare · {group}",
            request = "{actor} chiede «{title}»",
            accepted = "Ora è tua «{title}»",
            denied = "«{title}» resta a chi la aveva",
            season = "Stagione chiusa · {group}",
        ),
        "fr" to TodoCopy(
            created = "{actor} a ajouté «{title}» · {group}",
            assigned = "{actor} t'a donné «{title}»",
            released = "{actor} a lâché «{title}»",
            completed = "{actor} a terminé «{title}» · {group}",
            overdue = "«{title}» est en retard · {group}",
            missed = "«{title}» est restée à faire · {group}",
            request = "{actor} demande «{title}»",
            accepted = "Elle est à toi «{title}»",
            denied = "«{title}» reste à son détenteur",
            season = "Saison clôturée · {group}",
        ),
        "de" to TodoCopy(
            created = "{actor} hat «{title}» hinzugefügt · {group}",
            assigned = "{actor} hat dir «{title}» gegeben",
            released = "{actor} hat «{title}» freigegeben",
            completed = "{actor} hat «{title}» erledigt · {group}",
            overdue = "«{title}» ist überfällig · {group}",
            missed = "«{title}» blieb unerledigt · {group}",
            request = "{actor} fragt nach «{title}»",
            accepted = "«{title}» gehört jetzt dir",
            denied = "«{title}» bleibt bei der bisherigen Person",
            season = "Saison geschlossen · {group}",
        ),
        "pt" to TodoCopy(
            created = "{actor} adicionou «{title}» · {group}",
            assigned = "{actor} deu-te «{title}»",
            released = "{actor} libertou «{title}»",
            completed = "{actor} terminou «{title}» · {group}",
            overdue = "«{title}» está vencida · {group}",
            missed = "«{title}» ficou por fazer · {group}",
            request = "{actor} pede «{title}»",
            accepted = "Já é tua «{title}»",
            denied = "«{title}» fica com quem a tinha",
            season = "Temporada fechada · {group}",
        ),
        "gl" to TodoCopy(
            created = "{actor} engadiu «{title}» · {group}",
            assigned = "{actor} deuche «{title}»",
            released = "{actor} soltou «{title}»",
            completed = "{actor} rematou «{title}» · {group}",
            overdue = "«{title}» está vencida · {group}",
            missed = "«{title}» quedou sen facer · {group}",
            request = "{actor} pide «{title}»",
            accepted = "Xa é túa «{title}»",
            denied = "«{title}» segue con quen a tiña",
            season = "Tempada pechada · {group}",
        ),
        "eu" to TodoCopy(
            created = "{actor}(e)k «{title}» gehitu du · {group}",
            assigned = "{actor}(e)k «{title}» eman dizu",
            released = "{actor}(e)k «{title}» askatu du",
            completed = "{actor}(e)k «{title}» amaitu du · {group}",
            overdue = "«{title}» iraungita dago · {group}",
            missed = "«{title}» egiteke geratu da · {group}",
            request = "{actor}(e)k «{title}» eskatzen du",
            accepted = "«{title}» zurea da orain",
            denied = "«{title}» duenarekin jarraitzen du",
            season = "Denboraldia itxita · {group}",
        ),
    )

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
