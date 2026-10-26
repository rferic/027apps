---
id: sprint-core-design-task-06
titulo: Configuración de instancia y setup — spec `instance_settings` + wizard (definición)
area: core
estado: pendiente
plan: docs/superpowers/plans/2026-10-26-sprint-core-design.md
---

Tarea 6 del sprint 04 (Diseño del Core). Sprint de **definición**: entrega una spec aprobada, sin código.

**Entregable**: spec `docs/superpowers/specs/2026-10-26-instance-config.md` — `instance_settings` como sistema y el flujo de instalación (`/setup`).

**Alcance**:
- **`instance_settings` como sistema clave-valor**: registro de claves v1 — zona horaria, moneda por defecto, idiomas activos (set de 9, `en` no deshabilitable — ADR 0008), `JWT_EXPIRY = 900 s` (ADR 0006), CORS allowlist por instancia (api-v1 C2); y **secrets cifrados** (SMTP propio, LLM keys BYOK, secrets de clientes MCP) con clave maestra en env (spec §8, auth §5bis).
- **Quién lee/escribe**: solo `super_admin` (guard por rol), lectura en `/instance` solo de lo no sensible (api-v1 §4 — `requires_setup` público, trade-off aceptado).
- **Wizard `/setup`** (spec de auth §3bis, estilo WordPress): 1) conexión Supabase, 2) SMTP del proyecto, 3) creación del `super_admin`; desaparece al existir el primer admin; aquí se detalla como flujo del Core/panel.

**Decisiones a fijar**: esquema/API de `instance_settings` (claves tipadas + validación zod), cómo se cifran los secrets (clave maestra en env, ver task-01), endpoints de configuración (`/instance` y los de escritura por super_admin), flujo completo del wizard y sus verificaciones, límites free (SMTP 100-300/día según proveedor).

**Criterios de aceptación**: registro de claves v1 completo y tipado; secrets solo cifrados en BD con clave maestra en env; `/instance` expone lo previsto de api-v1 sin datos sensibles; el wizard queda diseñado y su desaparición tras el primer admin definida (auth §3bis).

**Referencias**: ADR 0008 (config general), ADR 0006 (`JWT_EXPIRY`), spec de auth §3bis/§5bis, spec API v1 §3.4/§4 (C2, `/instance`), spec diseño §8 (secrets), task-01 (RLS/esquema).