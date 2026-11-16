# Sprint 16 — Invitación, sesión y migración de teléfono (plan)

**Goal:** aceptar una invitación en la app con los datos precargados o en la web sin bucles,
mantener la sesión hasta que el usuario salga o sea expulsado, recuperar la contraseña y mover la
cuenta a un teléfono nuevo por QR, todo con i18n, OpenAPI y auditoría.
**Spec:** [`2026-11-16-invitation-session-migration-design.md`](../specs/2026-11-16-invitation-session-migration-design.md).
**Revisión pre-implementación:** [`pre-implementation-review.md`](../../tasks/sprint-16-invitation-session-and-migration/pre-implementation-review.md).
**Tareas:** [`docs/tasks/sprint-16-invitation-session-and-migration/`](../../tasks/sprint-16-invitation-session-and-migration/README.md).
**Rama:** `sprint/16-invitation-session-and-migration` (desde `origin/staging`).
**PR:** uno, draft contra `staging`, desde el primer commit.

> **No se ejecuta de arriba abajo.** La aprobación de la spec (P1) y los mockups (P2) son puertas.
> La tarea 01 (estos documentos) termina aquí; la 02 produce los mockups; el código empieza en la
> 03, y la UI de la app/wizard/QR/reset espera a que P2 esté aceptado. Cada tarea tiene su propia
> aceptación; no hay una única aceptación al final.

## 0. Precondiciones y puertas

- [x] **P1** El propietario aprueba la spec y este plan (incluidas D1–D20) — 2026-11-16.
- [x] **P1.5** El propietario acepta la revisión pre-implementación y resuelve **D21**:
      **sesión primero** (la app y la web firman antes de canjear; el Core valida la sesión y no
      verifica contraseñas) — 2026-11-16.
- [ ] **P2** El propietario aprueba los mockups de `docs/mockups/invitation-flow/` (app, wizard,
      QR y reset) antes de escribir UI nueva.
- [x] **P10** El propietario confirma que «Time-box user sessions» e «Inactivity timeout» no se
      activaron en `027apps-dev` ni `027apps-prod` (valores por defecto: off) — 2026-11-16. La
      prueba real de sesión sin usar la app lo valida en la tarea 11.
- [ ] **P3** `ANDROID_APP_SHA256` en Vercel Production (y Preview si se prueba) con
      `00:6A:22:FA:7A:A4:76:A5:5D:B7:C4:62:2E:FF:19:3F:76:4F:66:10:A3:6D:9C:D1:DF:CE:C8:03:AE:A1:39:C6`,
      y redeploy. Verificar `curl https://027apps.ericrf.com/.well-known/assetlinks.json`.
- [ ] **P4** Un dispositivo Android real para App Links; dos para el QR.
- [ ] **P5** Confirmar `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME` y
      `instance.public_url` en producción (la recuperación usa el email propio).
- [ ] **P6** Confirmar D1–D20 (A1, localización del login, rol de cuenta existente, escáner, etc.).
- [ ] **P7** Orden explícita de merge del sprint 16 (y del 17) y **P8** de promoción.
- [ ] Confirmar que el árbol no arrastra cambios ajenos; el worktree es
      `/Users/ericrf/orca/workspaces/027apps/sprint-16-invitation-session-and-migration`.
- [ ] `pnpm install --frozen-lockfile` en el worktree (este checkout no trae `node_modules`).
- [ ] `codegraph init .` en el worktree si se usa navegación estructural (opcional; no es un gate).

## Reglas de ejecución

1. **TDD**: primero el test que falla (rojo), luego el mínimo para verde, luego refactor. Los tests
   de regresión de un bug fijan el comportamiento antes del fix.
2. **Una tarea, un commit (o varios pequeños)**: `tipo(ámbito): asunto en inglés`, Conventional
   Commits. El PR se actualiza solo.
3. **Sin código de producto sin spec aprobada y sin mockup para la UI nueva.**
4. **zod en todos los bordes** (rutas, server actions, formularios); los tipos inferidos dentro.
5. **Colores solo por tokens**; superficies de página según `code-style.md`; texto en inglés como
   clave i18n.
6. **Nada se anuncia sin evidencia**: la salida de los comandos se pega en la tarea/PR.
7. **Secretos**: nunca en git, logs ni chat. Los gates P3/P5 los ejecuta el propietario en Vercel.
8. **Auditoría de seguridad** por un agente distinto del autor antes de `finalizada` (tarea 11).

## Tarea 01 — Documentación del sprint (este entregable)

**Objetivo:** dejar el sprint, la spec, el plan y las tareas listos para aprobar; sin código.

### 01.1 Archivos

- [x] `docs/superpowers/specs/2026-11-16-invitation-session-migration-design.md`.
- [x] `docs/superpowers/plans/2026-11-16-invitation-session-migration.md` (este).
- [x] `docs/tasks/sprint-16-invitation-session-and-migration/README.md` y `task-01…11.md`.
- [x] `docs/tasks/sprint-16-invitation-session-and-migration/pre-implementation-review.md`
      (revisión de seguridad y UX del planteamiento, con D21).
