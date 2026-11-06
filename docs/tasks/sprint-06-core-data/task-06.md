---
id: sprint-06-task-06
titulo: Realtime, outbox, push y mantenimiento
area: core
estado: finalizada
adrs: [0004, 0006, 0007]
plan: docs/superpowers/plans/2026-10-27-core-implementation-roadmap.md
---

**Alcance**: Política **única** `core_can_subscribe(topic)`; `publish()` valida `target` y despacha tras el commit; `event_outbox` con `claimed_until`/`failed_at` y hooks idempotentes; FCM data-only (degradación limpia); `POST /maintenance/run` con lease, allowlist y purgas con rol `core_cron`.

**TDD**: casos de contrato de puerta (scopes/403, representación) + caso de uso (invariantes), y los casos negativos de la checklist de seguridad aplicables.

**DoD**: DoD de Código (TDD, lint/tsc/test/build, CI), ADRs declarados, QA con ojos nuevos y **auditoría OWASP** (checklist `security-checklist.md`).

## Bitácora (2026-11-05)

- **Migración** `0012_realtime_outbox_jobs.sql`: `module_channels`, `event_outbox` (claim/backoff/hooks) y `maintenance_runs` (lease único por job). Función `core_can_subscribe(topic)` `security definer` con fallo cerrado y **una sola política** en `realtime.messages` (`admins`/`all`/`user-<uuid>`/canales de módulo con `members_fn` y módulo `active`). Rol `core_cron` con `SELECT`/`DELETE` solo en tablas purgables y políticas RLS propias.
- **Outbox** (`packages/core/src/realtime/service.ts`): `enqueueEvent` valida `target` y exige sujeto en `user`; `publishPending` reclama por lote, valida topic y módulo activo, publica el **wire sin `target`**, ejecuta hooks por puerto y envía push (destinatarios `admins`/`all`/`user`/canal), marca `published` o reintenta con backoff hasta `failed` tras 8 intentos. `UNREGISTERED`/`INVALID_ARGUMENT` revoca el dispositivo.
- **Push** (`packages/core/src/push/fcm.ts`): FCM HTTP v1 **data-only** con OAuth2 desde la service account (cifrada en settings), lotes ≤500, degradación sin configuración (`null`/sin enviar). La app localiza por clave.
- **Mantenimiento** (`packages/core/src/maintenance/{service,api}.ts`): allowlist cerrada, lease atómico (`on conflict … where status='running'`), cooldown 60 s, purgas como `core_cron`, `/maintenance/run` (solo clave service con `role_cap=super_admin`, delegadas 403) y `/maintenance/status` (sesión super_admin).
- **Canales de módulo**: el instalador persiste `manifest.channels` en `module_channels`; uninstall los borra por cascada.
- **Eventos del Core**: `user.deactivated`, `module.installed/activated/deactivated/uninstalled`, `invitation.created/redeemed` y `settings.updated` se insertan **en la misma transacción** del caso de uso; el wire nunca lleva `target`.
- **Tests**: 5 de outbox (wire, sujeto, push + revocación, backoff/failed, canal inválido, transporte ausente), 4 de mantenimiento (purgas, lease/cooldown, allowlist/permisos, estado), 3 de API, 3 de aislamiento `core_can_subscribe`/`realtime.messages` y aserciones de eventos en users/modules/invitations/settings.
- **Diferido**: implementación de hooks concretos de módulos (puerto inyectado), `api_keys.anonymize`, y la **verificación end-to-end de FCM** (service account real + dispositivo + push con app cerrada), bloqueada hasta disponer de credenciales del usuario.
- **Correcciones tras auditoría**: lease vencido reclamado (`timeout`, con test) para no bloquear jobs; `resolveTopic`/`recipients` exigen que el canal pertenezca al **módulo emisor** (test con módulo ajeno); `core_can_subscribe` acepta cualquier placeholder (migración 0013); `members_fn` roto degrada push en lugar de reintentar el evento; `hook_applied` filtra módulos ya aplicados; FCM limita concurrencia a 20 peticiones por lote. El wire se mantiene `{type, resource, payload}` por contrato.
- **Verde**: lint ✓, tsc ✓, core 125, admin 77, db-tests 196, build ✓.
- **Auditorías**: QA/OWASP → APROBADA CON CAMBIOS (medios corregidos y con tests; nota futura sobre `event_id` en el wire). Estilo → APROBADA CON CAMBIOS (0013 documentada como migración incremental).
- **CI**: PR #36 run `42055304414` en verde (`admin`, `android`, `commitlint`, `guard-secrets`, `supabase`) sobre `cd7988e`.
- **Decisión de cierre (2026-11-05, delegada al agente)**: la tarea queda **finalizada** por implementación, TDD, gates y auditorías. La **verificación end-to-end de FCM no está ejecutada** y se registra como **puerta de aceptación de despliegue**, no como trabajo de implementación pendiente: antes de habilitar push en producción hay que subir la service account real, registrar un dispositivo y comprobar el push con la app cerrada. No se afirma que FCM esté verificado.

