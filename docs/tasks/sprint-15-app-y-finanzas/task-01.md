---
id: sprint-15-task-01
titulo: App Android — mockup, acceso, invitación, sesión y shell
area: app
estado: pendiente
plan: docs/superpowers/plans/2026-11-12-android-access-shell.md
fuente: docs/superpowers/specs/2026-11-12-android-access-shell.md
mockup: docs/mockups/app-shell/index.html
adrs: [0002, 0004, 0007, 0008]
---

**Tarea**: convertir la app Android de una pantalla de configuración de FCM en un cliente real:
**primero el mockup del esqueleto base** (navegación, arranque con instancia por defecto, login,
invitación, dashboard, ajustes, estados y claro/oscuro), y solo con ese mockup aprobado, arrancar
con la instancia de producción, iniciar sesión con email y contraseña contra Supabase Auth (o
canjear una invitación por deep link), guardar la sesión cifrada, refrescarla y mostrar un shell
con el perfil, el dashboard de widgets, idioma/tema, campana y FAB. Cambiar de instancia es una
acción de Ajustes, no una pantalla de primer arranque.

**Punto de partida**: `MainActivity` solo pide URL de instancia y un JWT manual; `FcmRegistrar`
guarda ese JWT en texto plano. No hay navegación, ni cliente de API, ni tema de tokens, ni
i18n. La landing dice que la app está «en desarrollo» y que sus pantallas son maquetas.

**Alcance**
- Dentro:
  - **Mockup A del esqueleto base** en `docs/mockups/app-shell/` (HTML+JS, 390 px, claro y
    oscuro): dos variantes de navegación, **arranque con la instancia por defecto** (sin pedir
    URL; el cambio vive en Ajustes), login, **invitación por deep link**, **dashboard con host
    de widgets** (widget de demo, no OweNo), **campana**, **FAB**, **selectores de
    idioma/tema**, ajustes, carga/error y estados de sesión. Es la puerta previa a cualquier
    código de UI; la implementación debe corresponder con la variante elegida.
  - **Recordar la última ubicación (D18)**: el shell guarda `home`, `modules` o
    `module:<key>` al navegar; al abrir con sesión restaura esa ubicación y, si es un módulo,
    su pantalla **raíz**, nunca una pantalla profunda ni un formulario. Si el módulo ya no
    existe o no hay acceso, cae en `modules`; sin módulos, en `home`.
  - **Host de widgets del dashboard**: el Inicio compone widgets aportados por los módulos; si
    un módulo declara uno, se incrusta. En esta tarea el host se implementa con un widget de
    demo/estado vacío; el contrato real y el widget de OweNo llegan en las tareas 02/03.
  - **Lanzador de módulos**: **cuadrícula** (elegida); solo módulos activos; **logo** grande
    sobre tile sólido con el **acento del módulo** (`branding.color`) y tarjeta teñida; texto
    legible en claro/oscuro; sin tarjetas «Próximamente». Lista/Destacado solo se usan en el
    mockup para comparar.
  - **Logo de OweNo**: `docs/mockups/app-shell/logos.html` con ocho direcciones propias
    (A pila de monedas, B monedas en abanico, C dos monedas, D cartera + moneda, E cartera
    minimalista, F billete, G billete + moneda, H cartera con billetes; sin tick), monocromas y probadas a 24/32/40 px.
    La decisión es **F · Billete + Esmeralda**; los otros finalistas (H cartera con billetes y
    Recibo + check) quedan como comparación en `logos-final.html`. `branding.icon` será el
    billete y `branding.color` emerald. No se usa un icono de librería.
  - **Sin selector global de grupo**: las categorías del Core son etiquetas/acceso y todos ven a
    todos; los grupos son de cada módulo (OweNo tendrá los suyos). El esqueleto no asume un
    grupo global.
  - **Instancia por defecto**: `BuildConfig.DEFAULT_INSTANCE_URL = https://027apps.ericrf.com`;
    el primer arranque no pide URL. **Cambiar instancia** vive en Ajustes, avisa de que cierra
    la sesión y borra datos locales; el login deja un enlace discreto «Usar otra instancia» para
    autoalojados.
  - **Invitación por deep link**: App Links para el dominio canónico + esquema propio
    `027apps://invite` para instancias autoalojadas; `POST /panel/invitations/{token}/redeem` → login
    → `/me`; el perfil nace con el locale de la invitación.
  - **Web `/invite/<token>`**: mantiene el alta en el navegador y añade «Descargar app» (GitHub
    Releases) para quien no tiene la app; el token sigue en la URL. Sin deferred deep link en
    v1: tras instalar, se vuelve a abrir el enlace.
  - **Idioma y tema**: el locale del perfil se aplica al entrar; Ajustes permite cambiarlo con
    `PATCH /me`; el tema se guarda igual. Sin AppCompat: override de configuración.
  - **Campana y FAB**: bandeja vacía honesta (el registro de dispositivos y la bandeja real
    llegan con el push en la tarea 07) y hoja de añadir con acciones de módulos; OweNo aporta
    «Gasto» en la tarea 07.
  - Core: `GET/PATCH /api/v1/me`, `GET /api/v1/me/modules`, bloque `auth` en `/instance`,
    `/.well-known/assetlinks.json`, locale de la invitación; `theme` en `UserView`.
  - App: Ktor, Supabase Auth, sesión cifrada con Keystore, refresco, navegación, pantallas de
    instancia/login/invitación/dashboard/notificaciones/ajustes, 9 idiomas y retirada de la
    pantalla manual de FCM; actualización de `docs/flows/fcm-validation.md` y de la fila «App
    Android» de `docs/ai/landing.md` (sin cambiar el copy público ni las maquetas).