- [x] `docs/tasks/sprint-17-panel-y-notificaciones/README.md` (plan anterior preservado).
- [x] `docs/tasks/README.md` (filas 16 y 17; nota de renumeración).
- [x] `docs/tasks/backlog.md` (la nota del sprint 16 pasa al 17).
- [x] Nota «superseded by» en `docs/superpowers/specs/2026-11-07-invitation-redemption-design.md`.

### 01.2 Verificación (docs)

- [ ] `git diff --check` sin espacios sobrantes.
- [ ] Rutas y ficheros citados existen (o se marcan como «se crearán»).
- [ ] Revisión por un segundo agente (DoD de Docs) y corrección de hallazgos.
- [ ] El propietario aprueba la spec y el plan (P1); entonces `task-01` pasa a `finalizada`.

**Aceptación:** el propietario puede leer la spec, el plan y las 11 tareas y aprobar o pedir
cambios; no se ha escrito código de producto.

---

## Tarea 02 — Mockups (diseño, puerta P2)

**Objetivo:** que el propietario recorra y apruebe las pantallas antes de implementar. Sin código
de producto.

### 02.1 Entregables

- [ ] `docs/mockups/invitation-flow/index.html` (HTML+JS, 390 px app y web, claro y oscuro) con:
  - app: invitación cargando, cuenta nueva (email/nombre/instancia/invitador/caducidad/rol
    bloqueados + contraseña + confirmación), cuenta existente (solo contraseña actual), caducada,
    usada, inválida, error de red, canje ok y login fallido, aviso de sesión revocada;
  - web: paso 1 aviso Android 8+, paso 2 descarga, paso 3 reintento (con fallback), paso 4
    formulario; variantes Android/iPhone/escritorio con QR; estados caducada/usada/inválida;
  - QR: pantalla del viejo (QR + cuenta atrás + FLAG_SECURE conceptual) y del nuevo (escáner +
    «cierra sesión primero» + éxito);
  - reset: login con «¿Olvidaste tu contraseña?», solicitud, email (9 idiomas), confirmación,
    nueva contraseña, aviso de éxito.
- [ ] `docs/mockups/invitation-flow/README.md`: pantallas, estados, copy, tokens, contraste AA,
      decisiones y qué queda fuera.
- [ ] Capturas PNG a 390 px y 1440 px (claro/oscuro) para revisión rápida.
- [ ] Tokens de `apps/admin/tokens.json`; nada de hex libres.

### 02.2 Puerta

- [ ] `open docs/mockups/invitation-flow/index.html` y recorrido del propietario.
- [ ] **P2**: aprobación escrita. Si cambia el flujo, se actualiza la spec antes de implementar.

**Aceptación:** mockups aprobados; las tareas 06, 07, 08 y 10 pueden empezar su UI.

---

## Tarea 03 — Ciclo de sesión (web + app + proxy)

**Objetivo:** que la sesión solo termine por logout o expulsión, y que el panel no entre en bucle.

### 03.1 Web

- [ ] `apps/admin/src/app/(auth)/actions.ts`: `signOutAction` usa
      `supabase.auth.signOut({ scope: "local" })`; constante exportada para el test.
- [ ] `apps/admin/src/app/logout/route.ts`: route handler GET, mismo origen, `signOut({ scope:
      "local" })`, redirect a `/login?reason=…`. Rechaza `Sec-Fetch-Site: cross-site`.
- [ ] `apps/admin/src/lib/panel-guard.ts`: `loadPanelIdentity()` devuelve
      `anonymous | unusable | user`; `requirePanel` manda `unusable` a
      `/logout?reason=access_revoked` (no a `/login`).
- [ ] `apps/admin/src/lib/instance-gate.ts`: sin cambios de contrato; añadir test de que
      `/logout` no está gateado y de que `/login` con sesión válida sigue yendo a `/panel`.
- [ ] `apps/admin/src/proxy.ts`: extraer `refreshSessionOutcome()` a
      `apps/admin/src/lib/session-refresh.ts`:
      - `ok` → sigue;
      - `invalid` (`invalid_grant`, `session_not_found`, 400/401) → limpia cookies y login;
      - `unavailable` (red/timeout/5xx) → 503 con `Retry-After: 30`, **sin** borrar cookies.
      Aplicar a páginas gateadas y a `/api/v1` autenticado; las públicas siguen sin Supabase.
- [ ] `apps/admin/src/lib/public-paths.ts`: sin cambios en esta tarea (las rutas nuevas llegan en
      07/08/10).
- [ ] Tests: `session-refresh.test.ts` (tres resultados), `panel-guard.test.ts` (tres casos),
      `logout-route.test.ts` (mismo origen), `actions.test.ts` (scope local), `proxy` (503 sin
      `Set-Cookie` de borrado).

### 03.2 Core / revocación

- [ ] `packages/core/src/users/service.ts`: `UsersDeps.onDeactivated?: (userId) => Promise<void>`;
      `deactivateUser` lo llama tras el commit, mejor esfuerzo (un fallo no revierte la baja).
- [ ] `apps/admin/src/app/api/v1/users/[id]/route.ts`: cablear `onDeactivated` a
      `delete from auth.sessions where user_id = $1` (pool de servicio).
