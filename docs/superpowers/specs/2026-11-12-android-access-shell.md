# Spec — App Android: acceso, sesión y shell (sprint 15, task 01)

**Fecha:** 2026-11-12
**Estado:** Borrador; el **mockup A fue aprobado** el 2026-11-12 (variante B, OweNo, logo
F · Billete + Esmeralda). Quedan pendientes la aprobación explícita de esta spec y del plan.
**Base:** [spec de auth](2026-10-25-auth.md) §3–§5 · [modelo de tokens](2026-10-25-token-model.md) §3.1 ·
[design system](2026-10-25-design-system.md) §3–§4 · ADR [0002](../../adr/0002-identidad-visual.md),
[0004](../../adr/0004-bordes-y-capa-de-aplicacion.md), [0007](../../adr/0007-manejo-de-errores.md),
[0008](../../adr/0008-fechas-y-moneda.md) · [`docs/ai/landing.md`](../../ai/landing.md)
**Tarea:** [`task-01`](../../tasks/sprint-15-app-y-finanzas/task-01.md)
**Decide el propietario:** URL de instancia por defecto, idioma de la app y cuenta temporal de
aceptación (2026-11-12)

## 1. Problema

La app Android no es un cliente de 027Apps: su única pantalla pide una URL de instancia y un
JWT pegado a mano para configurar FCM. No hay login, ni sesión persistente, ni cliente de API,
ni navegación, ni tema, ni idiomas. Además, el JWT se guarda en `SharedPreferences` en texto
plano (`FcmRegistrar.sessionToken`), lo que incumple el modelo de tokens (almacén seguro) y
convierte cualquier copia de seguridad del dispositivo en una fuga de sesión.

La landing pública dice la verdad («App in development · these screens are the planned
design»), pero el producto necesita una app que se pueda instalar, abrir y usar. Esta tarea
construye ese primer cliente real y, de paso, cierra el hueco de seguridad.

## 2. Objetivo

Que una persona de la familia pueda instalar la APK, escribir la URL de su instancia, entrar con
su email y contraseña, y ver su nombre y los módulos que tiene activos. La sesión sobrevive al
cierre de la app, se refresca sola y se puede cerrar. Sin pantallas de producto todavía: el
shell es la base sobre la que la tarea 07 monta OweNo.

## 3. Alcance v1

**Dentro**
- **Instancia por defecto** (`027apps.ericrf.com`): la app arranca, la valida contra
  `GET /api/v1/instance` y va al login. No pide URL. El cambio de instancia vive en
  **Ajustes → Instancia** (avisa de que cierra la sesión); el login ofrece un enlace discreto
  «Usar otra instancia» para autoalojados.
- Login email + contraseña contra **Supabase Auth** de esa instancia; **invitación por deep
  link** (App Links + esquema propio) o login; sin registro abierto, sin magic link y sin QR.
- Sesión persistente y cifrada con Android Keystore; refresco automático y reintento ante 401.
- Pantallas: instancia, login, **invitación**, **dashboard de widgets**, **notificaciones** y
  **ajustes** (cuenta, instancia, **selector de idioma**, **selector de tema**, cerrar sesión).
  El dashboard compone los widgets que aportan los módulos; si un módulo declara uno, se
  incrusta. En esta tarea el host se prueba con un widget de demo; el contrato real llega en la
  tarea 03 y el widget de OweNo en la 06.
- **Sin selector global de grupo**: las categorías del Core son etiquetas/acceso y todos ven a
  todos; cada módulo tiene sus propios grupos. El contexto de grupo vive dentro del módulo.
- **Campana** (bandeja vacía mientras FCM esté bloqueado) y **FAB** global con hoja de acciones
  de módulos.
- Tema sistema/claro/oscuro con tokens semánticos; 9 idiomas por recursos `values-*`; el idioma
  inicial lo fija la invitación y se puede cambiar en Ajustes.
- Retirada de la pantalla manual de FCM y del JWT en texto plano.

**Fuera**
- Pantallas de OweNo o de cualquier módulo (tarea 07).
- QR de invitación y emparejamiento móvil→móvil; el deep link cubre el alta con enlace.
- Registro de dispositivos FCM y notificaciones push (bloqueado por credenciales). La campana
  existe como pantalla vacía; no hay eventos ni push.
- Realtime, caché offline de datos, cambio/reset de contraseña dentro de la app, biometría,
  múltiples cuentas simultáneas.
- Release firmado y publicación del APK (puerta distinta; CI ya publica `apk-debug`).

## 4. Decisiones

