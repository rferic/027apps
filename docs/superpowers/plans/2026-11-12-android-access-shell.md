# Sprint 15 — App Android: mockup del esqueleto, acceso, sesión y shell (plan)

**Goal:** convertir la app Android en un cliente real: instancia, login con Supabase Auth,
sesión cifrada, shell con perfil y módulos, tema e idiomas. Sin pantallas de producto.
**Spec:** [`2026-11-12-android-access-shell.md`](../specs/2026-11-12-android-access-shell.md).
**Tarea:** [`task-01`](../../tasks/sprint-15-app-y-finanzas/task-01.md).

> **Este plan no se ejecuta de arriba abajo.** La fase 0 (mockup) es una puerta: hasta que el
> propietario apruebe el esqueleto, no se toca código de UI. Las partes A y B se implementan
> después, y la B debe corresponder con el mockup aprobado.

## Precondiciones (puertas)

- [ ] El propietario aprueba la spec.
- [x] **Mockup A aprobado** (2026-11-12): variante B, OweNo, logo F · Billete + Esmeralda.
- [ ] El propietario aprueba este plan.
- [ ] Confirma la URL de instancia por defecto (propuesta: `https://027apps.ericrf.com`).
- [ ] Entrega el **SHA-256 del certificado de firma** para App Links (`ANDROID_APP_SHA256`), o
      acepta que el deep link use solo el esquema propio hasta tenerlo.
- [ ] Confirma el idioma inicial de la invitación, el selector de idioma/tema en Ajustes y el
      fingerprint de firma para App Links.
- [ ] Prepara una cuenta temporal de aceptación (invitación → canje en navegador → login en la
      app). La contraseña no se comparte en el chat; se purga al terminar.
- [ ] Confirma que FCM, 3-2-1 y Storage siguen bloqueados.

## Paso 0 — Arranque

- [ ] Crear la rama del sprint `sprint/15-app-and-oweno` desde `staging` (o la rama de
      trabajo que indique el propietario). No trabajar en `main` ni `staging`.
- [ ] Poner `docs/tasks/sprint-15-app-y-finanzas/task-01.md` en `estado: en curso` al empezar
      el primer commit de implementación (no antes: este plan no es implementación).
- [ ] Confirmar que el árbol no arrastra cambios ajenos (hoy hay cambios sin commitear en
      `apps/admin/next.config.ts` y ficheros de lerd; no se mezclan con esta tarea).

## Fase 0 — Mockup A del esqueleto base (puerta)

**No se escribe código de UI antes de esta fase.** Es la puerta de diseño de la spec §6bis y
del DoD de Diseño.

### 0.1 Artefacto

- [ ] `docs/mockups/app-shell/index.html`: mockup navegable en HTML+JS con marcos de 390 px.
      Sin frameworks ni build: se abre en el navegador.
- [ ] `docs/mockups/app-shell/README.md`: inventario de pantallas, estados, decisiones de
      navegación, tokens y contraste; qué queda fuera.
- [ ] `docs/mockups/app-shell/app-shell.png` y `app-shell-dark.png`: capturas de revisión a
      390 px (claro y oscuro), con datos de demo.
- [ ] Reutilizar los tokens de `apps/admin/tokens.json` y la tipografía de la identidad D. Nada
      de hex libres; contraste AA comprobado en ambos modos.

### 0.2 Pantallas y estados (mínimo)

- [ ] Arranque: conexión automática con `027apps.ericrf.com`, sin pedir URL; error con reintento
      y enlace a «otra instancia». **Cambiar instancia** desde Ajustes: URL editable, aviso de
      cierre de sesión, URL inválida, instancia sin `auth`, `requires_setup`.
- [ ] Login: vacío, cargando, credenciales inválidas, rate limit, error de red, cuenta
      desactivada, host por defecto, enlace «Usar otra instancia», nota de invitación por deep
      link.
- [ ] Invitación (deep link): host, email, contraseña, token caducado/usado, email que no
      coincide, idioma inicial de la invitación.
- [ ] Home: **dashboard con host de widgets** (un widget de demo, no OweNo), vacío,
      cargando, error con reintento, pull-to-refresh; campana y FAB; sin selector global de
      grupo.