- [ ] Test de unidad con spy: se llama una vez; si lanza, la baja sigue devolviendo el perfil.
- [ ] `packages/core/src/devices/service.ts` y `api.ts`:
      `revokeDevice(deps, caller, id, { revokeSessions: boolean })`; `DELETE /devices/{id}?sessions=all|local`
      (`all` por defecto, `local` solo el dueño; un admin sobre otro fuerza `all`). El panel sigue
      sin query; el móvil usa `local`.
- [ ] `packages/core/src/openapi/{registry,schemas}.ts`: query `sessions` del `DELETE /devices/{id}`.
- [ ] Tests: `all` llama `revokeSessions`; `local` no; dueño `local`; admin `local` sobre otro →
      `all`; panel sin query → `all`.
- [ ] `purgeUser` sigue borrando `auth.users` (cascada); test de regresión existente.

### 03.3 App

- [ ] Documentar el modelo de sesión en el código: access token de 15 min + refresh token durable
      en el Keystore; la app **no guarda la contraseña**; la rotación persiste el token nuevo; el
      access token caducado solo obliga a renovar. P10 confirmado por el propietario (sin
      time-box/inactivity); la prueba real de la tarea 11 lo valida.
- [ ] `apps/android/.../data/ApiClient.kt`: `RefreshResult` sellado (`Refreshed`, `NoSession`,
      `Network`); `request` mapea 401 a `unauthorized` con `revoked` o a error de red.
- [ ] `apps/android/.../ui/AppViewModel.kt`:
      - `boot()` clasifica `awaitInitialization`, un refresco inicial, `me()`, 401 y red/5xx;
      - `FailureReason` añade `SERVER`; `Offline`/`Failure` conservan la sesión;
      - `NeedsLogin(instance, reason)` para `revoked`, `invitation_accepted`, `password_reset`;
      - `signOut()` y `changeInstance()` con `SignOutScope.LOCAL`;
      - `FcmRegistrar.revoke()` usa `DELETE /devices/{id}?sessions=local` (no cierra la web).
- [ ] `LoginScreen`: muestra el aviso de `reason`; botón «Reintentar» en el estado de red y copy
      «Sin conexión. Tu sesión sigue guardada.» (no pedir login por red).
- [ ] Tests: `ApiClientTest` (MockEngine: 401→refreshed, 401→revoked, red), `AppViewModelTest`
      (sin sesión, válida, 401, red, 5xx, desactivado), `SessionScopeTest` (LOCAL).

### 03.4 Aceptación

- [ ] Logout web no cierra el móvil; logout móvil no cierra la web (verificado en dispositivo y
      navegador).
- [ ] Reinicio, actualización y modo avión conservan la sesión; el reintento entra al volver la red.
- [ ] La app sin usar mucho tiempo sigue entrando con el refresh token (sin volver a pedir la
      contraseña), con P10 confirmado.
- [ ] Un perfil desactivado va a `/logout` → `/login` sin bucle; el móvil recibe 401 y limpia.
- [ ] `pnpm lint && pnpm tsc && pnpm test` y `./gradlew :app:testDebugUnitTest`.

---

## Tarea 04 — Contrato de invitación: preview (A2), rol (A6), cuenta existente (A7)

**Objetivo:** que web y app reciban todos los datos y estados antes de construir los formularios.

### 04.1 Migración y Core

- [ ] `supabase/migrations/0035_invitation_role_ttl.sql` (spec §5.1).
- [ ] `packages/core/src/invitations/service.ts`:
      - `InvitationRole = "user" | "admin"`;
      - `InvitationView` + `role`, `expires_in_days`;
      - `createInvitation` valida rol y duración; guard `super_admin` para `admin`; guarda
        `expires_in_days`; **elimina** el rechazo `email_registered`;
      - `redeemInvitation` usa el nombre de la invitación (ignora `display_name`), verifica la
        contraseña existente y crea el perfil con el rol; conserva nombre/rol/contraseña del
        existente;
      - `previewInvitation(deps, token)` (spec §6.2);
      - `renewInvitation` (spec §6.5) — aunque el panel se cablee en la tarea 09, el servicio y sus
        tests entran aquí.
- [ ] `redeemInvitation` recibe el `Caller` y exige una **sesión del mismo usuario** para una
      cuenta existente; no verifica contraseñas. El adaptador de Auth **no** necesita
      `verifyPassword`; se queda con `findUserByEmail`, `createUser` y `deleteUser`.
- [ ] `redeemInvitationRoute` usa el resolvedor de auth real (no `anon` fijo): un anónimo canjea
      una cuenta nueva; una cuenta existente exige el Bearer de su sesión.
- [ ] `packages/core/src/errors.ts`: `existing_account_signin_required`,
      `invitation_not_expired` (y retirar `invitation_password_invalid`).
- [ ] `packages/core/src/invitations/api.ts`: schemas de preview/create/redeem/renew; el email
      existente se permite; `account_exists` en la respuesta de creación; `role` en redeem; el
      `password` es opcional para una cuenta existente con sesión.
- [ ] `packages/core/src/email/{types,catalog,invitation}.ts`: `accountExists` y `role`; variantes
      de copy en 9 idiomas; asunto con `instance.name`; nota «tu contraseña no cambia».
- [ ] `apps/admin/src/lib/email/invitation-mailer.ts`: pasa `accountExists` y `role`; el route de
      creación/resend/renew calcula `accountExists`.

### 04.2 Panel

