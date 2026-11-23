---
id: sprint-17-task-02
titulo: Preferencias de notificación por móvil (maestro, generales y módulos)
area: core + app + SQL
estado: test
plan: docs/superpowers/plans/2026-11-23-sprint17-notification-preferences.md
fuente: docs/tasks/sprint-17-panel-y-notificaciones/README.md
mockup: docs/mockups/sprint-17-notifications/index.html
adrs: [0004, 0007]
---

**Estado (2026-11-23)**: implementada y verificada en local; pendiente la revisión, la auditoría y
la prueba con dos móviles reales (puerta del propietario).

- Migración `0040`: `devices.push_enabled` y `device_notification_mutes` con RLS del dueño.
- Catálogo de avisos en `packages/core/src/notifications/catalog.ts` (cuatro tipos; corregido y
  borrado comparten casilla; un evento desconocido nunca se silencia).
- `GET`/`PUT /api/v1/devices/{id}/notification-preferences`: maestro y grupos (generales primero,
  cada módulo activo después), solo el dueño; otro usuario recibe `not_found`.
- El emisor filtra `push_enabled` y el tipo silenciado en las cuatro consultas de destinatarios,
  antes de FCM.
- App: pantalla `NotificationsScreen` con el maestro, el permiso de Android (bloqueado si se
  deniega, con salida a los ajustes), generales y un desplegable por módulo con su logo y «1 de 2»;
  Ajustes abre la pantalla y la fila conserva el resumen.
- Verificación: `preferences.test.ts` 7/7 y `realtime/service.test.ts` 8/8; `core` 638; `admin`
  1363; Android `:app:testDebugUnitTest` BUILD SUCCESSFUL (incluye `NotificationToggleTest` y
  `AppStringsTest` con las 9 locales); `pnpm lint` 0 errores; `pnpm tsc` 7 áreas;
  `pnpm check:openapi` 124/124; `pnpm i18n:check` OK; `pnpm --filter admin build` OK.
- Pendiente de la puerta real: dos Android con FCM (silenciar en uno y comprobar que el otro sigue
  recibiendo). No se ha podido probar el envío real desde aquí.

**Mockup (2026-11-23)**: [`docs/mockups/sprint-17-notifications/`](../../mockups/sprint-17-notifications/README.md),
cinco estados en claro y oscuro. **Aprobado por el propietario el 2026-11-23** (puerta P3): la UI
puede empezar.

**Tarea**: que el propietario pueda apagar y encender las notificaciones desde la app, por tipo y
por módulo, y que el servidor deje de enviar lo silenciado en vez de que el móvil lo ignore. La
preferencia es de cada dispositivo.

**Punto de partida**

- Ajustes solo informa y ofrece reintentar (`SettingsScreen.kt:252-278`); `AppViewModel` expone
  `pushStatus` y `retryPush` (`:795-820`). No hay interruptor ni preferencia guardada.
- `MainActivity.kt:32` pide `POST_NOTIFICATIONS` y no mira el resultado: la fila puede decir
  «Listo» con el permiso denegado.
- El emisor ya filtra `revoked_at is null` en los cuatro caminos (`realtime/service.ts:161-200`) y
  `DELETE /devices/{id}?sessions=local` revoca sin cerrar la sesión (`devices/api.ts:113-127`).
- Hoy solo hay cuatro avisos: gasto nuevo, gasto corregido o borrado (`owe_no.movement_*`),
  solicitud de plazas y respuesta (`invitation.requested`, `invitation.request_resolved`).
  Invitaciones no es un módulo: su evento no lleva `module_key`.
- `FcmRegistrar.revoke()` está pensado para el cierre de sesión y llama a `clear()`, que borra
  `instance_url` y el JWT del registrador (`FcmRegistrar.kt:101-129`): no sirve tal cual para el
  interruptor.

**Alcance**

- Migración `0040_notification_preferences.sql`:
  - `public.devices.push_enabled boolean not null default true`.
  - `public.device_notification_mutes (device_id uuid references public.devices(id) on delete
    cascade, kind text not null, primary key (device_id, kind))`, con RLS activa y política del
    dueño del dispositivo.
- El `POST /devices` mantiene `push_enabled` en el `on conflict`: volver a registrar no enciende lo
  que el usuario apagó.
- Emisor: cada evento se traduce a un tipo de aviso (corregido y borrado comparten casilla) y se
  descarta antes de FCM si el dispositivo lo tiene silenciado o tiene `push_enabled = false`.
- Catálogo y preferencias en un solo recurso por dispositivo:
  - `GET /api/v1/devices/{id}/notification-preferences` → maestro, grupos (generales y cada módulo
    con avisos) y sus tipos; el catálogo devuelve claves, el texto vive en la app.
  - `PUT` del mismo recurso con `{ push_enabled, muted }`, `zod` estricto y solo el dueño.
- App: pantalla **Ajustes → Notificaciones** con el maestro primero, las generales debajo y un
  desplegable por módulo con su logo (`ApiClient.moduleIconUrl`) y el contador «1 de 2». Tocar la
  fila despliega; tocar el switch del módulo marca o desmarca todas sus casillas sin desplegar.
- Permiso del sistema: si `POST_NOTIFICATIONS` está denegado, maestro apagado y bloqueado con el
  texto que lo explica; al tocarlo se vuelve a pedir. Se consulta al entrar y al volver a la
  pantalla.
- Apagar el maestro **no** cierra la sesión ni borra el dispositivo: solo `push_enabled = false`.
  Volver a encenderlo conserva las casillas.
- Si el registro falla, la pantalla conserva la fila de reintento actual.
- 9 idiomas, `pnpm i18n:check`, OpenAPI y `docs/ai/landing.md` si el aviso cambia de estado.

**Aceptación**

- Con el maestro apagado, el servidor no manda a ese dispositivo (ni cuota ni entrega) y la sesión
  sigue abierta.
- Apagar y encender conserva las casillas marcadas; reinstalar vuelve a todo encendido.
- Silenciar «solicitud de plazas» en un Android real: deja de llegar; el otro dispositivo del mismo
  usuario sigue recibiéndola. Es la verificación de la entrada 6 del backlog, que se cierra aquí.
- Con el permiso del sistema denegado, la pantalla no dice «Listo».
- Un módulo a medias se lee «1 de 2» y su switch no finge.
- `db-tests` de dispositivos y notificaciones, tests de `core`, de panel y de app en verde;
  `pnpm check:openapi` e `pnpm i18n:check` en verde.

**Puerta**: mockup de la pantalla (claro y oscuro) aprobado antes de escribir la UI.

**Plan**: [2026-11-23-sprint17-notification-preferences](../../superpowers/plans/2026-11-23-sprint17-notification-preferences.md), tareas 1–5.