- [ ] Notificaciones: campana y estado vacío honesto (push bloqueado).
- [ ] Añadir (FAB): hoja de acciones de módulos.
- [ ] Ajustes: cuenta, host, **selector de idioma**, **selector de tema** (sistema/claro/
      oscuro), notificaciones, cerrar sesión, estado de cierre.
- [ ] Navegación: dos variantes (A: Inicio · OweNo · Ajustes; B: Inicio · Módulos · Ajustes),
      qué es pestaña/pantalla, botón atrás, y un hueco preparado para que la tarea 03 añada
      OweNo sin rediseñar la base.
- [ ] Claro y oscuro en todas las pantallas; foco visible; tamaños táctiles ≥ 48 dp; textos al
      200 % sin romper.

### 0.3 Revisión y puerta

```bash
open docs/mockups/app-shell/index.html
```

- [ ] El propietario recorre el mockup y pide cambios; se iteran en el HTML y los PNG.
- [ ] **Puerta:** el propietario aprueba el mockup A por escrito (sesión o PR). Sin esta
      aprobación no se implementa la Parte B.
- [ ] Si la aprobación cambia la navegación o el home, se actualiza la spec §6bis antes de
      seguir; F1 y F2 de la tarea 03 partirán de esta versión.

## Parte A — Core (API mínima para el cliente)

### A1. `theme` en la representación de usuario

- [ ] `packages/core/src/users/service.ts`: añadir `theme` a `UserView`, a `toView` (con
      fallback `system` si la fila de test no lo trae) y a los `select` de `listUsers` y
      `getUserFrom` (`p.theme`).
- [ ] Actualizar fixtures de `packages/core/src/users/service.test.ts` y `api.test.ts` para
      incluir `theme`.
- [ ] Tests: `getUser` y `listUsers` devuelven `theme`; un valor inválido en BD no rompe el
      tipo (el CHECK de `0022_profile_locale_check.sql` ya lo impide, pero el test de
      representación cubre el fallback).

### A2. `GET /api/v1/me`

- [ ] `packages/core/src/users/api.ts`: `meRoute(deps)` con `scopes: ["profile:read"]`,
      `rateLimit` de lectura y respuesta `{ user }`. El id sale de `caller.userId` (sesión o
      delegada); servicio/anon no llegan por el guard.
- [ ] `apps/admin/src/app/api/v1/me/route.ts`: ruta fina que llama a `meRoute` con
      `settingsDeps.db` y `withTransactionClient`.
- [ ] Tests en `packages/core/src/users/api.test.ts`: sesión propia, delegada propia, anon 401,
      service 403.

### A2bis. `PATCH /api/v1/me`

- [ ] `packages/core/src/users/api.ts`: `mePatchRoute(deps)` con `profile:write`, el id del
      llamante y `userPatchSchema` limitado a `display_name`, `locale` y `theme`; nunca `role`.
      Reutiliza `updateUser` con autoedición.
- [ ] `apps/admin/src/app/api/v1/me/route.ts`: exportar `PATCH`.
- [ ] OpenAPI y `docs/api/README.md`.
- [ ] Tests: autoedición, `role` rechazado, locale/theme inválidos, anon 401.

### A3. `GET /api/v1/me/modules`

- [ ] `packages/core/src/modules/api.ts`: `myModulesRoute(deps)` con `scopes: []` (solo
      autenticación), paginación y `listModules(..., {})`. Para no admin ya filtra activos +
      públicos/concedidos; para admin devuelve todos.
- [ ] `apps/admin/src/app/api/v1/me/modules/route.ts`: ruta fina con `modulesRouteDeps()`.
- [ ] Tests en `packages/core/src/modules/api.test.ts`: usuario con módulo público, con grant
      privado, sin grant (no aparece), admin (todos), anon 401.

### A4. Bloque `auth` en `GET /api/v1/instance`

- [ ] `packages/core/src/instance/api.ts`: añadir
      `authConfig?: { supabaseUrl: string; supabaseAnonKey: string } | null` a
      `InstanceRouteDeps`; incluir `auth` en la respuesta (`null` si no hay).
