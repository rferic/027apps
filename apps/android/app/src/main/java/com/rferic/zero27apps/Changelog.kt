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
            version = "0.17.1",
            date = "2026-11-16",
            notes = mapOf(
                "es" to listOf(
                    "La lista de movimientos de un grupo carga de 50 en 50 con «Cargar más»: los grupos importados de Splitwise ya no tardan en abrir.",
                ),
                "en" to listOf(
                    "A group's movement list loads 50 at a time with «Load more»: groups imported from Splitwise open fast again.",
                ),
            ),
        ),
        ChangelogEntry(
            version = "0.17.0",
            date = "2026-11-16",
            notes = mapOf(
                "es" to listOf(
                    "Primera versión firmada: la app ya se instala como cualquier otra y se actualiza sin builds de pruebas.",
                    "Si venías de la compilación de pruebas, hay que desinstalarla una vez: Android no acepta cambiar de firma encima.",
                ),
                "en" to listOf(
                    "First signed build: the app installs like any other and updates without testing builds.",
                    "Coming from the testing build? Uninstall it once: Android does not accept a different signature on top.",
                ),
            ),
        ),
        ChangelogEntry(
            version = "0.16.9",
            date = "2026-11-15",
            notes = mapOf(
                "es" to listOf(
                    "Al cerrar sesión o cambiar de instancia, el móvil deja de recibir notificaciones y el widget se vacía.",
                    "Cada notificación abre su propio grupo.",
                    "El modo privado ya no deja escapar importes en el plan de pagos ni al quitar a alguien con saldo.",
                    "Las actualizaciones no se instalan sin comprobar el SHA-256 del APK.",
                    "El importador acepta archivos de hasta 2 MB y no bloquea la app mientras los lee.",
                    "Si tienes grupos en varias monedas, el widget y el inicio muestran una línea por moneda en vez de sumarlas.",
                ),
                "en" to listOf(
                    "Signing out or switching instance stops the notifications on this phone and clears the widget.",
                    "Each notification opens its own group.",
                    "Private mode no longer leaks amounts in the payment plan or when removing a member with a balance.",
                    "Updates are not installed unless the APK's SHA-256 matches the published one.",
                    "The importer takes files up to 2 MB and no longer blocks the app while reading them.",
                    "With groups in several currencies, the widget and the home card show one line per currency instead of adding them up.",
                ),
            ),
        ),
        ChangelogEntry(
            version = "0.16.8",
            date = "2026-11-15",
            notes = mapOf(
                "es" to listOf(
                    "Ajustes muestra si este dispositivo recibe notificaciones, con el motivo exacto si falla y un botón para reintentar.",
                ),
                "en" to listOf(
                    "Settings shows whether this device receives notifications, the exact reason when it fails, and a retry button.",
                ),
            ),
        ),
        ChangelogEntry(
            version = "0.16.7",
            date = "2026-11-15",
            notes = mapOf(
                "es" to listOf(
                    "La app se lee bien con el texto al 200 %: pestañas deslizables y tarjetas que no se rompen.",
                    "La actualización se verifica con el SHA-256 del APK publicado.",
                ),
                "en" to listOf(
                    "The app holds up at 200 % text size: scrollable tabs and cards that no longer break.",
                    "Updates are verified against the published APK's SHA-256.",
                ),
            ),
        ),
        ChangelogEntry(
            version = "0.16.6",
            date = "2026-11-15",
            notes = mapOf(
                "es" to listOf("El widget se adapta al tamaño: saldo, totales o grupos y última actividad."),
                "en" to listOf("The widget adapts to its size: balance, totals, or groups and latest activity."),
            ),
        ),
        ChangelogEntry(
            version = "0.16.5",
            date = "2026-11-15",
            notes = mapOf(
                "es" to listOf("Los logos de los módulos aparecen al instante: se precargan y se cachean."),
                "en" to listOf("Module logos appear instantly: they are prefetched and cached."),
            ),
        ),
        ChangelogEntry(
            version = "0.16.4",
            date = "2026-11-15",
            notes = mapOf(
                "es" to listOf("La actualización se descarga también desde una instancia local (HTTP) en pruebas."),
                "en" to listOf("Updates also download from a local HTTP instance in test builds."),
            ),
        ),
        ChangelogEntry(
            version = "0.16.3",
            date = "2026-11-15",
            notes = mapOf(
                "es" to listOf(
                    "El aviso de nueva versión aparece al abrir, en cualquier pantalla.",
                    "Ajustes ya no repite el título.",
                ),
                "en" to listOf(
                    "The new-version banner appears on launch, on any screen.",
                    "Settings no longer repeats its title.",
                ),
            ),
        ),
        ChangelogEntry(
            version = "0.16.2",
            date = "2026-11-15",
            notes = mapOf(
                "es" to listOf("La tarjeta de versión ya no se rompe en varias líneas."),
                "en" to listOf("The version card no longer wraps into ragged lines."),
            ),
        ),
        ChangelogEntry(
            version = "0.16.1",
            date = "2026-11-15",
            notes = mapOf(
                "es" to listOf(
                    "La app vuelve a la última página que viste al abrirla; dentro de un módulo, siempre a su portada.",
                    "Comprueba actualizaciones al abrir y avisa con una franja en cualquier pantalla.",
                    "Ya no puedes relanzar la comprobación de actualizaciones justo después de hacerla.",
                ),
                "en" to listOf(
                    "The app reopens on the last page you saw; inside a module, always at its root.",
                    "Checks for updates on launch and shows a banner on any screen.",
                    "You can no longer re-run the update check right after checking.",
                ),
            ),
        ),
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
