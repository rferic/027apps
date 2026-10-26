---
id: sprint-core-design-task-06
titulo: Configuración de instancia y setup — spec `settings`/`settings_categories` + wizard (definición)
area: core
estado: en curso
plan: docs/superpowers/plans/2026-10-26-sprint-core-design.md
---

Tarea 6 del sprint 04 (Diseño del Core). Sprint de **definición**: entrega una spec aprobada, sin código.

**Entregable**: spec `docs/superpowers/specs/2026-10-26-instance-config.md` — `settings`/`settings_categories` como sistema (sustituye al `instance_settings` de la spec §8) y el flujo de instalación (`/setup`).

**Alcance**:
- **`settings` + `settings_categories` como sistema**: registro de claves v1 sobre el modelo de la task-01 — zona horaria, moneda por defecto, idiomas activos (set de 9, `en` no deshabilitable — ADR 0008), `JWT_EXPIRY = 900 s` (**se escribe en el proyecto Supabase** desde el wizard; en `settings` solo informativo — ADR 0009/task-04), CORS allowlist por instancia (api-v1 C2), y **`notifications.fcm_*`** (4 claves públicas + service account JSON cifrado — task-04); y **secrets cifrados** (SMTP propio, LLM keys BYOK, secrets de clientes MCP) con clave maestra en env (spec §8, auth §5bis). Alimentado por `translations` para las etiquetas (texto en inglés como clave).
- **Quién lee/escribe**: solo `is_admin()` (guard por rol); lectura pública solo de lo no sensible vía **`/instance`** (`requires_setup` y el bloque **`settings_public`** con las claves `is_public` del Core, nunca secretos ni settings de módulo — task-04).
- **Wizard `/setup`** (spec de auth §3bis, estilo WordPress): 1) conexión Supabase (incluye `JWT_EXPIRY = 900 s`), 2) SMTP del proyecto, 3) **notificaciones (Firebase/FCM — opcional, con aviso explícito al omitir)**, 4) creación del `super_admin`; desaparece al existir el primer admin; aquí se detalla como flujo del Core/panel.

**Catálogo con `mcp_access`** (task-05): cada clave del catálogo declara `mcp_access: none|read|write`; por defecto **`none`** para `security.*`, `connectivity.*` y `auth.*` (un agente no puede desactivar el rate limiting ni ampliar CORS). `settings_get`/`settings_update` por MCP solo operan sobre las claves con `read`/`write`.

**Decisiones a fijar**: esquema/API de `settings` (claves tipadas + validación zod, sobre el modelo de la task-01), cómo se cifran los secrets (clave maestra en env, ver task-01), endpoints de configuración (`/instance` y los de escritura por super_admin), flujo completo del wizard y sus verificaciones, límites free (SMTP 100-300/día según proveedor).

**Criterios de aceptación**: registro de claves v1 completo y tipado; secrets solo cifrados en BD con clave maestra en env; `/instance` expone lo previsto de api-v1 sin datos sensibles; el wizard queda diseñado y su desaparición tras el primer admin definida (auth §3bis).

**Referencias**: ADR 0008 (config general), ADR 0006 (`JWT_EXPIRY`), spec de auth §3bis/§5bis, spec API v1 §3.4/§4 (C2, `/instance`), spec diseño §8 (secrets), task-01 (RLS/esquema).