- [ ] `apps/admin/src/app/api/v1/instance/route.ts`: construir `authConfig` desde
      `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`; nunca leer ni exponer
      `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] Test nuevo `packages/core/src/instance/api.test.ts`: `auth` presente, `auth: null`,
      `settings_public` intacto, sin service role en el JSON serializado.

### A4bis. `/.well-known/assetlinks.json` (App Links)

- [ ] `apps/admin/src/app/.well-known/assetlinks.json/route.ts`: lee
      `ANDROID_APP_SHA256` (lista separada por comas), responde `[]` si no hay, con
      `content-type: application/json` y caché de 1 h. Solo fingerprints públicos; nunca el
      keystore ni la service role.
- [ ] Test de la ruta: con fingerprints, vacío, content-type, sin secretos.
- [ ] Documentar el env en `docs/infrastructure.md` o `docs/flows/cicd.md`.

### A5. OpenAPI, docs y contrato

- [ ] `packages/core/src/openapi/registry.ts` y `schemas.ts`: operaciones `/me` (GET/PATCH),
      `/me/modules` y bloque `auth` en `instanceResponseSchema`.
- [ ] `pnpm --filter core openapi:generate`.
- [ ] `docs/api/README.md`: marcar `/me` y `/me/modules` como implementadas; documentar
      `PATCH /me`, `auth.supabase_url`/`auth.supabase_anon_key` y que la anon key es pública.
- [ ] `node scripts/check-openapi.mjs` en verde.

### A5bis. Locale inicial de la invitación

- [ ] `packages/core/src/invitations/service.ts`: el perfil nuevo usa `invitation.locale` en
      vez del default de la instancia; fallback al default si no es válido.
- [ ] Test: invitación `ca` → perfil `ca`; `en` → `en`; el default no pisa.
- [ ] `PATCH /me` permite cambiarlo después.

### A6. Verificación del Core

```bash
pnpm --filter core test
pnpm --filter admin test
pnpm --filter core openapi:generate
node scripts/check-openapi.mjs
pnpm lint
pnpm tsc
pnpm --filter admin build
```

- [ ] Salida leída; sin fallos ni tests omitidos sin motivo.

## Parte B — App Android

### B1. Gradle y dependencias

- [ ] `apps/android/gradle/libs.versions.toml`: versiones `supabase = "3.9.0"`, `ktor =
      "3.6.0"`, `serialization = "1.13.0"`, `coroutines = "1.11.0"`, `navigation = "2.10.2"`,
      `lifecycle = "2.11.0"`; librerías `auth-kt`, `ktor-client-okhttp`,
      `ktor-client-content-negotiation`, `ktor-serialization-kotlinx-json`,
      `kotlinx-serialization-json`, `navigation-compose`, `lifecycle-viewmodel-compose`,
      `lifecycle-runtime-compose`, `ktor-client-mock`, `kotlinx-coroutines-test`; plugin
      `kotlin-serialization`.
- [ ] `apps/android/build.gradle.kts`: aplicar el plugin de serialización como `apply false`.
- [ ] `apps/android/app/build.gradle.kts`: aplicar `alias(libs.plugins.kotlin.serialization)`;
      `buildFeatures { compose = true; buildConfig = true }`; `buildConfigField("String",
      "DEFAULT_INSTANCE_URL", ...)` con propiedad Gradle `defaultInstanceUrl` y valor por
      defecto de producción; dependencias de implementación y test.
- [ ] `./gradlew :app:assembleDebug` compila antes de escribir pantallas (verde temprano).

### B2. Tokens y tema

- [ ] `ui/theme/Tokens.kt`: paletas claro/oscuro desde `apps/admin/tokens.json` (identidad D).
      Único fichero con hex.
- [ ] `ui/theme/Theme.kt`: `Zero27AppsTheme(theme: ThemePreference)` con
      `lightColorScheme`/`darkColorScheme`; mapea `background`, `surface`, `primary`, `accent`,
      `border`, `destructive`, `success`.
- [ ] Test `TokensTest`: lee `apps/admin/tokens.json` desde `user.dir` (probar
      `../../admin/tokens.json` y `../admin/tokens.json`) y compara los hex de claro/oscuro.

### B3. Instancia por defecto y cambio

- [ ] `ServerUrl.kt`: `normalize(raw, requireHttps)`; rechaza `userinfo`, query, fragment,
      esquemas no HTTP(S), host vacío; normaliza barras finales. En release exige HTTPS; en
      debug permite `localhost`, `127.0.0.1` y `10.0.2.2` por HTTP.
- [ ] `InstanceStore.kt`: si no hay URL guardada, devuelve `BuildConfig.DEFAULT_INSTANCE_URL`
      (`https://027apps.ericrf.com`); no hay pantalla de URL en el primer arranque. Guarda el
      override solo cuando el usuario lo cambia; `clear()` al cambiar de instancia.