- [ ] `apps/admin/src/components/invitation-create-form.tsx`: selector de rol visible solo a
      `super_admin` (`canInviteAdmin`), por defecto `user`; el body envía `role`.
- [ ] `apps/admin/src/app/(panel)/panel/invitations/{page,[id]}`: muestra el rol y
      `account_exists` en la respuesta de creación; sin cambios de superficie.
- [ ] Si el email ya existe, el panel no bloquea; el mensaje de éxito lo explica.

### 04.3 OpenAPI

- [ ] `packages/core/src/openapi/registry.ts` y `schemas.ts`: preview, renew, `invitationCreate`
      con rol, `invitationView` con `role`/`expires_in_days`, `redeemResult` con `role`.
- [ ] `pnpm --filter core openapi:generate`; `pnpm check:openapi`.

### 04.4 Tests

- [ ] Core: preview (5 estados), create (guardrails de rol, email existente, duración), redeem
      (nueva anónima; existente con sesión del mismo usuario; sin sesión/otro usuario → 409
      `existing_account_signin_required`; rol conservado; nombre ignorado; la contraseña existente
      no llega al Core), renew (caducada/usada, TTL, cooldown).
- [ ] `packages/db-tests/src/invitations/*`: migración, rol, canje, RLS existente.
- [ ] `packages/core/src/openapi/generate.test.ts`: rutas y schemas nuevos.

### 04.5 Aceptación

- [ ] `GET /invitations/{token}/preview` devuelve el contrato de §6.2 sin id/hash/módulos.
- [ ] Un `admin` no puede crear `admin` (403); un `super_admin` sí; `super_admin` como rol → 400.
- [ ] Invitar a un email existente devuelve 201 con `account_exists: true` y envía la variante.
- [ ] Canjear una cuenta existente con contraseña mala no consume la invitación.
- [ ] `pnpm --filter db-tests test` y `pnpm --filter core test` en verde.

---

## Tarea 05 — App Links (P3 + dispositivo)

**Objetivo:** que el enlace del email abra la app en un dispositivo real.

### 05.1 Configuración

- [ ] Verificar el certificado del APK que se instala:
      `apksigner verify --print-certs <apk>` y comparar con el fingerprint de P3.
- [ ] P3: `ANDROID_APP_SHA256` en Vercel Production (y Preview si se prueba). Redesplegar.
- [ ] `curl -s https://027apps.ericrf.com/.well-known/assetlinks.json | jq` muestra el objeto con
      `package_name` y el fingerprint.
- [ ] `apps/android/app/src/release/AndroidManifest.xml`: añadir `pathPrefix="/migrate/"` al mismo
      `intent-filter` (el `/invite/` ya está); el debug mantiene `027apps-dev://invite` y añade
      `027apps-dev://migrate` en la tarea 10.
- [ ] No cambiar `assetlinks.json`: la relación `handle_all_urls` es por host.

### 05.2 Dispositivo

- [ ] Instalar la release firmada.
- [ ] `adb shell pm get-app-links com.rferic.zero27apps` → `verified` para
      `027apps.ericrf.com`; si no, `adb shell pm verify-app-links --re-verify
      com.rferic.zero27apps`.
- [ ] Abrir el enlace del email; la app se abre y recibe el token.
- [ ] Probar que un enlace normal de la web no se abre en la app.

### 05.3 Aceptación

- [ ] Evidencia pegada: `curl` del assetlinks, `pm get-app-links`, captura del enlace abriendo la
      app. Sin esto, la aceptación app-first no se anuncia.

---

## Tarea 06 — Aceptación en la app (A4/A5 app)

**Objetivo:** formulario precargado/bloqueado, confirmación, estados, auto-login y fallo posterior.

### 06.1 Contrato de datos

- [ ] `apps/android/.../data/Dtos.kt`: `InvitationPreviewDto` (state, email, name, role,
      role_applies, account_exists, locale, expires_at, inviter_name, instance_name, timezone);
      `RedeemResponse` con `user.role`; `RedeemRequest` sin `displayName` (o null).
- [ ] `apps/android/.../data/ApiClient.kt`: `invitationPreview(token)` (público), `redeemInvitation`
      con el body nuevo.

### 06.2 Estado y flujo

- [ ] `apps/android/.../ui/AppState.kt`: `NeedsInvite(link)` mantiene el link; `InviteState` añade
      `previewLoading`, `preview`, `pending`, `error`.
- [ ] `AppViewModel.onInviteLink`: parsea, guarda `pendingLink`, carga el preview; si falla por red,
      deja reintentar; si es inválida, estado sin formulario. Si ya hay una sesión de **otra**
      instancia, no se reutiliza: el enlace no cambia de instancia en silencio; la sesión del canje
      se crea contra la instancia del enlace y la anterior se cierra/limpia si se cambia.
- [ ] `acceptInvite` debe crear el cliente Supabase de la instancia del enlace **antes** de firmar
      una cuenta existente; para una cuenta nueva, después del canje y antes del login.
- [ ] `acceptInvite` (D21, sesión primero):
      - **cuenta existente**: `signInWithPassword` primero; si falla, `InviteError.WRONG_PASSWORD`
        y **no** se llama al canje; si funciona, `redeemInvitation` con el Bearer y sin contraseña,
        luego `me`/módulos/widgets (sin segundo login);
      - **cuenta nueva**: canje con email+contraseña → `signInWithPassword` → `me`; si el login
        falla tras un 201, `NeedsLogin(invitation_accepted)` y **no** reintenta el canje.
      - sin `display_name`.