## Validación Android (2026-11-05)

- `apps/android`: `FcmConfig` (config pública `/instance` y persistencia en prefs), `FcmRegistrar` (inicializa Firebase, obtiene y registra el token en `/devices`, lo refresca al rotar), `PushMessagingService` (recibe data-only y muestra notificación con la clave del evento) y una pantalla mínima de aceptación en `MainActivity` para introducir URL + JWT.
- `Zero27AppsApplication` inicializa Firebase en `Application.onCreate` a partir de la config persistida. Es imprescindible para el criterio “app cerrada”: FCM arranca el proceso en frío para entregar un data-only y `PushMessagingService` necesita el `FirebaseApp` por defecto ya creado.
- Permisos `INTERNET`/`POST_NOTIFICATIONS` y servicio `com.google.firebase.MESSAGING_EVENT` en el manifiesto; Firebase Messaging por BoM, sin `google-services.json` ni secretos horneados.
- `app/src/debug/AndroidManifest.xml` permite HTTP en claro **solo en debug** para validar contra el dev server con `adb reverse`; release sigue bloqueándolo.
- Evidencia local: `./gradlew :app:testDebugUnitTest` (6 tests FCM + 3 ServerUrl) y `./gradlew :app:assembleDebug` en verde.
- Procedimiento completo de aceptación: [`docs/flows/fcm-validation.md`](../../flows/fcm-validation.md). La comprobación con un dispositivo real y credenciales de Firebase sigue siendo la puerta manual de despliegue.

## Intento de cierre de la puerta FCM (2026-11-06)

- **Arnés arreglado**: la pantalla de aceptación (`MainActivity`) no era usable con un JWT real de ~800 caracteres; el campo se expandía hasta 1878 px y el `Button` quedaba con bounds `0x0`. Ahora la columna hace scroll y el campo del JWT es de una línea (`singleLine`). Verificado en emulador: botón en `[16,240][242,280]` y pulsable.
- **Verificado por servidor**: con un dispositivo de token falso, `outbox.publish` publicó el evento y FCM devolvió el token como inválido, dejando `devices.revoked_at` a las 16:27:39. Eso cubre descifrado de la service account, firma OAuth2, llamada a FCM HTTP v1 y revocación (criterio 4 del runbook).
- **No verificado**: la entrega real con la app cerrada (criterio 3). En esta máquina no hay dispositivo físico y el emulador `google_apis` falla con `FIS_AUTH_ERROR` al obtener el token de Firebase Installations (sin cuenta de Google y con la API key probablemente restringida por huella). La imagen con Play Store no completa el arranque.
- **Puerta pendiente**: sigue siendo puerta de despliegue. Procedimiento y pasos exactos en `docs/flows/fcm-validation.md`; basta un móvil con Google Play Services y el APK debug.