- [ ] `SplashScreen`: valida `/instance` con la URL por defecto; si falla, reintento y enlace
      discreto a «otra instancia».
- [ ] `ChangeInstanceScreen` (desde Ajustes y desde el login): aviso de cierre de sesión y
      borrado local; al guardar, `signOut`, borrar sesión/datos y volver al login.
- [ ] Tests `ServerUrlTest`: HTTPS release, HTTP local debug, HTTP remoto rechazado,
      `userinfo`/query/fragment rechazados, barras. `InstanceStoreTest`: default si vacío,
      override persistido, `clear()` al cambiar.

### B4. Sesión cifrada

- [ ] `auth/SecretCipher.kt` (interfaz: `encrypt(plain: ByteArray): ByteArray`,
      `decrypt(data: ByteArray): ByteArray`).
- [ ] `auth/KeystoreSecretCipher.kt`: clave AES-256-GCM en AndroidKeyStore (alias
      `027apps_session`), IV aleatorio por cifrado, `iv || ciphertext`, Base64 en
      `SharedPreferences` `027apps_session`. Si el descifrado falla, borra y propaga «no
      session».
- [ ] `auth/EncryptedSessionManager.kt`: implementa `SessionManager` de supabase-kt con
      `Json { encodeDefaults = true; ignoreUnknownKeys = true }`.
- [ ] `auth/SupabaseFactory.kt`: crea `createSupabaseClient(supabaseUrl, anonKey) {
      install(Auth) { sessionManager = encryptedSessionManager } }`; `close()` al cambiar de
      instancia.
- [ ] Tests `EncryptedSessionManagerTest` con un `SecretCipher` falso: round-trip, JSON con
      defaults, sesión corrupta, `deleteSession`, no hay texto plano en el almacén.

### B4bis. Invitación por deep link

- [ ] `AndroidManifest.xml`: intent filter para `https://027apps.ericrf.com/invite/...` (App
      Link, `autoVerify`) y para `027apps://invite` (esquema propio). No aceptar `http`.
- [ ] `auth/InvitationLink.kt`: parsea el link, valida host HTTPS (release), extrae token e
      instancia; rechaza host ausente o esquema raro; no registra el token.
- [ ] `auth/InvitationRepository.kt`: `GET /api/v1/instance` de la instancia del link →
      `POST /api/v1/invitations/{token}/redeem` con email+password → login Supabase → `/me`.
- [ ] `ui/screens/InviteScreen.kt`: host, email, contraseña, errores `invitation_expired`/
      `invitation_used`/email distinto; `FLAG_SECURE` en la actividad.
- [ ] Web `/invite/<token>`: mantener el alta en navegador y añadir «Descargar app» (GitHub
      Releases o «próximamente» sin release); el token no se pierde. Sin deferred deep link.
- [ ] Tests `InvitationLinkTest` e `InviteViewModelTest`: App Link, esquema propio, host
      inválido, token caducado/usado, email distinto, no log del token.
- [ ] `assetlinks.json` verificado en el preview (o fallback al esquema propio si no hay
      fingerprint).

### B5. Cliente API y DTOs

- [ ] `data/Dtos.kt`: `InstanceResponse`, `AuthConfig`, `MeResponse`, `UserDto`,
      `MyModulesResponse`, `ModuleDto`, `ErrorEnvelope`.
- [ ] `data/ApiError.kt`: enum/mapeo por `code` (ADR 0007); mensajes localizados; error de red
      separado.
- [ ] `data/ApiClient.kt`: Ktor OkHttp, `ContentNegotiation(json)`, `baseUrl`, token de
      Supabase, reintento único ante 401 con `refreshCurrentSession()`; timeouts 10/20 s;
      logging desactivado.