| # | Decisión | Motivo |
|---|---|---|
| D1 | **Idioma**: la invitación fija el idioma inicial del perfil; la app lo aplica al entrar y **Ajustes permite cambiarlo**. | El propietario lo pidió así (2026-11-12). Se implementa con override de configuración en `attachBaseContext` y `PATCH /me`; no se depende de la locale del sistema. |
| D2 | **Tema**: se toma del perfil (`system`/`light`/`dark`) y **Ajustes permite cambiarlo**; el cambio se guarda en el perfil. | Consistencia con el panel (sprint 14) y control del usuario. |
| D3 | **Invitación por deep link en v1**: App Links para el dominio canónico + esquema propio `027apps://invite` para instancias autoalojadas, con la web como respaldo. La app canjea el token y luego hace login. | El propietario lo pidió (2026-11-12). Los dominios autoalojados son arbitrarios y App Links exige un host fijo; el esquema propio cubre ese caso. |
| D4 | Sin FCM en v1: se retira la pantalla manual y no se registra el dispositivo. La **campana** existe con estado vacío. | FCM está bloqueado por falta de proyecto Firebase/`google-services.json`; el registro llegará con esa tarea. |
| D5 | La app trae **`027apps.ericrf.com` por defecto** y no pide URL al arrancar. El cambio vive en **Ajustes → Instancia** (cierra la sesión); el login deja un enlace discreto «Usar otra instancia» para autoalojados. **No hay selector global de grupo**. | El propietario lo pidió así (2026-11-12): la familia no debe escribir una URL. El enlace del login evita dejar atrapado a quien autoaloja sin haber entrado. Las categorías del Core son etiquetas/acceso y los grupos son de cada módulo. |
| D6 | En release solo HTTPS; en debug se permite HTTP local para desarrollo. | Evita enviar contraseñas por HTTP en una APK distribuida. |
| D7 | **FAB global** en el shell: abre una hoja de «añadir» con las acciones de los módulos. OweNo aporta «Gasto» en la tarea 06. | El propietario lo pidió; el shell no hardcodea la acción de un módulo. |
| D8 | **Sesión persistente**: el refresh se guarda cifrado y se renueva en silencio; no se vuelve a pedir login en uso normal. Si se revoca o el refresh falla, se pide login. | «Login para siempre» del propietario, con revocación real. |
| D9 | **Navegación: variante B** (`Inicio · Módulos · Ajustes`), elegida por el propietario. OweNo se abre dentro de Módulos, no como pestaña. | Elegida el 2026-11-12; escala mejor con varios módulos. |
| D10 | **Lanzador de módulos en cuadrícula**, solo módulos activos, **logo grande sobre tile sólido del acento** y tarjeta teñida (6 %, borde 22 %). Lista y Destacado son comparaciones de revisión; no se envían como preferencia. | El propietario eligió cuadrícula (2026-11-12) y pidió logos, no iconos de línea. El tile sólido da presencia de logo; el tinte de tarjeta da identidad sin llenar la pantalla de colores y el texto sigue sobre superficie. |

## 5. Cambios en el Core (API)

### 5.1 `GET /api/v1/me`

- Scope `profile:read`; sesión o clave delegada; `anon` → 401; `service` → 403.
- Respuesta `{ user: UserView }` con `id`, `display_name`, `locale`, `timezone`, `theme`,
  `role`, `created_at`, `deactivated_at`, `categories`.
- **Cambio aditivo**: `UserView` gana `theme` (`system`|`light`|`dark`). La columna ya existe en
  `profiles` (`0021_profile_theme.sql`); se añade a `toView`, a la consulta de `getUserFrom` y a
  los tests. No se expone el email (vive en la sesión de Supabase).
- Archivos: `packages/core/src/users/api.ts`, `packages/core/src/users/service.ts`,
  `apps/admin/src/app/api/v1/me/route.ts`.
- Tests: propio, ajeno, anon, service, delegada, `theme` presente.

### 5.1bis `PATCH /api/v1/me`

- Scope `profile:write`; sesión o clave delegada; edita **solo** `display_name`, `locale` y
  `theme` del propio perfil; nunca `role`.
- Reutiliza `updateUser`/`userPatchSchema` (`packages/core/src/users/api.ts`) con el id del
  llamante; sin `users:write` (autoedición). Un `locale` fuera de los 9 → 400; un `theme`
  fuera de `system|light|dark` → 400.
- Respuesta `{ user: UserView }` actualizada. La app lo usa para el selector de idioma y tema.
- Archivos: `packages/core/src/users/api.ts`,
  `apps/admin/src/app/api/v1/me/route.ts` (PATCH), OpenAPI.
- Tests: autoedición, no puede cambiar `role`, locale inválido, theme inválido, anon 401.

### 5.2 `GET /api/v1/me/modules`

- Sin scope adicional más allá de estar autenticado (la lista es derivada); `anon` → 401.
- `admin`/`super_admin` → todos los módulos; `user` → públicos + `user_modules` activos;
  solo `state = 'active'` para no admins. Misma semántica que `listModules`.
- Respuesta `{ modules: ModuleView[], total, limit, offset }`, paginada.
- Reutiliza `listModules` (`packages/core/src/modules/service.ts`) con filtros vacíos.
- Archivos: `packages/core/src/modules/api.ts`,
  `apps/admin/src/app/api/v1/me/modules/route.ts`.
- Tests: público, privado con grant, privado sin grant, admin, anon.

### 5.3 `GET /api/v1/instance` — bloque `auth`

