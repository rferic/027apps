---
id: sprint-core-design-task-04
titulo: Realtime y notificaciones del Core — spec (definición)
area: core
estado: en curso
plan: docs/superpowers/plans/2026-10-26-sprint-core-design.md
---

Tarea 4 del sprint 04 (Diseño del Core). Sprint de **definición**: entrega una spec aprobada, sin código.

**Entregable**: spec `docs/superpowers/specs/2026-10-26-realtime-notificaciones.md` — el canal realtime y las notificaciones (partes de Core que no son de módulo).

**Alcance**:
- **Realtime** (ADR 0006): concretar el mecanismo que el ADR deja «a validar contra la doc vigente» — publicación servidor→Supabase Realtime (broadcast tras el commit, `{ type, resource, payload }` con representación compartida, api-v1 F), validando el mecanismo nuevo `sb_secret_*` (Supabase depreca `service_role` finales 2026), topic por grupo + RLS sobre `realtime.messages`, `JWT_EXPIRY = 900 s`.
- **Contrato de eventos del Core**: nombres y payloads de los eventos de los recursos del Core (pendiente de la decisión F de api-v1 §3.9), con la representación compartida.
- **Notificaciones** (spec §4): push nativo Android (FCM u otro, con credenciales **por instancia** — cada instalación auto-hospedada tiene las suyas) + email (SMTP propio en `settings` — clave `notifications.smtp.*`, spec de auth §5bis); dispositivo ligado al usuario (`devices` con `push_token` — spec de tokens §7, modelo de la task-01).

**Decisiones a fijar**: mecanismo exacto de publicación (validado contra doc de Supabase), catálogo de eventos del Core, proveedor/mecanismo de push por instancia, umbrales y config en `settings` (`notifications.*`), qué se publica tras el commit y cómo se loguea un push fallido (ADR 0007 §7: efecto externo, no revierte el dato).

**Criterios de aceptación**: el mecanismo de publicación usa el SDK/API vigente de Supabase (no `service_role` deprecado); los eventos del Core quedan catalogados con su representación; push/email diseñados con credenciales por instancia (nunca secrets en el repo); el aislamiento por grupo queda en RLS (como los datos).

**Referencias**: ADR 0006, spec de auth §5bis/§7 (`2026-10-25-auth.md`), spec API v1 §3.9 (F), spec de tokens §7 (`device_tokens`), spec diseño §4 (§§ notificaciones/realtime), task-01/02.