- [ ] Tests `ApiClientTest` con `MockEngine`: parseo de `/instance`, `/me`, `/me/modules`;
      envelope de error; 401 → refresh → reintento; segundo 401 → logout; JSON desconocido
      ignorado.

### B6. Estado y viewmodels

- [ ] `ui/AppState.kt`: `Loading`, `NeedsInstance`, `NeedsLogin(instance)`,
      `SignedIn(instance, user, modules)`, `Failure(message)`.
- [ ] `ui/AppViewModel.kt`: arranque (leer instancia → `/instance` → crear Supabase → cargar
      sesión/perfil/módulos), login, logout, cambiar instancia, refrescar home. Detrás de
      interfaces `AuthGateway` y `ApiGateway` para poder probarlo en JVM sin Android.
- [ ] `ui/screens/*ViewModel.kt` si hace falta separar login/home/ajustes; sin DI framework.
- [ ] `ui/SettingsViewModel.kt`: idioma (locale del perfil) y tema se guardan con `PATCH /me`;
      si falla, revierten; al cambiar el idioma se recrea la actividad.
- [ ] `ui/NotificationsViewModel.kt`: estado vacío (sin endpoint de eventos en v1); no inventa
      datos.
- [ ] `ui/AddSheetViewModel.kt`: acciones de los módulos; OweNo se conecta en la tarea 03.
- [ ] Tests `AppViewModelTest` con fakes: sin instancia, instancia sin `auth`, sin sesión,
      sesión válida, logout, error de red con reintento, 401 persistente.

### B7. Pantallas Compose

- [ ] `MainActivity.kt`: `setContent { Zero27AppsApp() }`; sin la pantalla manual de FCM.
- [ ] `ui/App.kt`: `NavHost` con `instance`, `login`, `home`, `settings`; tema y
      `Locale` del sistema.
- [ ] `ui/screens/SplashScreen.kt`, `LoginScreen.kt`, `InviteScreen.kt`, `HomeScreen.kt`,
      `NotificationsScreen.kt`, `SettingsScreen.kt`, `ChangeInstanceScreen.kt`, `AddSheet.kt`,
      `ModuleLauncher.kt`, `ModuleComingSoon.kt`.
- [ ] `SplashScreen`: arranque con la instancia por defecto; no pide URL.
- [ ] `HomeScreen`: dashboard con host de widgets, campana y FAB; sin selector global de grupo.
- [ ] `ModuleLauncher`: **cuadrícula** (elegida); solo módulos activos; **logo** grande sobre
      tile sólido del **acento del módulo** (`branding.color`) y **tarjeta teñida** (6 %, borde
      22 %); `color: foreground` en tile/fila/destacado para que el texto se lea en oscuro; sin
      «Próximamente»; estado vacío. Lista/Destacado no se implementan como preferencia.
- [ ] `SettingsScreen`: fila «Instancia» que abre `ChangeInstanceScreen`; selectores de idioma y
      tema; cerrar sesión; nota de sesión persistente.
- [ ] `ChangeInstanceScreen`: aviso de cierre de sesión y borrado local; guardar → login.
- [ ] `NotificationsScreen`: estado vacío honesto; no promete push.
- [ ] `AddSheet`: acciones de módulos; OweNo aporta «Gasto» en la tarea 03.
- [ ] Estados de carga/error/vacío; reintento; `contentDescription`; tamaños táctiles ≥ 48 dp.
- [ ] **La UI corresponde con el mockup A aprobado, variante B** (`Inicio · Módulos · Ajustes`;
      OweNo dentro de Módulos): navegación, jerarquía, espaciado, tokens y estados. Cualquier
      desviación se anota en la revisión; no se cambia el diseño sobre la marcha sin volver a la
      puerta.

### B7bis. Host de widgets del dashboard

- [ ] `ui/dashboard/DashboardWidget.kt`: modelo genérico (`moduleKey`, `type`, `title`, `icon`,
      `order`, `metrics`, `rows`, `link`); sin HTML ni rutas arbitrarias.
- [ ] `ui/dashboard/WidgetRenderer.kt`: render nativo de los tipos `summary`, `list` y `metric`
      con tokens del DS; tipo desconocido → tarjeta genérica «abrir módulo» o se ignora.
