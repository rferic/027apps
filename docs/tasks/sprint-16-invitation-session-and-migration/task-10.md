---
id: sprint-16-task-10
titulo: Migración de teléfono por QR (solo Android)
area: app + core + bd
estado: finalizada
plan: docs/superpowers/plans/2026-11-16-invitation-session-migration.md
fuente: docs/superpowers/specs/2026-11-16-invitation-session-migration-design.md
mockup: docs/mockups/invitation-flow/index.html
adrs: [0004, 0007, 0010]
---

**Tarea**: mover la cuenta a un teléfono nuevo con un QR de 60 s, sin contraseña ni refresh token en
el código: el viejo lo muestra, el nuevo lo escanea, entra y expulsa al viejo.

**En curso (2026-11-17): backend y web hechos; falta la UI del QR en la app.**

- Migración `0036_device_transfers.sql` aplicada en local: hash único, TTL, `used_at`, RLS sin
  grants a `anon`/`authenticated`.
- Core `createDeviceTransfer`/`getDeviceTransferStatus`/`exchangeDeviceTransfer`: token `027_mig_`
  (solo SHA-256), 60 s, single-use con `for update`, perfil activo, magic link de Supabase y
  respuesta `{transfer_id,email,token_hash,expires_at}` sin sesión, sin `action_link`, con
  `no-store`; la limpieza es oportunista al crear.
- `revokeOtherDevices` conserva el dispositivo nuevo y **no** toca `auth.sessions` (el cliente hace
  `signOut(OTHERS)`).
- Rutas `POST/GET /me/device-transfers`, `POST /device-transfers/{token}/exchange` (pública,
  10/min IP) y `POST /me/devices/revoke-others`, con OpenAPI (106/106 operaciones).
- `/migrate/[token]` pública: solo explica que se abra en el móvil nuevo y ofrece «Abrir en la app»
  (esquema del build) y descarga; **no canjea** en navegador. Añadida a `public-paths.ts`, noindex/
  no-referrer, 9 idiomas.
- Tests: Core del servicio y API contra la base real (crear/poll/canjear una vez/otro usuario/
  revoke-others) en verde.

**Android hecho (2026-11-17, `a371aca`)**

- `MigrationLink`: lee `zero27apps://migrate/<token>?instance=…` (y `-dev`), https con instancia
  propia y la misma regla de instancia que la invitación; token `027_mig_[A-Za-z0-9_-]{1,200}`.
- Ajustes («Mover a otro teléfono») y login («Mover desde otro teléfono») ya abren sus pantallas;
  el manifest principal y el de debug declaran `migrate` para que el enlace llegue a la app.
- `MigrationQrScreen`: tarjeta blanca, email e instancia visibles, cuenta atrás, `FLAG_SECURE`,
  polling cada 2 s, «el móvil nuevo ya está dentro» y regeneración a los ≤15 s restantes.
- `MigrationScanScreen`: CameraX + ZXing sobre el plano Y (sin Play Services), permiso de cámara
  al abrir y mensaje si se deniega; cancelar no deja la cámara abierta.
- `acceptMigration`: exchange → `verifyEmailOtp` → `me`/módulos/widgets → push (espera el
  `device_id`) → `revokeOtherDevices` → `signOut(OTHERS)`. Un enlace en un móvil con sesión, o un
  código usado/caducado (404) o una sesión revocada (401), se explican en un diálogo en vez de
  ignorarse; el enlace cancela el boot en curso para que no lo pise.
- `Strings` pasa a estar respaldada por un mapa: el constructor con ~256 campos superaba el límite
  del JVM (`ClassFormatError` en CI) y ahora las claves se comprueban con el test de reflexión.
- Tests: `MigrationQrTest` cubre el contenido del QR en https y http local, y decodifica un plano Y
  con padding real de cámara de vuelta al mismo enlace.

**Verificado en dos emuladores (APK de debug del sprint)**

- 5554 con sesión → Ajustes → QR: se genera (caduca en 55 s), email e instancia en pantalla;
  `screencap` sale vacío por `FLAG_SECURE`, que es lo esperado.
- 5558 sin sesión recibe el enlace `zero27apps-dev://migrate/…`: canjea y entra como «App Test»;
  la fila de `device_transfers` queda `used_at` a los 6 s y el viejo, al volver, muestra «Tu sesión
  fue revocada. Vuelve a entrar.».
- Código inválido → «Este código ya no es válido…»; enlace con sesión iniciada → «Cierra la sesión
  primero…»; el escáner pide el permiso de cámara y CameraX abre la cámara.
- En local no hay FCM configurado, así que el `device_id` es nulo y `revokeOtherDevices` no se
  llama: la expulsión se comprobó por `signOut(OTHERS)`. La revocación de push se prueba con el
  APK firmado contra una instancia con FCM.

**Aceptación real con un móvil (2026-11-18)**

- El móvil escaneó un QR servido desde el portátil (mismo contenido que genera el viejo). La app
  pidió confirmación del host antes de cambiar de instancia: el escáner pasaba antes directo al
  canje y se saltaba ese paso; ahora comparte el camino con cualquier enlace (`onScannedMigration`).
- Durante el canje se ve una pantalla de progreso («Moviendo tu cuenta…») en vez del formulario de
  login, que parecía un fallo en redes lentas.