- Añade `auth: { supabase_url, supabase_anon_key } | null` a la respuesta pública.
- Se rellena desde `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en la ruta del
  admin; la función de Core recibe el valor por dependencia (testeable, sin leer `process.env`).
- **La anon key es pública por diseño** (es la que ya se sirve al navegador); la
  `SUPABASE_SERVICE_ROLE_KEY` **nunca** se incluye. Si falta configuración, `auth: null`.
- No se cachea de forma distinta: `/instance` ya responde con `cache-control` público y corto.
- Archivos: `packages/core/src/instance/api.ts`,
  `apps/admin/src/app/api/v1/instance/route.ts`, `docs/api/README.md`, OpenAPI.
- Tests: presente, ausente, sin service role, con `settings_public` intacto.

### 5.3bis `GET /.well-known/assetlinks.json` (App Links)

- Ruta pública fuera de `/api/v1`, servida por el admin, con
  `Content-Type: application/json` y `Cache-Control: public, max-age=3600`.
- Contenido: una entrada `android_app` con `package_name: com.rferic.zero27apps` y los
  **SHA-256** de los certificados de firma configurados en `ANDROID_APP_SHA256` (lista separada
  por comas; debug y release pueden convivir). Sin fingerprints, responde `[]` y los App Links
  no se verifican; la app cae al esquema propio o a la web.
- **No es un secreto**: el fingerprint es público; la service role y el keystore no se exponen.
- Archivos: `apps/admin/src/app/.well-known/assetlinks.json/route.ts` (o
  `apps/admin/public/.well-known/assetlinks.json` generado en build; se elige la ruta dinámica
  para leer el env), `docs/flows/cicd.md` o `docs/infrastructure.md` para el env.
- Tests: con fingerprints, sin fingerprints, content-type, sin secretos.

### 5.4 OpenAPI y documentación

- Añadir las operaciones `/me` y `/me/modules` al registro
  (`packages/core/src/openapi/registry.ts`, `schemas.ts`) y regenerar
  `docs/api/openapi.json`.
- Marcar ambas como implementadas en `docs/api/README.md`; documentar el bloque `auth` de
  `/instance`, el `PATCH /me` y la naturaleza pública de la anon key.

### 5.5 Canjeo: locale inicial desde la invitación

- En `redeemInvitation` (`packages/core/src/invitations/service.ts`), el perfil nuevo nace con
  el **`locale` de la invitación** (`invitations.locale`, ya existe) en vez del locale por
  defecto de la instancia. Si el locale no es válido, cae al default (el CHECK ya lo impide).
- La app, tras canjear y entrar, lee `/me` y aplica ese locale como idioma inicial; después
  puede cambiarlo con `PATCH /me`.
- Test: una invitación en `ca` crea un perfil `ca`; una en `en` crea `en`; el locale de la
  instancia no pisa el de la invitación.

## 6. App Android

### 6.1 Arquitectura

Una sola app Gradle, sin módulos nuevos, con capas claras:

```text
com.rferic.zero27apps
  MainActivity.kt                 # setContent { Zero27AppsApp() }
  Zero27AppsApplication.kt        # inicialización de Firebase (se conserva)
  ServerUrl.kt                    # normalización + política HTTPS
  InstanceStore.kt                # URL de instancia (no secreta)
  auth/                           # Supabase Auth + sesión cifrada
  data/                           # Ktor, DTOs, errores
  push/                           # FcmConfig + PushMessagingService (sin registro v1)
  ui/                             # Compose, viewmodels, tema, pantallas
```

- MVVM ligero: un `AppViewModel` de estado de sesión y viewmodels por pantalla; sin DI
  framework (constructor manual / factory), coherente con el tamaño actual.
- Dependencias nuevas, fijadas en `gradle/libs.versions.toml`:
  - `io.github.jan-tennert.supabase:auth-kt:3.9.0` (Kotlin 2.4.21, Ktor 3.6.0).
  - `io.ktor:ktor-client-okhttp`, `ktor-client-content-negotiation`,
    `ktor-serialization-kotlinx-json` (3.6.0).
  - `org.jetbrains.kotlinx:kotlinx-serialization-json` (1.13.0) + plugin de serialización.
  - `androidx.navigation:navigation-compose:2.10.2`,
    `androidx.lifecycle:lifecycle-viewmodel-compose:2.11.0`,
    `lifecycle-runtime-compose:2.11.0`.
  - Test: `ktor-client-mock`, `kotlinx-coroutines-test`, JUnit 4 (ya está).
- **No** se añade `androidx.security:security-crypto`: `EncryptedSharedPreferences` y
  `MasterKey` están deprecados. El cifrado se hace con `KeyGenerator` + Android Keystore
  (AES-256-GCM).

### 6.2 Sesión y almacenamiento

- `SessionStore` (interfaz) con `read/write/clear` de un `String` cifrado.
- `KeystoreSessionStore`:
  - Clave AES-256-GCM en `AndroidKeyStore`, alias `027apps_session`, generada una vez.
  - `Cipher("AES/GCM/NoPadding")`; IV aleatorio por cifrado; se guarda `iv || ciphertext` en
    Base64 en `SharedPreferences` privadas `027apps_session`.
  - Si la clave se invalida o el descifrado falla: borrar la sesión y pedir login (nunca
    degradar a texto plano).
- `EncryptedSessionManager` implementa `SessionManager` de supabase-kt:
  - `saveSession` serializa `UserSession` con `Json { encodeDefaults = true; ignoreUnknownKeys =
    true }` (doc de supabase-kt: sin `encodeDefaults` se pierden campos al restaurar).
  - `loadSession` descifra; si no hay, lanza la excepción de «no session» de la librería.
  - `deleteSession` borra el registro.
- `allowBackup="false"` en el manifest; `SharedPreferences` privadas. La URL de instancia se
  guarda aparte, en claro (no es un secreto).
- Al cambiar de instancia: cerrar el cliente Supabase anterior (`supabase.close()`), borrar la
  sesión y crear uno nuevo.
- **Arranque**: leer la instancia (default/override) → crear el cliente → cargar la sesión
  cifrada. Si hay sesión válida, refrescar si hace falta y entrar a la **última ubicación**
  (D18, §6.5); si no
  hay o el refresh falla, mostrar el login. La pantalla de instancia no forma parte del
  onboarding.
- Refresco: supabase-kt gestiona la rotación; además, el cliente API reintenta **una vez** tras
  un 401 llamando a `refreshCurrentSession()`. Si vuelve a fallar, cierra sesión local.

### 6.3 Cliente API y errores

- `ApiClient` con `HttpClient(OkHttp)` + `ContentNegotiation(json)` y `baseUrl` de la instancia.
- Token: `auth.currentAccessTokenOrNull()`; si es null, refrescar; `Authorization: Bearer`.
- DTOs (`data/Dtos.kt`) con `@Serializable` y `ignoreUnknownKeys = true`:
  - `InstanceResponse(version, requires_setup, setup_incomplete, settings_public, auth)`.
  - `AuthConfig(supabase_url, supabase_anon_key)`.
  - `MeResponse(user)`; `UserDto(id, display_name, locale, timezone, theme, role, …)`.
  - `MyModulesResponse(modules, total, limit, offset)`; `ModuleDto(key, name, version, state,
    is_public, …)`.
  - `ErrorEnvelope(error: { code, message, request_id })`.
- Errores (ADR 0007): el cliente ramifica por `code`, nunca por el texto. Mensajes localizados
  para `unauthorized`, `validation_failed`, `rate_limited`, `not_found`, `internal` y errores
  de red. Un 500 nunca muestra detalles internos.
- Timeouts: conexión 10 s, lectura 20 s; reintento manual desde la UI, no automático en
  escrituras.

### 6.4 Instancia y confianza

- `ServerUrl.normalize(raw, requireHttps)`:
  - Acepta solo `http`/`https` con host; rechaza `userinfo`, query, fragment y esquemas
    desconocidos.
  - Release: `requireHttps = true`. Debug: permite `http://localhost`, `http://127.0.0.1` y
    `http://10.0.2.2` (emulador).
