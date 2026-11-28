package com.rferic.zero27apps

/**
 * The `start` extra a launch or push intent may carry, and where each one
 * navigates. Kept pure (no Activity) so the mapping is unit-tested: [accepted]
 * is the filter MainActivity forwards, and [targetOf] is the decision the two
 * navigation effects switch on.
 */
enum class StartTarget { INVITE, OWE_EXPENSE, OWE_GROUP, TODO_GROUP, TODO_NEW_TASK }

object StartAction {
    /** The `start` values MainActivity forwards (all five, `modules`/`settings` included). */
    val accepted: Set<String> =
        setOf("invite", "owe_expense", "owe_group", "todo_group", "todo_new_task", "modules", "settings")

    /** The navigation a recognized action triggers; null for the rest. */
    fun targetOf(action: String?): StartTarget? = when (action) {
        "invite" -> StartTarget.INVITE
        "owe_expense" -> StartTarget.OWE_EXPENSE
        "owe_group" -> StartTarget.OWE_GROUP
        "todo_group" -> StartTarget.TODO_GROUP
        "todo_new_task" -> StartTarget.TODO_NEW_TASK
        else -> null
    }
}
