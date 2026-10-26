---
id: sprint-core-design-task-06
titulo: Configuración de instancia y setup — spec `settings`/`settings_categories` + wizard (definición)
area: core
estado: test
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

**Estado (2026-10-26):** spec `docs/superpowers/specs/2026-10-26-instance-config.md` redactada con las decisiones del usuario:
- **Frontera del wizard**: Supabase (env), SMTP (dashboard Supabase) y `JWT_EXPIRY` (proyecto Supabase) se **guían y verifican**, no se escriben — es imposible por dependencia circular (los settings viven en la BD a la que esas credenciales dan acceso).
- **Wizard de 5 pasos**: Supabase → SMTP → preferencias (`global.*`, `connectivity.public_url`) → notificaciones (FCM, opcional con aviso) → primer `super_admin`. Resumible: cada paso guarda su progreso y se audita; el wizard desaparece al crear el primer `super_admin`.
- **Catálogo de 17 ajustes del Core** (`settings_categories` + `settings`): `global.*` (instance_name, default_timezone, default_currency, active_locales, jwt_expiry informativo), `connectivity.*` (public_url, cors_allowlist), `notifications.push.*` (provider + 4 valores FCM públicos + service account secreto) y `security.rate_limit.*` (4 umbrales); cada clave con `mcp_access`.
- **Cifrado**: AES-256-GCM con `SETTINGS_ENCRYPTION_KEY` versionada, secreto por clave con `value_encrypted`; secretos **nunca** en `GET /settings` (enmascarados) ni en `/instance`.
- **`settings_public`** en `/instance`: solo las claves `is_public` del Core (nombre, locales, moneda/zona y `fcm_*` públicos); nunca CORS, rate limits ni `security.*`.
- **Validación** zod por tipo de clave y coherencia (locales ⊂ set de 9 con `en` obligatorio; moneda default habilitada; FCM completo si `provider=fcm`); escritura solo `is_admin()` y auditada sin valor.
- **Deltas aplicadas** a task-01: `settings.mcp_access` (W) y `updated_by_key` (actor de máquina).

**Criterios de aceptación**: catálogo v1 cerrado y validado; secretos cifrados y nunca expuestos (API, logs, eventos, `settings_public`); `settings_public` acotado; wizard de 5 pasos resumible y protegido que desaparece con el primer admin; coherente con ADR 0007/0008, auth §3bis/§5bis, api-v1 y task-01..05.

**Referencias**: `docs/superpowers/specs/2026-10-26-instance-config.md`, ADR 0008, ADR 0007, auth §3bis/§5bis, task-01 (settings), task-04 (FCM), task-05 (`mcp_access`).