- Fuera: pantallas de OweNo, QR de invitación, registro de dispositivos FCM, realtime y bandeja
  real (D12, tareas 02 y 04), caché offline de datos, cambio/reset de contraseña dentro de la
  app, release firmado y publicación del APK.

**Dependencias**: ninguna tarea previa. Depende de decisiones del propietario: **aprobación del
mockup A y elección de variante**, URL de instancia por defecto, idioma inicial, cuenta temporal
de aceptación y **fingerprint de firma** para App Links (o aceptar solo esquema propio).

**Riesgos**: el mockup A puede cambiar la navegación y obligar a rehacer pantallas si se
implementa antes de aprobarlo; el esquema propio `027apps://` puede ser reclamado por otra app
(mitigación: token de un solo uso, host mostrado, web como camino principal, App Links donde se
pueda); App Links exige fingerprint de firma y un host fijo, así que las instancias autoalojadas
usan el esquema propio; Supabase Auth exige URL y anon key por instancia (se exponen en
`/instance`; la anon key es pública por diseño, la service role nunca); el Keystore puede
invalidar la clave y hay que degradar a login; el Keystore no se puede probar en JVM (se abstrae
el cifrado); la aceptación en producción necesita una cuenta temporal.

**Criterios de aceptación** (detalle en la spec §9):
- **El mockup A del esqueleto está en `docs/mockups/app-shell/`, el propietario lo aprueba y la
  UI implementada corresponde con él** (pantallas, navegación, estados, claro/oscuro).
- `GET /api/v1/me` devuelve el perfil propio con `id`, `display_name`, `locale`, `timezone`,
  `theme` y `role`; sin sesión 401; una clave de servicio 403; `PATCH /me` cambia locale/tema
  sin escalar rol.
- `GET /api/v1/me/modules` devuelve públicos + concesiones activas para un usuario y todos para
  un admin; sin sesión 401.
- `GET /api/v1/instance` incluye `auth.supabase_url` y `auth.supabase_anon_key` cuando están
  configurados, y no incluye ningún secreto de servicio.
- `/.well-known/assetlinks.json` sirve los fingerprints configurados (o `[]`) sin secretos.
- El deep link de invitación abre la app, muestra el host, canjea el token, entra y aplica el
  locale de la invitación; la web sigue funcionando y ofrece «Descargar app» a quien no la
  tiene (o «próximamente» si no hay release).
- La app arranca **sin pedir URL**: usa `027apps.ericrf.com`, va al login y tras entrar muestra
  el dashboard. Cambiar de instancia en Ajustes avisa y cierra la sesión.
- El Inicio es un **dashboard con host de widgets**; si no hay widgets, muestra un estado vacío
  honesto, y no hay selector global de grupo (los grupos viven dentro de cada módulo).
- **Idioma y tema** se cambian en Ajustes, se guardan en el perfil y persisten; el idioma
  inicial es el de la invitación.
- El **lanzador de módulos** usa la **cuadrícula**, muestra solo los activos, presenta el módulo
  como **logo propio** (dirección A/B/C de `logos.html`, no un icono de librería) sobre tile
  sólido de su **acento** y tarjeta teñida, con texto legible en claro y oscuro; no hay tarjetas
  «Próximamente».
- **Campana** abre una bandeja vacía honesta (sin push) y **FAB** abre la hoja de añadir.
- Matar y reabrir la app mantiene la sesión y entra **directo a la última ubicación** (`home`,
  `modules` o el módulo abierto, siempre en su pantalla raíz; D18), sin volver a pedir
  credenciales y nunca en un formulario a medias; sin sesión, muestra el login.
- El token no aparece en texto plano en `SharedPreferences` ni en logs; `allowBackup=false`.
- En release solo se acepta `https://`; en debug se permite HTTP local para desarrollo.
- Cerrar sesión vuelve al login y borra la sesión local.
- `./gradlew :app:testDebugUnitTest :app:assembleDebug` y `pnpm lint && pnpm tsc` en verde.
- La app se instala y se acepta en un dispositivo; CI publica `apk-debug`.

**Puertas de usuario**
- Aprobar la spec.
- **Mockup A aprobado** (2026-11-12): variante B, OweNo, logo F · Billete + Esmeralda.
- **Logo + color de OweNo cerrados:** F · Billete + Esmeralda (2026-11-12).
- Aprobar el plan.
- Confirmar la instancia por defecto (`027apps.ericrf.com`), el idioma inicial y el
  **fingerprint de firma** para App Links.
- Crear y canjear una invitación temporal para la cuenta de prueba; no compartir la contraseña.
- Aceptar el APK en un dispositivo y probar la invitación por deep link.
- Publicar una release con APK (o aceptar que «Descargar app» muestre «próximamente»).
- Dar la orden explícita de merge.

**Auditoría de seguridad**: obligatoria antes de `finalizada` (flujo de autenticación, tokens,
almacenamiento, logs, superficie pública de `/instance`, dependencias nuevas).
