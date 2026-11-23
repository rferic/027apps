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
    /**
     * The locales the product ships. A build's own entry must carry all of them:
     * older entries stay in the two languages they were written in, and the
     * screen falls back to English for those.
     */
    val shippedLocales: List<String> =
        listOf("en", "es", "ca", "gl", "eu", "pt", "fr", "it", "de")

    val entries: List<ChangelogEntry> = listOf(
        ChangelogEntry(
            version = "0.21.0",
            date = "2026-11-23",
            notes = mapOf(
                "es" to listOf(
                    "Importar un CSV ya no crea miembros hasta que confirmas, así que cancelar deja el grupo como estaba.",
                    "Dos importaciones a la vez ya no pueden duplicar gastos.",
                ),
                "en" to listOf(
                    "Importing a CSV no longer creates members until you confirm, so cancelling leaves the group as it was.",
                    "Two imports at once can no longer duplicate expenses.",
                ),
                "ca" to listOf(
                    "Importar un CSV ja no crea membres fins que confirmes, així que cancel·lar deixa el grup com estava.",
                    "Dues importacions alhora ja no poden duplicar despeses.",
                ),
                "gl" to listOf(
                    "Importar un CSV xa non crea membros ata que confirmas, así que cancelar deixa o grupo como estaba.",
                    "Dúas importacións á vez xa non poden duplicar gastos.",
                ),
                "eu" to listOf(
                    "CSV bat inportatzean ez du kiderik sortzen berresten duzun arte, beraz, bertan behera uzteak taldea bezala uzten du.",
                    "Aldi berean egindako bi inportaziok ezin dituzte gastuak bikoiztu.",
                ),
                "pt" to listOf(
                    "Importar um CSV já não cria membros até confirmares, por isso cancelar deixa o grupo como estava.",
                    "Duas importações ao mesmo tempo já não podem duplicar despesas.",
                ),
                "fr" to listOf(
                    "Importer un CSV ne crée plus de membres avant ta confirmation : annuler laisse le groupe tel quel.",
                    "Deux imports simultanés ne peuvent plus dupliquer de dépenses.",
                ),
                "it" to listOf(
                    "Importare un CSV non crea più membri prima della conferma, quindi annullare lascia il gruppo com'era.",
                    "Due importazioni contemporanee non possono più duplicare le spese.",
                ),
                "de" to listOf(
                    "Beim Importieren einer CSV werden Mitglieder erst nach dem Bestätigen angelegt; Abbrechen lässt die Gruppe unverändert.",
                    "Zwei gleichzeitige Importe können Ausgaben nicht mehr doppeln.",
                ),
            ),
        ),
        ChangelogEntry(
            version = "0.20.0",
            date = "2026-11-19",
            notes = mapOf(
                "es" to listOf(
                    "Invita desde la app: ve tu cuota, enseña un QR que se renueva solo o copia un enlace, y pide plazas al administrador si se te acaban.",
                    "Los administradores ven las solicitudes pendientes en la app y las gestionan en el panel.",
                    "Una notificación avisa al administrador de cada solicitud de plazas y a ti de la decisión; al escanear el QR de un socio, la invitación se abre en la app.",
                ),
                "en" to listOf(
                    "Invite from the app: see your quota, show a self-renewing QR or copy a link, and ask the administrator for seats when you run out.",
                    "Administrators see the pending requests in the app and manage them in the panel.",
                    "A push tells an administrator about a new seat request and the member about the decision; scanning a join QR opens the invitation in the app.",
                ),
                "ca" to listOf(
                    "Convida des de l'app: mira la teva quota, ensenya un QR que es renova sol o copia un enllaç i demana places a l'administrador si se t'acaben.",
                    "Els administradors veuen les sol·licituds pendents a l'app i les gestionen al panell.",
                    "Una notificació avisa l'administrador de cada sol·licitud de places i a tu de la decisió; en escanejar el QR d'un soci, la invitació s'obre a l'app.",
                ),
                "gl" to listOf(
                    "Convida desde a app: mira a túa cota, ensina un QR que se renova só ou copia unha ligazón e pide prazas ao administrador se se che acaban.",
                    "Os administradores ven as solicitudes pendentes na app e xestiónanas no panel.",
                    "Unha notificación avisa ao administrador de cada solicitude de prazas e a ti da decisión; ao escanear o QR dun socio, a invitación ábrese na app.",
                ),
                "eu" to listOf(
                    "Gonbidatu appetik: ikusi zure kuota, erakutsi bere kabuz berritzen den QR-a edo kopiatu esteka bat, eta eskatu tokiak administratzaileari agortzen zaizkizunean.",
                    "Administratzaileek eskaera zainak ikusten dituzte appean eta panelean kudeatzen dituzte.",
                    "Jakinarazpen batek administratzaileari abisatzen dio plaza-eskaera bakoitzaz eta zuri erabakiaz; bazkide baten QR-a eskaneatuta, gonbidapena appean irekitzen da.",
                ),
                "pt" to listOf(
                    "Convida a partir da app: vê a tua quota, mostra um QR que se renova sozinho ou copia uma ligação e pede lugares ao administrador quando se esgotarem.",
                    "Os administradores veem os pedidos pendentes na app e gerem-nos no painel.",
                    "Uma notificação avisa o administrador de cada pedido de lugares e a ti da decisão; ao digitalizar o QR de um sócio, o convite abre-se na app.",
                ),
                "fr" to listOf(
                    "Invitez depuis l'app : voyez votre quota, montrez un QR qui se renouvelle seul ou copiez un lien, et demandez des places à l'administrateur quand vous n'en avez plus.",
                    "Les administrateurs voient les demandes en attente dans l'app et les gèrent dans le panneau.",
                    "Une notification prévient l'administrateur de chaque demande de places et vous de la décision ; en scannant le QR d'un membre, l'invitation s'ouvre dans l'app.",
                ),
                "it" to listOf(
                    "Invita dall'app: guarda la tua quota, mostra un QR che si rinnova da solo o copia un link e chiedi posti all'amministratore quando finiscono.",
                    "Gli amministratori vedono le richieste in sospeso nell'app e le gestiscono nel pannello.",
                    "Una notifica avvisa l'amministratore di ogni richiesta di posti e te della decisione; scansionando il QR di un socio, l'invito si apre nell'app.",
                ),
                "de" to listOf(
                    "Lade direkt aus der App ein: sieh dein Kontingent, zeige einen QR, der sich selbst erneuert, oder kopiere einen Link und bitte den Administrator um Plätze, wenn sie ausgehen.",
                    "Administratoren sehen die ausstehenden Anfragen in der App und verwalten sie im Panel.",
                    "Eine Benachrichtigung meldet dem Administrator jede Platzanfrage und dir die Entscheidung; scannt man den QR eines Mitglieds, öffnet sich die Einladung in der App.",
                ),
            ),
        ),
        ChangelogEntry(
            version = "0.19.0",
            date = "2026-11-17",
            notes = mapOf(
                "es" to listOf(
                    "Acepta una invitación desde la app, también si ya tenías cuenta: entras con tu contraseña y no se crea otra.",
                    "La invitación dice qué grupo y qué papel te dan, y cuándo caduca; si expira, se renueva desde el panel sin perder el enlace.",
                    "Recupera tu contraseña desde la pantalla de entrada: te llega un enlace por correo y vuelves a la app.",
                    "Mueve tu cuenta a un teléfono nuevo con un QR: el viejo lo muestra, el nuevo lo escanea y el viejo queda fuera.",
                    "La sesión sigue abierta al cerrar la app y te avisa si el administrador la revoca.",
                    "Todo en los nueve idiomas del producto.",
                ),
                "en" to listOf(
                    "Accept an invitation from the app, even if you already had an account: you sign in with your password and no duplicate is created.",
                    "The invitation says which group and role it grants, and when it expires; if it does, the panel renews it without losing the link.",
                    "Recover your password from the sign-in screen: a link arrives by email and brings you back to the app.",
                    "Move your account to a new phone with a QR: the old one shows it, the new one scans it and the old one is signed out.",
                    "The session survives closing the app and warns you if an administrator revokes it.",
                    "All of it in the nine languages the product supports.",
                ),
                "ca" to listOf(
                    "Accepta una invitació des de l'app, també si ja tenies compte: hi entres amb la teva contrasenya i no se'n crea cap altra.",
                    "La invitació diu quin grup i quin paper et donen, i quan caduca; si expira, es renova des del panell sense perdre l'enllaç.",
                    "Recupera la contrasenya des de la pantalla d'entrada: et arriba un enllaç per correu i tornes a l'app.",
                    "Mou el compte a un telèfon nou amb un QR: el vell el mostra, el nou l'escaneja i el vell queda fora.",
                    "La sessió continua oberta en tancar l'app i t'avisa si l'administrador la revoca.",
                    "Tot en els nou idiomes del producte.",
                ),
                "gl" to listOf(
                    "Acepta unha invitación desde a app, tamén se xa tiñas conta: entras coa túa contrasinal e non se crea outra.",
                    "A invitación di que grupo e que papel che dan, e cando caduca; se expira, renovase desde o panel sen perder a ligazón.",
                    "Recupera o teu contrasinal desde a pantalla de entrada: chégache unha ligazón por correo e volves á app.",
                    "Move a túa conta a un teléfono novo cun QR: o vello móstrano, o novo escanéao e o vello queda fóra.",
                    "A sesión segue aberta ao pechar a app e avísache se o administrador a revoga.",
                    "Todo nos nove idiomas do produto.",
                ),
                "eu" to listOf(
                    "Onartu gonbidapena appetik, kontua bazenuen ere: zure pasahitzarekin sartzen zara eta ez da beste bat sortzen.",
                    "Gonbidapenak esaten du zein talde eta zein rol ematen dizkizuten, eta noiz iraungitzen den; iraungitzen bada, paneletik berritzen da esteka galdu gabe.",
                    "Berreskuratu pasahitza sarrerako pantailatik: esteka bat iristen zaizu posta elektronikoz eta appera itzultzen zara.",
                    "Mugitu kontua telefono berri batera QR batekin: zaharrak erakusten du, berriak eskaneatzen du eta zaharra kanpora geratzen da.",
                    "Saioa irekita jarraitzen du appa ixten duzunean, eta administratzaileak baliogabetzen badu abisatzen dizu.",
                    "Guztia produktuaren bederatzi hizkuntzetan.",
                ),
                "pt" to listOf(
                    "Aceita um convite a partir da app, mesmo que já tivesses conta: entras com a tua palavra-passe e não se cria outra.",
                    "O convite diz que grupo e que papel te dão, e quando expira; se expirar, renova-se no painel sem perder a ligação.",
                    "Recupera a palavra-passe no ecrã de entrada: recebes uma ligação por email e voltas à app.",
                    "Move a conta para um telemóvel novo com um QR: o antigo mostra-o, o novo digitaliza-o e o antigo fica de fora.",
                    "A sessão continua aberta ao fechar a app e avisa-te se o administrador a revogar.",
                    "Tudo nos nove idiomas do produto.",
                ),
                "fr" to listOf(
                    "Acceptez une invitation depuis l'app, même si vous aviez déjà un compte : vous entrez avec votre mot de passe et aucun doublon n'est créé.",
                    "L'invitation indique le groupe et le rôle accordés, et sa date d'expiration ; si elle expire, le panneau la renouvelle sans perdre le lien.",
                    "Récupérez votre mot de passe depuis l'écran de connexion : un lien arrive par courriel et vous ramène dans l'app.",
                    "Déplacez votre compte vers un nouveau téléphone avec un QR : l'ancien l'affiche, le nouveau le scanne et l'ancien est déconnecté.",
                    "La session reste ouverte quand vous fermez l'app et vous prévient si un administrateur la révoque.",
                    "Le tout dans les neuf langues du produit.",
                ),
                "it" to listOf(
                    "Accetta un invito dall'app, anche se avevi già un account: entri con la tua password e non ne viene creato un altro.",
                    "L'invito dice quale gruppo e quale ruolo ti danno, e quando scade; se scade, il pannello lo rinnova senza perdere il link.",
                    "Recupera la password dalla schermata di accesso: ricevi un link via email e torni all'app.",
                    "Sposta l'account su un telefono nuovo con un QR: il vecchio lo mostra, il nuovo lo scansiona e il vecchio resta fuori.",
                    "La sessione resta aperta quando chiudi l'app e ti avvisa se un amministratore la revoca.",
                    "Tutto nelle nove lingue del prodotto.",
                ),
                "de" to listOf(
                    "Nimm eine Einladung direkt in der App an, auch wenn du schon ein Konto hattest: du meldest dich mit deinem Passwort an und es wird kein zweites angelegt.",
                    "Die Einladung nennt Gruppe und Rolle und wann sie abläuft; läuft sie ab, verlängert das Panel sie, ohne den Link zu verlieren.",
                    "Setze dein Passwort über den Anmeldebildschirm zurück: Du bekommst einen Link per E-Mail und landest wieder in der App.",
                    "Zieh dein Konto mit einem QR-Code auf ein neues Telefon um: das alte zeigt ihn, das neue scannt ihn und das alte wird abgemeldet.",
                    "Die Sitzung bleibt beim Schließen der App bestehen und meldet sich, wenn ein Administrator sie entzieht.",
                    "Alles in den neun Sprachen des Produkts.",
                ),
            ),
        ),
        ChangelogEntry(
            version = "0.18.2",
            date = "2026-11-16",
            notes = mapOf(
                "es" to listOf(
                    "Al crear o editar un gasto, la categoría se elige en una lista vertical: se acabó arrastrar de lado una fila de etiquetas.",
                    "El selector tiene buscador: escribe unas letras y la lista se reduce, sin distinguir mayúsculas ni acentos. Si no existe, «+ Nueva» la crea con ese nombre.",
                    "El lápiz de cada categoría del selector permite renombrarla o archivarla sin salir del gasto.",
                ),
                "en" to listOf(
                    "When adding or editing an expense, the category is chosen from a vertical list: no more dragging a row of chips sideways.",
                    "The picker has a search box: type a few letters and the list narrows, ignoring case and accents. If it does not exist, \"+ New\" creates it with that name.",
                    "The pencil on each category in the picker renames or archives it without leaving the expense.",
                ),
            ),
        ),
        ChangelogEntry(
            version = "0.18.1",
            date = "2026-11-16",
            notes = mapOf(
                "es" to listOf(
                    "Los porcentajes del resumen se redondean igual que en el panel: el mismo gasto muestra el mismo porcentaje en la app y en la web.",
                ),
                "en" to listOf(
                    "Summary percentages round like the panel: the same expense shows the same percentage in the app and on the web.",
                ),
            ),
        ),
        ChangelogEntry(
            version = "0.18.0",
            date = "2026-11-16",
            notes = mapOf(
                "es" to listOf(
                    "El resumen del grupo ya no se queda solo con los primeros movimientos: totales, personas y evolución salen de todos los datos.",
                    "Resumen por categoría con todas las categorías, en el mes o en todo el histórico, con su porcentaje.",
                    "El importador de Splitwise deja asignar un nombre del CSV a alguien que ya está en el grupo, sin crear otra persona.",
                ),
                "en" to listOf(
                    "The group summary no longer stops at the first movements: totals, people and evolution use every row.",
                    "Category summary with every category, for the month or the whole history, with its percentage.",
                    "The Splitwise importer lets you map a CSV name to someone already in the group, without creating a duplicate.",
                ),
            ),
        ),
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