- La pantalla de instancia muestra el **host** que se usará y advierte si es HTTP.
- La única URL que puede llegar por deep link es la de la **invitación** (§6.4bis); se muestra
  el host antes de pedir credenciales y se rechaza si no es HTTPS en release. No hay deep links
  de instancia ni QR en v1.
- La app no envía credenciales a ningún host distinto del elegido; el login va a
  `supabase_url` de `/instance`, que debe ser HTTPS en release.

### 6.4bis Invitación por deep link

- **App Links** para el dominio canónico (`https://027apps.ericrf.com/invite/<token>`), con
  `/.well-known/assetlinks.json` (§5.3bis). Si la verificación falla, Android abre la web.
- **Esquema propio** `027apps://invite?instance=<url>&token=<token>` para instancias
  autoalojadas o cuando el App Link no está verificado.
- **Si la app no está instalada**: la web `/invite/<token>` sigue mostrando el alta en el
  navegador (funciona sin app) y añade un botón **«Descargar app»**. No hay *deferred deep
  link* en v1: tras instalar, el usuario vuelve a abrir el enlace y el App Link/ esquema propio
  le lleva al alta. El token no se pierde porque sigue en el enlace.
- El botón de descarga apunta a GitHub Releases; **hoy no hay release publicada**, así que es
  una puerta de usuario de la tarea 01 (o del sprint 16). Mientras no exista, la web puede
  mantener el alta en el navegador y mostrar «Descargar app (próximamente)».
- La pantalla de invitación muestra **siempre el host de la instancia** antes de pedir
  credenciales. Si el host no es HTTPS en release o no responde, se bloquea.
- Flujo: abrir enlace → validar token/host → email + contraseña → `POST
  /api/v1/invitations/{token}/redeem` → login en Supabase con las mismas credenciales → `/me` →
  aplicar el locale del perfil → dashboard.
- El token **no se registra** ni se guarda tras el canje; la pantalla no se captura en
  recientes (`FLAG_SECURE` en la actividad de invitación) y no se autocompleta el email.
- El esquema propio puede ser reclamado por otra app: el token es de un solo uso, la app muestra
  el host y la web es el camino recomendado. La app no acepta un token sin mostrar la instancia.
- Errores: `invitation_expired` / `invitation_used` (409) con mensaje claro; email que no
  coincide → mensaje genérico; sin filtrar si el email existe.
- Archivos: `AndroidManifest.xml` (intent filters), `ui/screens/InviteScreen.kt`,
  `auth/InvitationRepository.kt`, `apps/admin/src/app/api/v1/invitations/[id]/redeem/route.ts`
  (ya existe), `apps/admin/src/app/.well-known/assetlinks.json/route.ts`.

### 6.5 Navegación y pantallas

La **navegación** es la **variante B** del mockup A (§6bis): barra inferior `Inicio · Módulos ·
Ajustes`; OweNo se abre dentro de la pila de Módulos, no como pestaña. Aquí se enumeran las
pantallas y sus estados; la implementación no inventa una navegación distinta.

**Última ubicación (D18).** El shell persiste `home`, `modules` o `module:<key>` cada vez que se
navega a una de esas tres cosas, en preferencias locales (no es un secreto). Al abrir con sesión
válida restaura esa ubicación: si es un módulo, entra en **su pantalla raíz** (la que el registro
del módulo declare como entrada), nunca en una pantalla profunda ni en un formulario a medias.
`Ajustes` y las pantallas profundas **no** sobrescriben lo guardado. Si el módulo ya no existe,
está inactivo o no hay acceso, cae en `modules`; si no hay ningún módulo, en `home`. La
restauración ocurre después de validar la sesión, y un módulo que falla al cargar su raíz deja el
shell en `modules` en vez de reintentar en bucle.

