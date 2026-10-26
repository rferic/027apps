---
id: sprint-core-design-task-04
titulo: Realtime y notificaciones del Core — spec (definición)
area: core
estado: finalizada
plan: docs/superpowers/plans/2026-10-26-sprint-core-design.md
---

Tarea 4 del sprint 04 (Diseño del Core). Sprint de **definición**: entrega una spec aprobada, sin código.

**Entregable**: spec `docs/superpowers/specs/2026-10-26-realtime-notificaciones.md` — canales realtime con destinatario explícito y notificaciones push.

**Alcance** (refleja el contenido real de la spec):
- **ADR 0009** (nuevo, sustituye la topología del ADR 0006): canales fijos `admins` / `all` / `user-<uuid>` + **canales de módulo** declarados en el manifest (`pattern` + `members_fn`) y persistidos en `module_channels`.
- **Una sola política RLS** (`core_can_subscribe(realtime.topic())`) — corrige la fuga que tendría "una política por canal" (las permisivas se combinan con OR). `members_fn` endurecida (`security definer`, `search_path=''`, `STABLE`, `EXECUTE` revocado de PUBLIC, fallo cerrado).
- **Envelope**: interno `{ type, target, subject?, resource, payload }`; **wire `{ type, resource, payload }`** (`target` no viaja — delta registrada a api-v1 §3.9).
- **Catálogo Core v1** con `resource`/`payload` cerrados: `user.deactivated` (→`admins` + hooks), `module.installed|activated|deactivated|uninstalled`, `invitation.created|redeemed`, `settings.updated`. Los de negocio los declara cada módulo (`type`, `target`, `subject`, `notify`).
- **Outbox transaccional** (`event_outbox`): el evento se inserta en la transacción del caso de uso, se despacha tras el commit y se reintenta con backoff → entrega **at-least-once**; consumidores y **hooks** idempotentes por `(event_id, module_key)`.
- **`publish()` valida el `target`** (la clave `sb_secret_*` se salta la RLS): lista cerrada + canales declarados por el emisor + módulo `active`.
- **Push FCM**: opcional en el wizard pero **nunca silencioso** (paso recomendado + aviso al omitir + banner en el panel); configuración **en runtime** desde `settings_public` de `/instance` (APK único); **data-only con clave i18n** (el servidor no localiza); batches ≤500; `UNREGISTERED` → `device.revoked_at`; sin datos sensibles; **sin email de negocio en v1**.
- **Ciclo del dispositivo**: `POST /devices` (idempotente por `push_token`) + `DELETE /devices/{id}` al cerrar sesión; `push_token` UNIQUE (varios dispositivos por usuario).
- **`JWT_EXPIRY = 900 s`**: se escribe en el **proyecto Supabase** desde el wizard; en `settings` solo informativo, no editable en el panel.
- **Panel web suscrito a `admins`** (revisa ADR 0006 §6; el ADR 0005 sigue siendo el mecanismo de lectura).

**Deltas aplicadas**: task-01 (`module_channels`, `event_outbox`, `devices.push_token` UNIQUE, decisión Q), task-02 (`POST /devices`, `settings_public` en `/instance`), task-03 (manifest `channels`/`eventos` con `target`/`subject`/`notify`), task-06 (wizard de 4 pasos, `notifications.fcm_*`), task-07 (job de outbox), api-v1 §3.9 (`target` interno), `sprint-infra` task-08 (Firebase de la instancia del autor).

**Criterios de aceptación**: canales y RLS con tests negativos de aislamiento; `module_channels` persistido; envelope wire sin `target`; catálogo cerrado con `resource`/`payload`; outbox con reintentos e idempotencia; `publish()` validando target; push data-only con degradación; coherente con ADR 0009/0006/0004/0007, auth §4/§7 y api-v1.

**Referencias**: ADR 0009 (`docs/adr/0009-topologia-de-canales-realtime.md`), ADR 0006 (vigente salvo topología), spec datos (`2026-10-26-core-data-model.md`), spec API (`2026-10-26-core-api.md`), spec módulos (`2026-10-26-modulo-system.md`), auth §4/§7, api-v1 §3.9.