- **La sesión vieja seguía viva**: el `signOut(OTHERS)` del cliente no revocó el refresh token
  (comprobado: seguía refrescando). Se añadió `POST /api/v1/me/sessions/revoke-others`, que borra
  las sesiones del usuario salvo la que llama (el id sale del claim `session_id` del JWT). Tras
  repetir la prueba: refresh viejo → **400** y una sola sesión en `auth.sessions`.

**Estado de la aceptación (2026-11-18)**
- Flujo completo verificado con un móvil y un QR servido: entra, y la sesión vieja se revoca en el
  servidor (refresh → 400, una sola sesión). La confirmación de host al escanear y la pantalla de
  progreso salieron de esta prueba.
- Queda como comprobación **de producción**: la revocación de **push** en el móvil viejo y el
  escaneo entre dos dispositivos reales a la vez (P4). Requiere un segundo Android con FCM y montar
  un evento que genere push; se hará con cuentas temporales.

**Punto de partida**
- La app tiene sesión cifrada, `signOut` y registro FCM; `FcmRegistrar` guarda el `device_id`.
- `supabase-kt` 3.9.0 tiene `OtpType.Email.MAGIC_LINK` y
  `SignOutScope.LOCAL/GLOBAL/OTHERS`.
- Supabase Admin `generateLink({ type: "magiclink", email })` devuelve `hashed_token`.
- El App Link `/migrate/` llega en la tarea 05; el APK v0.18.1 no lo tiene, así que la prueba usa el
  APK del sprint.

**Alcance**
- Dentro:
  - Migración `0036_device_transfers.sql` (hash, TTL, used_at, RLS sin grants).
  - Core: create/status/exchange (spec §6.6), limpieza oportunista, `revokeOtherDevices`.
  - API y OpenAPI: `POST/GET /me/device-transfers`, `POST /device-transfers/{token}/exchange`,
    `POST /me/devices/revoke-others`.
  - Adaptador `createMagicLink(email)` con `generateLink` y `getUserEmail(userId)`.
  - Android: entrada en **Ajustes** del viejo («Mover a otro teléfono») y en el **login** del
    nuevo («Mover desde otro teléfono», visible **sin sesión**; si ya hay sesión, también en
    Ajustes y el escáner pide cerrar sesión). `MigrationLink`; deep link https y esquema propio;
    `acceptMigration` (exchange → `verifyOtp` → `me` → push → revoke-others → `signOut(OTHERS)`);
    pantalla QR del viejo con ZXing sobre **tarjeta blanca**, email + instancia visibles, cuenta
    atrás, **autoregeneración a los ~45 s** (el código anterior sigue válido hasta su TTL),
    `FLAG_SECURE` y polling; escáner del nuevo con la instancia del QR antes de escanear y el
    email en el estado de éxito; «cierra sesión primero».
  - `FcmRegistrar.deviceId()`; permiso de cámara; manifest debug/release.
  - Web `/migrate/[token]`: página pública que solo explica «abre este enlace en el móvil nuevo»,
    con «Abrir en la app» y descarga; **no canjea** en el navegador. Añadirla a `public-paths.ts`,
    `noindex` y `no-referrer`.
  - `Changelog.kt` a `0.19.0`/`1900` con la entrada del sprint (español e inglés).
  - Tests Core, db-tests y Android.
- Fuera: QR en web/iOS; confirmación en el viejo (D9 automática); push de aviso al viejo; un
  endpoint de “cancelar” (el TTL lo cubre).

**Dependencias**: 02 (mockup), 03 (sesión/revocación), 05 (App Link `/migrate/`) y 06 (app estable).
La UI del QR no empieza sin P2.

**Riesgos**: que el QR se filtre (60 s, single-use, hash, `FLAG_SECURE`, rate limit); que el
`hashed_token` de Supabase no se pueda canjear con `verifyOtp` (probar el método exacto de
supabase-kt antes de la UI); que `revokeOtherDevices` borre también la sesión nueva (no toca
`auth.sessions`; `signOut(OTHERS)` lo hace el cliente); que el escáner añada Google Play Services
(usar ZXing/CameraX); que el APK viejo no abra `/migrate/` (instalar el del sprint en ambos).

**Criterios de aceptación**
- Dos dispositivos reales: el viejo muestra el QR; el nuevo escanea y entra; el viejo queda fuera y
  deja de recibir push.
- El QR caduca a los 60 s; reusarlo da 404; «generar otro» funciona.
- El móvil nuevo con sesión pide cerrar sesión; no cambia de cuenta en silencio.
- El QR no contiene email, contraseña, refresh token ni push token.
- `pnpm --filter db-tests test`, `pnpm check:openapi`, `./gradlew :app:testDebugUnitTest
  :app:assembleDebug` en verde.
- La UI corresponde con el mockup aprobado.

**Puertas de usuario**
- Aprobar el mockup del QR (P2).
- Facilitar dos dispositivos reales (P4).
- Instalar el APK del sprint en ambos (release firmada, D20).
- Confirmar D4/D5/D9/D11 y D18.

**Auditoría de seguridad**: obligatoria antes de `finalizada` (A01, A02, A04, A07, A11): QR bearer,
TTL, single-use, hash, magic link, `FLAG_SECURE`, cámara, logs y expulsión.

**Excepción aceptada por el propietario (2026-11-18)**: la revocación de push en el móvil viejo no se ha verificado con dos dispositivos reales por falta de un segundo Android con FCM. El código revoca el dispositivo y la expulsión de sesión está probada; la comprobación de entrega se traslada al backlog (`docs/tasks/backlog.md`, entrada 6) para la próxima release con un segundo dispositivo. El resto de criterios de la tarea están cumplidos.