| Pantalla | Contenido | Estados |
|---|---|---|
| `SplashScreen` | Arranque con la instancia por defecto (`027apps.ericrf.com`), validación de `/instance` y aviso de que no se pide URL. | Cargando; error de conexión con reintento y enlace a «otra instancia». |
| `LoginScreen` | Email, contraseña, mostrar/ocultar, botón «Entrar», host de la instancia y enlace discreto «Usar otra instancia». | Cargando, credenciales inválidas, rate limit, error de red, cuenta desactivada. |
| `ChangeInstanceScreen` | URL editable, aviso de que **cierra la sesión y borra datos locales**, «Guardar y cerrar sesión» y «Cancelar»; se llega desde Ajustes y desde el login. | Validando, error de URL, instancia sin `auth`, `requires_setup`. |
| `InviteScreen` | Host de la instancia, email, contraseña, crear cuenta y entrar; aviso de token de un solo uso. | Validando token, caducada, usada, email que no coincide, error de red. |
| `HomeScreen` / dashboard | Saludo con `display_name` y **widgets aportados por los módulos** (el host los incrusta; sin widgets, estado vacío). Campana y FAB. No hay selector global de grupo. | Cargando, error con reintento, vacío, widget inválido/desconocido. |
| `NotificationsScreen` | Bandeja de eventos; sin push, estado vacío honesto. | Vacío; con eventos cuando existan. |
| `ModuleLauncher` | **Cuadrícula** (elegida); solo módulos activos; **logo** grande sobre tile sólido con el acento del módulo y tarjeta teñida; texto legible en claro/oscuro; sin «Próximamente». Lista/Destacado solo en el mockup. Al abrir un módulo se guarda `module:<key>` (D18). | Normal; vacío (ningún módulo activo); tema oscuro. |
| `SettingsScreen` | Cuenta (nombre, email de la sesión), **cambiar instancia**, **selector de idioma**, **selector de tema** (sistema/claro/oscuro), notificaciones, cerrar sesión. | Guardando idioma/tema, error al cerrar sesión (se limpia igual). |
| `AddSheet` | Hoja del FAB con las acciones de los módulos; OweNo aporta «Gasto» en la tarea 06. | — |
| `ModuleComingSoon` | Hoja inferior al tocar un módulo sin pantalla. | — |

- El login ya no es la única entrada: la invitación por deep link abre `InviteScreen`; la web
  `/invite/<token>` sigue siendo el respaldo. El login muestra «¿Te han invitado? Abre el enlace
  en este móvil».
- El botón atrás en Home sale de la app; en Login sale de la app (la instancia por defecto no
  es una pantalla de onboarding); en Ajustes vuelve a Home; en Cambiar instancia vuelve a
  Ajustes o al Login según se haya abierto; en Invitación vuelve a Login.
- Accesibilidad: `contentDescription` en iconos, tamaños táctiles ≥ 48 dp, contraste AA de los
  tokens en claro y oscuro.

### 6.5bis Dashboard de widgets (contrato pendiente de D10)

El propietario quiere que **cada módulo pueda aportar un widget al dashboard** y que, si lo
aporta, se incruste. El contrato canónico del manifest **no tiene `widgets`** hoy; esta spec
solo fija el host de la app y deja el contrato para la tarea 03 (decisión D10).

Propuesta para D10 (a confirmar):

- El manifest declara `dashboard_widgets: [{ key, type, title, icon, order, surface }]`; el
  módulo implementa un resolver que devuelve datos, no HTML.
- Un único `GET /api/v1/me/dashboard` compone los widgets de los módulos activos a los que el
  usuario tiene acceso. La app no llama a cada módulo por separado (evita N+1 y centraliza la
  autorización).
- La app renderiza un **conjunto cerrado de tipos nativos** (`summary`, `list`, `metric`) con
  los tokens del DS. Un tipo desconocido se ignora o se muestra como tarjeta genérica «abrir
  módulo»; **nunca** se renderiza HTML/JS de un módulo en un WebView (XSS, CSP y coherencia
  visual).
- Si un módulo no declara widget, no aparece. El dashboard vacío muestra un estado honesto, no
  tarjetas inventadas.
- El host es de esta tarea; el widget real de OweNo llega en la tarea 06.

Si D10 elige «componente nativo por módulo», la app necesita una release por cada widget nuevo;
no es recomendable. Si elige HTML/JS del módulo, se rechaza por seguridad.

### 6.6 Tema y tokens

- `ui/theme/Tokens.kt` es el **único** sitio con colores en Kotlin; el resto consume
  `MaterialTheme.colorScheme` o tokens semánticos.
- **Logos, no iconos de línea**: el módulo se presenta como un **logo de app**: marca monocroma
  más gruesa sobre un **tile sólido con su acento** (`branding.color`), no un icono de línea del
  DS sobre fondo pálido. El logo real viene de `branding.icon` (SVG monocromo, `currentColor`).
  `docs/mockups/app-shell/logos.html` recoge **ocho direcciones propias** para OweNo —A pila
  de monedas, B monedas en abanico, C dos monedas, D cartera + moneda, E cartera minimalista, F
  billete, G billete + moneda, H cartera con billetes; sin tick—, monocromas, probadas a
  24/32/40 px y sobre el tile. La decisión es **F · Billete + Esmeralda**; H y Recibo + check
  quedan como comparación en `logos-final.html`. `branding.icon` será el billete y
  `branding.color` emerald (`packages/owe-no/assets/icon.svg`). Los iconos de la barra
  inferior, campana y FAB sí son del DS. El widget usa el logo del módulo salvo que el widget
  declare otro. **Un logo a todo color** exigiría cambiar el contrato (`branding.logo` o
  similar) y resolver el modo oscuro; no entra sin decisión explícita.
- **Acento del módulo**: el logo va sobre un tile sólido del acento (marca en blanco en claro y
  oscura en oscuro, con contraste AA) y la tarjeta lleva un tinte al 6 % con borde al 22 %; el
  texto sigue en `foreground` sobre superficie, así que el contraste no depende del slot. No se
  rellena la tarjeta entera con el acento: con 8 slots el lanzador se vuelve ruidoso y habría que
  validar el texto en cada uno.
- **Texto en oscuro**: los tiles son `<button>`; el default del navegador es texto negro y en
  oscuro no se lee. Tile, fila y destacado declaran `color: var(--foreground)`. Test de tema
  oscuro obligatorio en el `ModuleLauncher`.
- Valores desde `apps/admin/tokens.json` (identidad D); un test JVM lee
  `../../admin/tokens.json` y compara los hex de claro/oscuro. Si el fichero no está en el
  classpath del test, se copia como recurso de test en el mismo PR (decisión de
  implementación, documentada).