- [ ] `ui/dashboard/DashboardScreen.kt`: pila vertical de widgets ordenada por `order`; estado
      vacío honesto; refresco; sin selector global de grupo.
- [ ] `ui/dashboard/WidgetSource.kt`: interfaz + `DemoWidgetSource` para el mockup/prueba de la
      tarea 01. El `ApiWidgetSource` que consume `GET /me/dashboard` se conecta cuando la tarea
      02 cierre el contrato (D10); no se inventa el endpoint antes.
- [ ] Tests JVM: orden de widgets, tipo desconocido, vacío, datos incompletos, sin HTML.
- [ ] La UI del host corresponde con el mockup A (widget de demo incluido).

### B8. i18n

- [ ] `res/values/strings.xml` (inglés) con todas las cadenas.
- [ ] `res/values-es/strings.xml`, `values-ca`, `values-de`, `values-eu`, `values-fr`,
      `values-gl`, `values-it`, `values-pt`; mismas claves, placeholders idénticos. El
      traductor puede paralelizar por locale; el inglés no se cambia.
- [ ] Override de locale en `attachBaseContext` (`createConfigurationContext`), con el locale
      del perfil; fallback al sistema si no es válido. Al cambiarlo en Ajustes se recrea la
      actividad y se guarda con `PATCH /me`.

### B9. FCM y seguridad del manifest

- [ ] Retirar de `FcmRegistrar` la pantalla/ruta de configuración manual y la propiedad
      `sessionToken`; conservar `FcmConfig`, `PushMessagingService` y
      `initializeFromStorage`. `PushMessagingService.onNewToken` deja de llamar a
      `registerToken` con un JWT: guarda el token en una preferencia `pending_push_token` para
      que la tarea de FCM lo registre cuando exista sesión.
- [ ] `AndroidManifest.xml`: `android:allowBackup="false"`; `usesCleartextTraffic="false"`.
- [ ] `src/debug/AndroidManifest.xml` (ya existe): mantener `usesCleartextTraffic="true"` solo
      en debug y actualizar el comentario, que hoy habla solo del arnés de FCM.
- [ ] No registrar el dispositivo en v1; dejar el punto de extensión documentado para la tarea
      de FCM.
- [ ] Actualizar `docs/flows/fcm-validation.md`: el Paso 6 (pantalla manual con JWT pegado) ya
      no existe; el runbook queda **bloqueado** hasta que la tarea de FCM integre el registro
      del dispositivo en la sesión autenticada. No dejar instrucciones que apunten a una
      pantalla eliminada.

### B10. Tests Android

```bash
cd apps/android
./gradlew :app:testDebugUnitTest :app:assembleDebug
```

- [ ] `ServerUrlTest`, `EncryptedSessionManagerTest`, `ApiClientTest`, `AppViewModelTest`,
      `InvitationLinkTest`, `InviteViewModelTest`, `LocaleTest`, `SettingsViewModelTest`,
      `DashboardHostTest`, `TokensTest` en verde.
- [ ] `FcmConfigTest` y `ServerUrlTest` existentes siguen pasando (adaptar `ServerUrlTest` a la
      nueva firma).

## Verificación completa antes de `test`

```bash
pnpm lint
pnpm tsc
pnpm --filter core test
pnpm --filter admin test
pnpm --filter core openapi:generate
node scripts/check-openapi.mjs
pnpm --filter admin build
cd apps/android && ./gradlew :app:testDebugUnitTest :app:assembleDebug
```

- [ ] Salida leída y adjunta al informe de la tarea; no se afirma «pasa» sin ella.
- [ ] `git status` sin secretos, `.env*`, keystores ni artefactos.
- [ ] `docs/ai/landing.md`: actualizar la fila «App Android» del catálogo, que hoy dice «solo
      configuración de FCM»; pasa a «in-development (acceso y shell; pantallas de producto
      pendientes)». No se toca el copy público ni las maquetas: la app sigue «en desarrollo»
      hasta la tarea 04.

## Verificación de diseño (contra el mockup A)

- [ ] Captura la app real en las mismas pantallas/estados del mockup y compárala lado a lado
      (claro y oscuro). Las diferencias son hallazgos, no «ajustes de implementación».
