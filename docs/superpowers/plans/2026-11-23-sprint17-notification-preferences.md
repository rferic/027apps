# Sprint 17 · Tarea 02 — Preferencias de notificación por móvil

**Goal:** que cada móvil pueda apagar y encender las notificaciones por tipo y por módulo, con un
maestro, y que el servidor deje de enviar lo silenciado en vez de que el cliente lo ignore.

**Architecture:** el maestro es `devices.push_enabled`; los tipos silenciados son filas de
`device_notification_mutes`. El emisor traduce cada evento del outbox a un **tipo de aviso** y
descarta los dispositivos que lo tienen silenciado o el maestro apagado, antes de gastar cuota de
FCM. El catálogo de tipos vive en el Core y lo sirve la API con el nombre de cada módulo; la app
pinta la pantalla del mockup aprobado (`docs/mockups/sprint-17-notifications/`).

**Tech Stack:** Postgres/Supabase (migración, RLS), `packages/core` (catálogo, preferencias, emisor),
Next.js admin (rutas), Android Compose (pantalla), Zod, OpenAPI.

**Spec:** [`docs/tasks/sprint-17-panel-y-notificaciones/README.md`](../tasks/sprint-17-panel-y-notificaciones/README.md)
· [mockup aprobado](../mockups/sprint-17-notifications/README.md)

## Global Constraints

- La preferencia es **del dispositivo**, no de la cuenta.
- Cuatro tipos: `invitation.requested`, `invitation.request_resolved`,
  `owe_no.movement_created`, `owe_no.movement_changed` (corregido y borrado comparten casilla).
- El maestro apagado **no** cierra la sesión ni borra el dispositivo; volver a encenderlo conserva
  las casillas.
- El servidor filtra: `push_enabled` y el silenciado del tipo se aplican en la consulta de
  destinatarios. Filtrar solo en el móvil está descartado.
- Solo el dueño del dispositivo lee y escribe sus preferencias; otro usuario recibe `not_found`.
- Zod estricto en el borde; sin `any`; colores solo por tokens; 9 idiomas.

## Mapa de archivos

| Área | Archivos |
|---|---|
| SQL | `supabase/migrations/0040_notification_preferences.sql` (nuevo) |
| Core | `packages/core/src/notifications/catalog.ts` (nuevo), `devices/preferences.ts` (nuevo), `devices/service.ts`, `devices/api.ts`, `realtime/service.ts` |
| Rutas | `apps/admin/src/app/api/v1/devices/[id]/notification-preferences/route.ts` (nuevo), `apps/admin/src/lib/devices-route-deps.ts` |
| OpenAPI | `packages/core/src/openapi/{registry,schemas}.ts` |
| App | `ui/screens/NotificationsScreen.kt` (nuevo), `SettingsScreen.kt`, `AppRoot.kt`, `data/{ApiClient,OweDtos}.kt`, `ui/i18n/Strings.kt`, `Changelog.kt` |
| Tests | `packages/core/src/notifications/*.test.ts`, `packages/core/src/realtime/service.test.ts`, `packages/db-tests/src/{realtime,devices}/**`, `apps/android/app/src/test/**` |

---

### Task 1: migración y catálogo

- [x] `devices.push_enabled boolean not null default true`.
- [x] `device_notification_mutes (device_id, kind)` con PK, FK `on delete cascade`, RLS del dueño y
  grants de `authenticated`; sin índice extra (la PK sirve).
- [x] `notifications/catalog.ts`: tipos, grupo (módulo o general) y mapa evento → tipo. Los eventos
  desconocidos no se silencian nunca.
- [x] `DeviceView` y `VIEW_COLUMNS` con `push_enabled`; el `on conflict` de registro no lo resetea.

### Task 2: preferencias (servicio y ruta)

- [x] `devices/preferences.ts`: `readPreferences` y `writePreferences` por dispositivo, solo dueño.
  La escritura reemplaza los silenciados en una transacción y valida el catálogo.
- [x] Vista: `{ device: { id, push_enabled }, groups: [{ module: { key, name } | null, types: [{ key, enabled }] }] }`.
  Solo aparecen los módulos activos de `module_registry`.
- [x] `GET`/`PUT /api/v1/devices/{id}/notification-preferences` con `devices:read|write`.
- [x] OpenAPI con el esquema de la vista y del cuerpo.

### Task 3: emisor

- [x] `notificationKind(event.type)` y filtro en las cuatro consultas de destinatarios:
  `and d.push_enabled` y `not exists (… m.kind = $n)`.
- [x] Test de integración: un dispositivo con el maestro apagado y otro con el tipo silenciado no
  reciben; un tercero sí.

### Task 4: pantalla de la app

- [x] DTOs y `ApiClient.notificationPreferences` / `updateNotificationPreferences`.
- [x] `NotificationsScreen`: maestro, permiso del sistema (bloqueado si denegado), generales, un
  desplegable por módulo con logo y switch todos/nada, «1 de 2», y la fila de reintento si el
  registro falla.
- [x] Ajustes abre la pantalla; el resumen del móvil sigue en la fila.
- [x] Lógica pura extraída y con test: marcar/desmarcar un grupo entero y contar activos.
- [x] 9 idiomas y changelog de la 0.21.0.

### Task 5: verificación

- [x] `pnpm --filter db-tests test -- src/devices src/realtime`
- [x] `pnpm --filter @027apps/core test`, `pnpm --filter admin test`
- [x] `pnpm lint`, `pnpm tsc`, `pnpm check:openapi`, `pnpm i18n:check`, `pnpm --filter admin build`
- [x] `./gradlew :app:testDebugUnitTest`
- [ ] La puerta de los dos móviles reales queda para el propietario.