- `Theme.kt` mapea a `lightColorScheme`/`darkColorScheme`; `background`, `surface`, `primary`,
  `accent`, `border`, `destructive`, `success`. El tema del perfil manda; `system` sigue al
  dispositivo.
- Sin colores hex en pantallas, componentes ni strings.

### 6.7 i18n

- `values/strings.xml` (inglés) y `values-{es,ca,de,eu,fr,gl,it,pt}/strings.xml`.
- Nombres de recurso estables (`login_title`, `home_empty`, `error_rate_limited`), no frases
  como clave (el mecanismo de Android es propio; la pipeline `packages/i18n` cubre web/admin).
- El idioma inicial lo fija la invitación (locale del perfil) y la app lo aplica con un
  **override de configuración en `attachBaseContext`** (`createConfigurationContext`, API 26+),
  sin añadir AppCompat; al cambiarlo se guarda con `PATCH /me` y se recrea la actividad.
  **Ajustes permite cambiarlo**. Si el perfil no tiene locale válido, se usa el del sistema.
- Los 8 locales se rellenan en el PR; el revisor de estilo comprueba tono y placeholders.

### 6.8 FCM

- Se **elimina** la pantalla manual de configuración y la propiedad `sessionToken` en texto
  plano.
- Se conservan `FcmConfig`, `PushMessagingService` y la inicialización de Firebase desde el
  almacén, para que la tarea de FCM no vuelva a empezar de cero.
- No se registra el dispositivo: no hay proyecto Firebase ni `google-services.json`. La app
  funciona sin push; el día que FCM se desbloquee, el registro usará la sesión de esta tarea.
- Se actualiza `docs/flows/fcm-validation.md`: el paso que usa la pantalla manual con JWT
  pegado desaparece; hasta que exista el registro autenticado, el runbook queda marcado como
  bloqueado.

## 6bis. Diseño y mockup (puerta)

Esta tarea **no se implementa desde la prosa**: la navegación, las pantallas y los estados se
diseñan primero en un mockup HTML+JS y el propietario lo aprueba. Es la misma regla que
[`new-module.md`](../../flows/new-module.md) fase 7 y el DoD de Diseño: «la spec no está
completa hasta que el mockup se acepta».

### Artefacto

`docs/mockups/app-shell/`:

- `index.html` — mockup navegable con las pantallas en marcos de 390 px.
- `README.md` — inventario de pantallas, estados, decisiones de navegación y qué queda fuera.
- `preview-splash.png`, `preview-change-instance.png`, `preview-home.png`,
  `preview-modules-grid.png`, `preview-modules-list.png`, `preview-modules-feature.png`,
  `preview-modules-accent-icon.png`, `preview-modules-dark.png`, `preview-logos.png`, `preview-logos-all.png`,
  `preview-settings-dark.png`, `preview-invite.png`, `preview-add.png` — capturas de revisión
  rápida; el HTML es la fuente.
- `app-shell-tokens.md` o una sección del README — tokens usados y contraste AA verificado en
  ambos modos. Nada de hex libres: se parte de `apps/admin/tokens.json`.

### Pantallas y estados que debe cubrir

1. **Arranque**: la app conecta sola con `027apps.ericrf.com`; no pide URL. Estados de carga,
   error de conexión con reintento y enlace discreto a «otra instancia». **Cambiar instancia**
   (desde Ajustes): URL editable, aviso de cierre de sesión, error de URL, instancia sin `auth`
   y `requires_setup`.
2. **Login**: vacío, cargando, credenciales inválidas, rate limit, error de red, cuenta
   desactivada, host por defecto y enlace discreto «Usar otra instancia», nota de invitación
   por deep link.
3. **Invitación**: host, email (vacío: el de la invitación), contraseña, aviso de token de un
   solo uso, token caducado/usado, email que no coincide. El idioma inicial de la invitación se
   aplica después del canje, no se muestra antes.
4. **Home/dashboard**: host de widgets con un widget de demo (resumen y lista), vacío sin
   widgets, campana, FAB, cargando, error con reintento, pull-to-refresh. **No** es una lista
   fija de tarjetas.
5. **Notificaciones**: campana y estado vacío honesto (push bloqueado).
6. **Ajustes**: cuenta, host, **selector de idioma**, **selector de tema** (sistema/claro/
   oscuro), notificaciones, cerrar sesión, estado de cierre.
7. **Añadir (FAB)**: hoja de acciones de módulos; OweNo aporta «Gasto» en la tarea 06.
8. **Módulos**: lanzador en **cuadrícula** (elegida) con **solo módulos activos** (sin
   «Próximamente»), **logo grande** sobre tile sólido del **acento de cada módulo**
   (`branding.color`) y tarjeta teñida al 6 %. «Solo icono» deja la tarjeta limpia; Lista y
   Destacado son comparaciones de revisión, no una preferencia de producto. Estado vacío. El
   logo manda sobre el texto y el texto se ve en claro y oscuro.
9. **Navegación**: qué es una pestaña, qué es una pantalla, qué hace el botón atrás en cada
   sitio; el shell debe admitir que la tarea 06 añada OweNo sin rediseñar la base.
10. **Claro y oscuro**: todas las pantallas en ambos modos.
11. **Accesibilidad**: foco visible, tamaños táctiles, contraste, textos de 200 % sin romper.

### Reglas

- El mockup A **fue aprobado** el 2026-11-12: **variante B**, OweNo, logo **F · Billete** y color
  **esmeralda**. Si el propietario pide cambios, se iteran en el HTML y se vuelve a aprobar; no
  se implementa una versión intermedia.
- El mockup F1 de la tarea 06 **reutiliza** este esqueleto: añade OweNo al home y las
  pantallas del módulo, pero no cambia la navegación base sin volver a la puerta del mockup A.
