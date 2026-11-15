package com.rferic.zero27apps

/**
 * What changed in each build, shown in Ajustes. It ships with the app so it also
 * works offline; the language falls back to English when a translation is missing.
 */
data class ChangelogEntry(
    val version: String,
    val date: String,
    val notes: Map<String, List<String>>,
)

object Changelog {
    val entries: List<ChangelogEntry> = listOf(
        ChangelogEntry(
            version = "0.16.0",
            date = "2026-11-15",
            notes = mapOf(
                "es" to listOf(
                    "Edita o elimina un movimiento tocándolo en Actividad.",
                    "Liquida con una persona concreta o todas las cuentas de golpe (creador).",
                    "Botones de liquidar que se ven como botones.",
                ),
                "en" to listOf(
                    "Edit or delete a movement by tapping it in Activity.",
                    "Settle with one person or every balance at once (creator).",
                    "Settle actions that look like buttons.",
                ),
            ),
        ),
        ChangelogEntry(
            version = "0.15.0",
            date = "2026-11-15",
            notes = mapOf(
                "es" to listOf(
                    "Resumen del grupo con gráficos: categorías, personas y evolución mensual.",
                    "Gráficos animados que respetan el modo privado.",
                ),
                "en" to listOf(
                    "Group summary with charts: categories, people and monthly evolution.",
                    "Animated charts that respect privacy mode.",
                ),
            ),
        ),
        ChangelogEntry(
            version = "0.14.0",
            date = "2026-11-15",
            notes = mapOf(
                "es" to listOf(
                    "Categorías propias: crear, renombrar y archivar sin perder el histórico.",
                    "Categorías por defecto al crear un grupo, en tu idioma.",
                ),
                "en" to listOf(
                    "Your own categories: create, rename and archive without losing history.",
                    "Default categories on a new group, in your language.",
                ),
            ),
        ),
        ChangelogEntry(
            version = "0.13.0",
            date = "2026-11-15",
            notes = mapOf(
                "es" to listOf(
                    "Modo privado con el ojo: oculta solo los importes en toda la app.",
                    "La elección se recuerda y el widget la respeta.",
                ),
                "en" to listOf(
                    "Privacy eye: hides amounts only, across the app.",
                    "The choice is remembered and the widget follows it.",
                ),
            ),
        ),
        ChangelogEntry(
            version = "0.12.0",
            date = "2026-11-15",
            notes = mapOf(
                "es" to listOf(
                    "Los cambios de otra persona aparecen sin recargar.",
                    "Push con contexto y sin importes cuando el ojo está cerrado.",
                ),
                "en" to listOf(
                    "Changes from other people appear without reloading.",
                    "Push with context and no amounts while amounts are hidden.",
                ),
            ),
        ),
        ChangelogEntry(
            version = "0.11.0",
            date = "2026-11-15",
            notes = mapOf(
                "es" to listOf(
                    "Cada módulo con su color, su logo y su degradado.",
                    "Inicio renovado: widgets de OweNo con totales, grupos y última actividad.",
                    "Selector de grupo al añadir un gasto desde el botón +.",
                ),
                "en" to listOf(
                    "Each module with its own colour, logo and wash.",
                    "New home: OweNo widgets with totals, groups and latest activity.",
                    "Group picker when adding an expense from the + button.",
                ),
            ),
        ),
    )

    fun notesFor(entry: ChangelogEntry, locale: String): List<String> =
        entry.notes[locale.substringBefore('-')] ?: entry.notes["en"] ?: emptyList()
}