- [ ] `InviteScreen`: wordmark + instancia; datos bloqueados como **ficha** (email, nombre,
      instancia, invitador, caducidad, rol), no inputs deshabilitados; contraseña + confirmación
      (nueva) o solo contraseña (existente) con «¿Olvidaste tu contraseña?»; errores mapeados de
      §8.1 (contraseña incorrecta de Supabase Auth, `existing_account_signin_required`, caducada,
      usada, rate limit); el idioma sale del `locale` del preview.
- [ ] `LoginScreen`: aviso `invitation_accepted` y `revoked`.

### 06.3 Tests

- [ ] Unitarios: DTO/estado; `acceptInvite` nueva (canje→login) y existente (login→canje, sin
      segundo login); contraseña incorrecta no canjea; 201+login fallido; red; preview
      caducada/usada; `display_name` no enviado.
- [ ] `./gradlew :app:testDebugUnitTest :app:assembleDebug`.

### 06.4 Aceptación

- [ ] En dispositivo real: el enlace abre la app, el formulario aparece precargado y bloqueado,
      solo se editan contraseña/confirmación; la cuenta se crea y la sesión entra sola.
- [ ] Cuenta existente: pide la contraseña actual; una mala no consume; una buena entra.
- [ ] Caducada/usada/inválida: sin formulario, con el texto correcto.
- [ ] Fallo de red tras el canje: aviso y login, sin segundo canje.

---

## Tarea 07 — Wizard web + aviso Android + A1

**Objetivo:** canje web completo, app-first sin bucle, escritorio con QR y auto-login de panel.

### 07.1 Página y preview

- [ ] `apps/admin/src/app/invite/[token]/page.tsx`: resuelve `previewInvitation` en el servidor
      (sin Supabase, `instant = false`, `await connection()` antes de la BD para que el build sin
      env no la ejecute), usa el `locale` del preview con la cookie como fallback, lee `user-agent`
      para la variante, pasa solo los campos públicos al cliente.
- [ ] `apps/admin/src/lib/public-paths.ts`: sin cambios (ya cubre `/invite/<token>`).
- [ ] La página aplica el límite de 60/min por IP (`invite-page:<ip>`) antes del preview; si se
      supera, tarjeta de reintento (no un error interno).
- [ ] `apps/admin/src/app/invite/[token]/invite-wizard.tsx` (cliente): pasos de §7.2; aviso literal
      del propietario; descarga `/download/android` con versión; «Abrir en la app» con timeout de
      1,5 s y fallback; «Continuar en el navegador» siempre visible; QR de escritorio.
- [ ] Dependencia `qrcode` (MIT) para el QR del servidor; justificar en el PR; sin servicios
      externos. SVG inline (o ruta same-origin), tarjeta blanca con quiet zone en claro/oscuro; no
      ampliar la CSP con `data:`.
- [ ] `metadata`: `robots: { index: false, follow: false }`, `referrer: "no-referrer"`.

### 07.2 Formulario

- [ ] `invite-form.tsx`: datos de la invitación como ficha (email, nombre, instancia, invitador,
      caducidad, rol), no inputs deshabilitados; contraseña + confirmación (nueva) o contraseña
      actual (existente) con «¿Olvidaste tu contraseña?»; errores inline accionables (U8);
      `submitOnce`.
- [ ] `lib/invite-submit.ts`: llama a la server action `submitInvitation` con `{ token, email,
      password }`; éxito → `/panel` si el rol es de panel, `/welcome` para `user` (A1 aprobado,
      D2). La web **no** usa el endpoint público (la app sí).
- [ ] `apps/admin/src/app/invite/[token]/actions.ts` (`submitInvitation`): valida zod y origen,
      re-resuelve el preview en el servidor y:
      - cuenta existente: `signInWithPassword` con el SSR; si falla, error inline y **no** canjea;
        si funciona, `redeemInvitation` con la sesión y sin contraseña;
      - cuenta nueva: `redeemInvitation` con el password y, si 201, `signInWithPassword`;
      - rate limit `redeem-action:<ip>` (30/min), porque no pasa por el door público;
      - devuelve `{ role }` o el fallo; `user` → `signOut({ scope: "local" })` + `/welcome`.
- [ ] Compartir `invitationsDeps()` (sin door) entre las rutas y la action; la action llama al
      Core directamente, no al endpoint público.
- [ ] `apps/admin/src/app/welcome/page.tsx`: pública, «cuenta creada», descarga de la app, enlace
      a login y explicación de que el panel es solo para administradores; `noindex`; aviso
      `signin_failed`.
- [ ] Si A1 se rechaza (D2), no se crea `/welcome` ni la action; el flujo actual queda.

### 07.3 i18n y tests

- [ ] Cadenas nuevas en `packages/i18n/catalog.en.json` + 8 locales; `pnpm i18n:scan` y
      `pnpm i18n:check`.
- [ ] Tests de página: preview pending/expired/used/inválida; wizard Android/iPhone/escritorio;
      formulario bloqueado; nueva vs existente; QR presente en escritorio; sin bucle (el clic no
      navega solo).