- El mockup F2 de la tarea 06 cubre el panel de control (catálogo/ficha, overview, grupos,
  gastos, balances, miembros). No se diseña aquí para no mezclar dos superficies antes de
  cerrar el esqueleto.
- El copy del mockup va en español para revisar tono; la implementación publica los 9 idiomas.
  Los nombres e importes son de demo, nunca de la familia.
- La UI aceptada debe corresponder con el mockup. Una desviación se explica en la revisión de
  tarea; no se cuela como «detalle de implementación».

## 7. Seguridad

### Modelo de amenazas

| Activo | Actor | Amenaza | Control |
|---|---|---|---|
| Contraseña | Red local / MITM | Interceptación | HTTPS obligatorio en release; Supabase Auth; no se registra ni se guarda. |
| Refresh/access token | Dispositivo perdido, backup, logs | Robo de sesión | Keystore AES-GCM; `allowBackup=false`; sin logs; revocación en Supabase; logout. |
| URL de instancia | Enlace malicioso | Phishing de credenciales | El único deep link es la invitación; se muestra el host antes de pedir credenciales; HTTPS en release; el usuario elige. |
| Anon key | Público | Suplantación de cliente | Es pública por diseño; RLS y el guard son la barrera; nunca se expone la service role. |
| Datos del perfil | API | Enumeración | `/me` solo devuelve el propio; errores uniformes; sin email en la representación. |

### Controles adicionales

- `android:usesCleartextTraffic="false"` en el manifest principal; debug permite HTTP local.
- No se registran tokens, contraseñas, emails ni cuerpos de respuesta. Ktor logging desactivado
  o saneado.
- `FLAG_SECURE` se aplica en la pantalla de invitación (token en el intent) y se reevalúa para
  OweNo; el resto del shell no lo necesita en v1.
- Dependencias nuevas justificadas y fijadas; sin `SNAPSHOT`.
- El cierre de sesión llama a `signOut()` (revoca en Supabase) y limpia localmente aunque la red
  falle.

## 8. Tests

### Core

- `packages/core/src/users/api.test.ts`: `/me` propio, ajeno (404/403 uniforme), anon, service,
  delegada; `theme` en la representación; `PATCH /me` autoedición, rol bloqueado, locale/theme
  inválidos.
- `packages/core/src/modules/api.test.ts`: `/me/modules` público, privado con/sin grant, admin,
  anon.
- `packages/core/src/instance/api.test.ts` (nuevo): `auth` presente/ausente, sin service role,
  `settings_public` intacto.
- `packages/core/src/invitations/service.test.ts`: el perfil nace con el locale de la
  invitación.
- `apps/admin/src/app/.well-known/assetlinks.json/route.test.ts` (nuevo): fingerprints, vacío,
  content-type, sin secretos.
- `packages/core/src/openapi/generate.test.ts` + `pnpm check:openapi`.

### Android (JVM, `testDebugUnitTest`)

- `ServerUrlTest`: HTTPS en release, HTTP local en debug, rechazo de `userinfo`/query/fragment/
  esquemas, normalización de barras.
- `EncryptedSessionManagerTest`: round-trip con un `SecretCipher` falso; JSON con
  `encodeDefaults`; sesión corrupta → no session; `deleteSession`.
- `ApiClientTest` con `MockEngine`: parseo de `/instance`, `/me`, `/me/modules`; envelope de
  error; 401 → refresco → reintento una vez; segundo 401 → logout.
- `AppViewModelTest`: sin instancia → instancia; con instancia y sin sesión → login; con sesión
  → home; logout → login; error de red → reintento sin perder la sesión.
- `InvitationLinkTest`: parseo de App Link y de `027apps://invite`, host válido/ inválido,
  token ausente, rechazo de HTTP en release, no se registra el token.
- `InviteViewModelTest`: canje correcto → login → home; caducada/usada/email distinto; error de
  red sin perder el token en memoria.
- `LocaleTest`: el locale del perfil se aplica al arrancar; cambiarlo recrea la actividad y se
  guarda; fallback al sistema si el locale no es válido.
- `SettingsViewModelTest`: tema claro/oscuro/sistema se guarda; error de `PATCH` revierte.
- `DashboardHostTest`: widgets ordenados, tipo desconocido, vacío, sin HTML; FAB abre la hoja;
  campana abre la bandeja vacía.
- `LastLocationTest` (D18): `home`/`modules`/`module:<key>` se guardan al navegar; al arrancar con
  sesión se restaura la raíz del módulo y nunca una pantalla profunda; `Ajustes` no sobrescribe;
  módulo inactivo o sin acceso → `modules`; sin módulos → `home`; un fallo al cargar la raíz cae
  en `modules` sin bucle.
- `TokensTest`: paridad con `apps/admin/tokens.json` (o recurso copiado).

### E2E (fuera de esta tarea)

La estrategia de testing prevé Maestro para los flujos críticos de móvil («login una vez»).
Hoy el job `android` no arranca un emulador: solo ejecuta tests JVM y ensambla el APK. Añadir
Maestro al CI es una tarea de infraestructura aparte (emulador, caché y tiempo de job); en esta
tarea el login se cubre con tests JVM y aceptación manual. Se registra como deuda para el
sprint 16, no se finge que existe.

### Manual (aceptación)

- Instalar `apk-debug` en un dispositivo o emulador.
- Escribir la URL, entrar con la cuenta temporal, ver nombre y dashboard.
- Abrir una invitación de prueba por deep link; canjear y entrar; el idioma inicial es el de la
  invitación.
- Matar la app y reabrir: sigue dentro.
- Inspeccionar `shared_prefs`: no hay token legible.
- Cambiar tema e idioma desde Ajustes; se guardan y se mantienen al reabrir.
- Abrir la campana: estado vacío; abrir el FAB: hoja de añadir.
- Cerrar sesión: vuelve al login; reabrir: pide login.
- Probar URL inválida, contraseña incorrecta, invitación caducada y modo avión.