- [ ] Contraste AA en ambos modos con los tokens de `apps/admin/tokens.json`; sin hex fuera de
      `Tokens.kt`.
- [ ] Textos al 200 % y tamaños táctiles ≥ 48 dp; foco visible; `contentDescription`.
- [ ] Los 9 idiomas no rompen la maqueta (los textos alemanes/franceses son más largos).
- [ ] El hueco para OweNo en la navegación queda preparado sin cambiar el esqueleto.

## Aceptación manual (propietario)

- [ ] Instalar el `apk-debug` del CI o el generado en local.
- [ ] Abrir la app: **no pide URL**, conecta con `027apps.ericrf.com` y va al login; entrar con
      la cuenta temporal.
- [ ] Ajustes → Instancia: comprobar el aviso, cancelar y volver; no se pierde la sesión.
- [ ] Abrir una invitación de prueba por deep link; canjear y entrar; comprobar el idioma
      inicial de la invitación.
- [ ] Abrir el mismo enlace en un móvil sin la app: la web muestra el alta y «Descargar app»
      (o «próximamente» si no hay release); el token sigue en la URL.
- [ ] Ver el dashboard con widgets; matar y reabrir; sigue dentro.
- [ ] Cambiar tema e idioma desde Ajustes; comprobar claro/oscuro, 9 idiomas y persistencia.
- [ ] Abrir la campana (vacía) y el FAB (hoja de añadir).
- [ ] Inspeccionar `shared_prefs` (o un backup): no hay token legible.
- [ ] Cerrar sesión; reabrir; pide login.
- [ ] Probar URL inválida, contraseña incorrecta, invitación caducada y modo avión.
- [ ] **Comparar la app con el mockup A aprobado, variante B**, y aceptar la correspondencia
      visual.
- [ ] Purga de la cuenta temporal (desactivar + purgar en el panel).

## Revisión, QA y auditoría de seguridad

- [ ] Revisor de tarea (distinto del autor) contra spec y plan; hallazgos corregidos o
      rechazados con motivo.
- [ ] QA con ojos nuevos: estados límite (sin red, 401, instancia sin auth, Keystore
      invalidado), accesibilidad, i18n.
- [ ] Auditoría OWASP incondicional con `docs/conventions/security-checklist.md`: A01 (authz de
      `/me`), A02 (tokens, anon key, logs, backup), A03 (URLs/JSON), A05 (dependencias),
      A07 (sesión/refresh/revocación), A09 (logs). Además: deep link (token de un solo uso,
      host mostrado, `assetlinks.json` sin secretos, esquema propio), `PATCH /me` sin escalada
      de rol y locale/theme validados. Críticos/altos bloquean.
- [ ] Informe escrito en la tarea/PR.

## Rollback

- [ ] Revertir el commit de la tarea en la rama del sprint; la app anterior (pantalla FCM)
      vuelve a estar disponible, aunque mantiene el token en texto plano: el rollback no debe
      quedarse en producción más de lo necesario.
- [ ] No hay migraciones de BD en esta tarea; el rollback es solo código.
- [ ] Si el problema es la exposición de `auth` en `/instance`, revertir la ruta y el bloque
      `auth` juntos; la app de esa versión no podrá iniciar sesión (falla cerrado, no en
      claro).

## Puertas de usuario (resumen)

| # | Cuándo | Qué decide |
|---|---|---|
| 1 | Antes de implementar | Aprueba la spec. |
| 2 | **Antes de implementar UI** | **Aprueba el mockup A del esqueleto** (`docs/mockups/app-shell/`); la variante B ya está elegida. |
| 3 | Antes de implementar | Aprueba el plan. |
| 4 | Antes de implementar | URL por defecto, idioma inicial, cuenta temporal y **fingerprint de firma** para App Links. |
| 5 | Tras CI | Acepta el APK en un dispositivo y su correspondencia con el mockup; prueba la invitación por deep link. |
| 6 | Antes de cerrar | Publica una release con APK o acepta que «Descargar app» muestre «próximamente». |
| 7 | Tras revisión/auditoría | Orden explícita de merge a `staging`. |
| 8 | Después | Promoción `staging → main` como PR aparte, con su orden. |