- [ ] Tests de la action: cuenta existente firma antes y no canjea con contraseña mala; cuenta
      nueva canjea y firma; panel → `/panel`; `user` → `/welcome`; token no usado → error; login
      fallido → aviso.
- [ ] `pnpm --filter admin build`.

### 07.4 Aceptación

- [ ] Android sin app: aviso, descarga, reintento y «continuar»; el formulario canjea.
- [ ] iPhone/escritorio: aviso correcto; escritorio con QR; el canje web funciona.
- [ ] Con A1: un admin acaba en `/panel`; un `user` en `/welcome`; sin A1, en `/login` con aviso.
- [ ] Sin bucles: el botón de abrir en app no redirige solo; siempre hay salida.

---

## Tarea 08 — Recuperación de contraseña (web + enlace desde la app)

**Objetivo:** que una persona que olvidó su contraseña pueda volver a entrar sin enumeración.

### 08.1 Core y email

- [ ] `packages/core/src/auth/password-recovery.ts`:
      `requestPasswordReset({ db, auth, mailer, rateLimit, now }, { email, ip })` (spec §7.6).
      Siempre resuelve; no revela existencia; no envía a desactivados.
- [ ] `packages/core/src/email/{types,catalog,recovery}.ts`: plantilla de reset en 9 idiomas,
      reutilizando `renderEmailLayout`; enlace con `public_url` y `token_hash`.
- [ ] `apps/admin/src/lib/email/recovery-mailer.ts` (Resend), mismo patrón que invitaciones.
- [ ] `apps/admin/src/lib/password-recovery-deps.ts`: Supabase Admin `generateLink({ type:
      "recovery" })` → `hashed_token`; locale del perfil; rate limit con
      `createPostgresRateLimitStorage`; suelo de respuesta común de ~700 ms (S3), con un puerto de
      espera inyectable para el test.
- [ ] Tests: existencia/desactivado no envían; límites; fallo del mailer; URL con `public_url`;
      token no logueado; el suelo de tiempo se cumple en ambos caminos.

### 08.2 Web

- [ ] `apps/admin/src/app/forgot-password/page.tsx` + `actions.ts`: formulario localizado,
      mensaje neutro siempre; `noindex`, `no-referrer`.
- [ ] `apps/admin/src/app/auth/confirm/page.tsx` + server action: el `GET` solo pinta un botón
      «Continuar» y **no consume** el token (los escáneres de enlaces lo invalidarían); el `POST`
      valida `type=recovery` y `next` allowlist `/reset-password`, llama a
      `verifyOtp({ type: "recovery", token_hash })`, fija cookies y redirige; error →
      `/forgot-password?notice=invalid`. `noindex`/`no-referrer`, sin recursos de terceros.
- [ ] `apps/admin/src/app/reset-password/page.tsx` + `actions.ts`: exige sesión; contraseña +
      confirmación 12–200; `updateUser`; `signOut({ scope: "others" })`; `signOut({ scope: "local"
      })`; `/login?notice=password-reset`; rate limit `reset:<userId>`.
- [ ] `(auth)/login/login-form.tsx`: localizar (D7), enlace «¿Olvidaste tu contraseña?», avisos
      `password-reset`, `access-revoked`, `session-expired`.
- [ ] `public-paths.ts`: `/forgot-password` y `/auth/confirm`; **no** `/reset-password` (necesita
      el refresco de sesión del proxy; sin sesión, la página redirige a `/forgot-password`).
- [ ] Tests: `next` no permitido; token inválido; contraseña corta; sin sesión → forgot; reset ok →
      login con aviso; `signOut` scopes.

### 08.3 App

- [ ] `LoginScreen`: «¿Olvidaste tu contraseña?» abre `https://<instancia>/forgot-password` con
      `Intent.ACTION_VIEW`; no hay reset in-app.
- [ ] Cadena en los 9 idiomas y test de que la URL usa la instancia actual.

### 08.4 Aceptación

- [ ] Email real → enlace → nueva contraseña → login; sin revelar si el email existe.
- [ ] Un email desconocido recibe la misma respuesta y no envía nada.
- [ ] Tras el reset, las demás sesiones (incluido el móvil) quedan fuera; la web vuelve al login.
- [ ] `pnpm i18n:check` y tests de web en verde.

---

## Tarea 09 — Renovación (A3) y cierre de coherencia A3–A7

**Objetivo:** renovar caducadas desde el panel y dejar A4/A5/A6/A7 coherentes en las tres superficies.

### 09.1 Renovación

- [ ] `apps/admin/src/app/api/v1/invitations/[id]/renew/route.ts` + operación OpenAPI.
- [ ] `apps/admin/src/app/(panel)/panel/invitations/[id]/page.tsx` + componente de detalle:
      «Renovar» solo si caducada; diálogo de confirmación; token una vez con Copy/Done; estado del
      email; la lista no cambia su orden por defecto (`pending`).
- [ ] Tests de página y de la mutación (`renewInvitation` ya probado en 04).

### 09.2 Coherencia A4/A5

- [ ] Revisar email/web/app: mismo nombre de instancia, wordmark/icono, invitador, caducidad, rol.
- [ ] Mismos estados y textos en web y app (tabla de §8.1); comprobar confirmación y nombre
      bloqueado en ambos.