## 9. Criterios de aceptación

1. El mockup A (`docs/mockups/app-shell/`) cubre las pantallas y estados del §6bis, está en
   claro y oscuro, el propietario lo aprueba y la UI implementada corresponde con él.
2. `GET /api/v1/me` responde 200 con el perfil propio y `theme`; 401 sin sesión; 403 con clave
   de servicio.
3. `GET /api/v1/me/modules` responde públicos + concesiones activas; admin ve todos; 401 sin
   sesión.
4. `GET /api/v1/instance` incluye `auth.supabase_url` y `auth.supabase_anon_key` cuando están
   configurados; no incluye la service role; `auth: null` si faltan.
5. La app instala y arranca **sin pedir URL**: usa `027apps.ericrf.com` por defecto, valida la
   instancia, hace login y muestra el dashboard con widgets. Cambiar de instancia en Ajustes
   avisa y cierra la sesión; el login deja el enlace discreto para autoalojados.
6. El deep link de invitación (App Link o esquema propio) abre la pantalla de invitación,
   muestra el host, canjea el token y deja la sesión iniciada. Si la app no está instalada, la
   web sigue mostrando el alta y ofrece «Descargar app» (o «próximamente» sin release); el token
   no se pierde.
7. El perfil nace con el locale de la invitación; Ajustes puede cambiarlo con `PATCH /me` y el
   cambio persiste. El tema se cambia igual.
8. Al abrir con una sesión guardada entra **directo a la última ubicación** (módulo en su
   pantalla raíz o `home`), nunca a un formulario a medias; sin sesión muestra el
   login. La sesión sobrevive al reinicio, el refresh funciona en silencio y el logout limpia.
9. No hay tokens en texto plano ni en logs; `allowBackup=false`; release exige HTTPS; la
   pantalla de invitación usa `FLAG_SECURE`.
10. Campana (vacía, sin push) y FAB (hoja de añadir) existen y no prometen datos falsos.
11. Tema claro/oscuro y 9 idiomas por recursos funcionan.
12. `pnpm lint`, `pnpm tsc`, `pnpm --filter core test`, `pnpm --filter admin test`,
    `node scripts/check-openapi.mjs`, `pnpm --filter admin build` y
    `cd apps/android && ./gradlew :app:testDebugUnitTest :app:assembleDebug` en verde.
13. CI del PR (`admin`, `android`, `guard-secrets`, `commitlint`, `ai-docs`) en verde.
14. Revisión de tarea, QA con ojos nuevos y auditoría de seguridad sin críticos/altos abiertos.
15. El propietario acepta el APK y da la orden de merge.
16. El lanzador de módulos usa la **cuadrícula**, muestra **solo activos**, presenta el módulo
   como **logo** sobre tile sólido del acento y tarjeta teñida, con **texto legible en claro y
   oscuro**; no hay tarjetas «Próximamente».

## 10. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| El mockup A no se aprueba o cambia tarde | Se implementa una navegación que luego no encaja con OweNo y hay que rehacer pantallas | Puerta del mockup antes de código; F1 y F2 de la tarea 06 reutilizan el esqueleto; los cambios vuelven a la puerta. |
| La anon key expuesta se percibe como fuga | Documentar que es pública por diseño; el test verifica que no se filtra la service role; la auditoría lo revisa. |
| Keystore invalida la clave tras un cambio de bloqueo/biometría | Borrar sesión y pedir login; nunca caer a texto plano; test de descifrado fallido. |
| No hay cuenta de prueba en producción | Invitación temporal creada y canjeada por el propietario; purga al terminar; alternativa local con Supabase. |
| Staging está protegido por Vercel y la app no puede saltarlo | Aceptación contra producción con cuenta temporal o contra un `next start` local; no se pide desactivar la protección. |
| El propietario no tiene dispositivo Android | CI publica `apk-debug`; se puede usar un emulador; la aceptación final sigue siendo suya. |
| El esquema propio `027apps://` lo reclama otra app | Token de un solo uso, host mostrado antes de credenciales, web como camino principal; App Links para el dominio canónico. |
| El App Link no verifica en una instancia autoalojada | `assetlinks.json` sin fingerprints → la app cae al esquema propio o a la web; no se bloquea el alta. |
| El selector de idioma rompe la navegación al recrear la actividad | El estado de sesión vive fuera de la actividad; test de recreación y de locale inválido. |
| La librería supabase-kt cambia la firma de `SessionManager` | Versión fijada 3.9.0; el test de round-trip detecta regresiones al actualizar. |
| El cliente Ktor y supabase-kt arrastran versiones incompatibles | Ktor 3.6.0, la que declara el POM de supabase-kt 3.9.0; Gradle resuelve y el build lo verifica. |

## 11. Dependencias y puertas

- **Depende de:** nada implementado. Decisiones D1–D8 del propietario y el fingerprint de firma
  para App Links (`ANDROID_APP_SHA256`).
- **Puerta 1:** aprobar esta spec.
- **Puerta 2:** **aprobar el mockup A del esqueleto** (`docs/mockups/app-shell/`). Sin esta
  puerta no hay plan aprobado ni código de UI.
- **Puerta 3:** aprobar el plan (`2026-11-12-android-access-shell.md`).
- **Puerta 4:** confirmar URL por defecto, idioma inicial, fingerprint de firma y cuenta
  temporal.
- **Puerta 5:** aceptar el APK en un dispositivo.
- **Puerta 6:** orden explícita de merge a `staging`.
- **No incluye:** promoción a producción (PR `staging → main` aparte), release firmado ni tag.