- [ ] El email de cuenta existente y el de rol admin se renderizan en los 9 idiomas.
- [ ] Capturas de contraste en claro/oscuro (web 375 px, app 390 px).

### 09.3 A6/A7

- [ ] Verificar guardrails de rol en API y panel (admin no puede `admin`; super_admin sí; nunca
      `super_admin`).
- [ ] Verificar que una cuenta existente conserva rol/nombre/contraseña y que el panel lo explica.
- [ ] Tests de regresión de los dos puntos anteriores.

### 09.4 Aceptación

- [ ] Una invitación caducada se renueva, el enlace viejo deja de valer, el nuevo llega por email
      (o se copia si falla) y vuelve a `pending`.
- [ ] No se renueva una usada/revocada; el cooldown de 60 s se respeta.
- [ ] A4/A5/A6/A7 verificados con una lista de comprobación pegada en la tarea.
- [ ] `pnpm --filter admin build`, `pnpm check:openapi`, `pnpm i18n:check`.

---

## Tarea 10 — Migración por QR (solo Android)

**Objetivo:** mover la cuenta a un móvil nuevo sin contraseña; el viejo queda fuera.

### 10.1 Modelo y API

- [ ] `supabase/migrations/0036_device_transfers.sql` (spec §5.2).
- [ ] `packages/core/src/device-transfers/service.ts`: create/status/exchange (TTL 60 s, hash,
      single-use, perfil activo, magic link, limpieza oportunista).
- [ ] `packages/core/src/device-transfers/api.ts`: rutas de §6.6 y schemas zod.
- [ ] `packages/core/src/devices/service.ts`: `revokeOtherDevices` (solo `devices`, no
      `auth.sessions`) + ruta `POST /me/devices/revoke-others`.
- [ ] `packages/core/src/auth` / adaptador: `createMagicLink(email)` con Supabase Admin
      `generateLink({ type: "magiclink", email })`; `getUserEmail(userId)`.
- [ ] OpenAPI: create/status/exchange/revoke-others; `pnpm check:openapi`.
- [ ] Tests Core y db-tests: TTL, hash, single-use, perfil inactivo, dos exchanges concurrentes,
      `revoke-others` aislado por usuario, RLS sin grants.

### 10.2 Android

- [ ] `auth/MigrationLink.kt`: https `/migrate/<token>`, `027apps://migrate/<token>?instance=…`,
      debug, token `027_mig_`, http rechazado en release.
- [ ] `MainActivity`/`AppRoot`: distinguir invite vs migrate; si hay sesión, «cierra sesión
      primero».
- [ ] `AppViewModel.acceptMigration`: exchange → `verifyOtp(OtpType.Email.MAGIC_LINK, token_hash)`
      → `me` → registrar push (nuevo `device_id`) → `revokeOtherDevices` → `signOut(OTHERS)` →
      `SignedIn`.
- [ ] `SettingsScreen`: «Mover a otro teléfono» (solo Android): QR con ZXing sobre tarjeta blanca,
      cuenta atrás 60 s, `FLAG_SECURE`, email + instancia visibles, **autoregeneración a los ~45 s**
      (el código anterior sigue válido hasta su TTL), «Generar otro», polling de estado; al `used`,
      limpiar sesión y login con aviso.
- [ ] `LoginScreen`: «Mover desde otro teléfono»: escáner ZXing (permiso de cámara), email +
      instancia antes de confirmar, errores de token caducado/usado, «cierra sesión primero».
- [ ] Dependencias: `com.google.zxing:core` (generar) + CameraX/Zxing embedded (escanear); justificar
      en el PR; sin Google Play Services si es posible.
- [ ] `app/src/main/AndroidManifest.xml`: permiso `CAMERA` y `027apps-dev://migrate`; release
      `/migrate/` (tarea 05).
- [ ] `FcmRegistrar`: exponer `deviceId()`; `revokeOtherDevices` usa el id nuevo.
- [ ] `Changelog.kt`: subir a `0.19.0`/`1900` y añadir la entrada en español e inglés (una sola
      por el sprint, en el último commit de Android).
- [ ] Tests: `MigrationLink.parse`, `QrPayload`, `acceptMigration` (fakes), `revokeOtherDevices`,
      expiración/reuso, sin token en logs.

### 10.3 Aceptación

- [ ] Dos dispositivos reales: el viejo muestra el QR; el nuevo escanea y entra; el viejo queda
      fuera y deja de recibir push.
- [ ] El QR caduca a los 60 s; reusarlo da 404; «generar otro» funciona.
- [ ] El móvil nuevo con sesión pide cerrar sesión; no cambia de cuenta en silencio.
- [ ] `./gradlew :app:testDebugUnitTest :app:assembleDebug`.

---

## Tarea 11 — Cierre: i18n, docs, landing, gates y auditoría

**Objetivo:** dejar el sprint verificable y auditable; sin esto no hay `finalizada`.

### 11.1 Docs y flujos

- [ ] `docs/flows/invitations.md`: ciclo completo (preview, app-first, web, existente, rol,
      renovación, estados).
- [ ] `docs/flows/password-recovery.md`: solicitud, email, confirmación, reset, revocación.
- [ ] `docs/flows/cicd.md`: App Links (`ANDROID_APP_SHA256`) y `/migrate/`; nota de la release del
      sprint.
- [ ] `docs/flows/pre-delivery-verification.md` si hay rutas nuevas que añadir a
      `scripts/verify-local.sh`.
- [ ] `docs/ai/landing.md` y la landing solo si cambia el copy público (Android 8+, migración,
      recuperación); si no, dejar constancia de que no cambia.
- [ ] Nota «superseded» en la spec de canje web de 2026-11-07.

### 11.2 Gates mecánicos

- [ ] `pnpm lint && pnpm tsc && pnpm test`.
- [ ] `pnpm i18n:check`; `pnpm check:openapi`.
- [ ] `pnpm --filter admin build`.
- [ ] `pnpm --filter db-tests test` sobre Supabase local limpio.
- [ ] `cd apps/android && ./gradlew :app:testDebugUnitTest :app:assembleDebug`.
- [ ] `scripts/verify-local.sh` con sesión real, rutas nuevas incluidas.
- [ ] CI del PR: `admin`, `android`, `supabase`, `guard-secrets`, `commitlint`, `ai-docs`.

### 11.3 Verificación real

- [ ] Pegar la evidencia de la checklist de `docs/flows/pre-delivery-verification.md`: suites,
      build, rutas, endpoints, APK instalado, navegador con `lerd diag browser_toggle` + `request
      lenses`.
- [ ] Sesión: reinicio, avión, actualización, app sin usar mucho tiempo (refresh token), logout
      web/móvil, desactivación, borrado, revocación; P10 confirmado por el propietario y validado
      con la app sin usar.
- [ ] Recuperación con email real; QR con dos dispositivos; App Links.
- [ ] `assetlinks.json` y `/download/android` verificados.

### 11.4 Auditorías finales (seguridad y UX)

- [ ] **Auditoría de seguridad** OWASP A01–A11 por un agente distinto de quien implementó, con la
      checklist de `docs/conventions/security-checklist.md` (incluye A11 Android): tokens/PII en logs,
      preview público, QR bearer, reset, enumeración, rate limits, CSRF, open redirects, App Links,
      deep links, `no-referrer`, `noindex` y descarga del APK.
- [ ] **Auditoría de UX** por un agente distinto de quien implementó: flujos app/web,
      estados vacío/carga/error/sin conexión, copy en los 9 idiomas, contraste claro/oscuro, 375 px
      web y 390 px app, teclado y lector de pantalla, QR legible en claro y oscuro, reset,
      bienvenida y migración. Capturas reales; si no hay dispositivo, código + APK y se dice.
- [ ] Hallazgos críticos/altos de ambas auditorías resueltos; el resto, con motivo escrito.
- [ ] Revisión/QA y estilo por agentes distintos del autor; hallazgos corregidos o rechazados con
      motivo.
- [ ] Informes pegados en la tarea/PR y resumen para el propietario (P9).

### 11.5 Cierre

- [ ] Actualizar `estado` de cada tarea (`pendiente` → `en curso` → `test` → `finalizada`).
- [ ] PR draft contra `staging` con el resumen, los gates del propietario y la evidencia.
- [ ] **No mergear** hasta P7; **no promocionar** hasta P8.
- [ ] El sprint 17 (panel/notificaciones) queda renumerado y preservado; no se toca su contenido.

**Aceptación:** todos los criterios de la spec §11 y la checklist de entrega; el propietario puede
probar staging y decidir el merge.

---

## Comandos de referencia

```bash
# Raíz
pnpm lint
pnpm tsc
pnpm test
pnpm i18n:check
pnpm check:openapi
pnpm --filter admin build
pnpm --filter db-tests test

# Core
pnpm --filter core test
pnpm --filter core openapi:generate

# Android
cd apps/android
./gradlew :app:testDebugUnitTest
./gradlew :app:assembleDebug

# Verificación real
BASE_URL=http://127.0.0.1:3003 scripts/verify-local.sh

# App Links
curl -s https://027apps.ericrf.com/.well-known/assetlinks.json | jq
adb shell pm get-app-links com.rferic.zero27apps
adb shell pm verify-app-links --re-verify com.rferic.zero27apps
```

## Evidencia que se pega en el PR

- Salida de los comandos de arriba (sin secretos; tokens redactados).
- `curl` de preview/redeem/renew/exchange con un token de prueba temporal, redactado.
- `adb` de App Links y capturas de la app en el dispositivo.
- Tabla de la checklist de pre-entrega con ✔/✘ y la ruta/código.
- Informe de revisión, QA, estilo y seguridad.

## Riesgos de ejecución y paradas

- Si P2 no llega, **no se escribe UI**; se puede avanzar en 03 (lógica), 04 (Core) y 08 (Core).
- Si P3 no llega, la app y la web se prueban con el esquema propio; la aceptación app-first no se
  anuncia.
- Si P5 no llega, la recuperación se implementa y se prueba en local con un email de prueba; no se
  anuncia en producción.
- Si el propietario rechaza A1 o D7, se retiran `/welcome` y la localización de login sin tocar el
  resto; se anota en backlog.
- Cualquier hallazgo de seguridad alto/crítico detiene el cierre y se corrige con test de
  regresión.
