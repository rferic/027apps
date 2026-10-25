---
id: sprint-core-design
titulo: Diseño del Core (definición) — superficie transversal inicial
area: core
estado: pendiente
---

Sprint de **definición** (sin código de producto): diseñar la superficie inicial del **Core** — todo lo transversal/compartido entre módulos (spec §4). Registrado como backlog pendiente, sin tareas numeradas aún; se planifica al cerrar la spec de API v1.

**Por qué existe:** el Core es una capacidad que crece con el proyecto y no se puede catalogar completo hoy (decisión del usuario, 2026-10-25). Este sprint concreta **la base inicial** sobre el contrato estable de la spec de API v1.

**Depende de:** ~~spec de API v1~~ (`docs/superpowers/specs/2026-10-25-api-v1.md`) **finalizada** ✅ (2026-10-25) — el contrato estable y el mecanismo de extensión están aprobados; la especificación de tokens, auth, ADRs 0001–0008 y testing strategy también `finalizada`. **Puerta de entrada cumplida: el sprint está desbloqueado para planificarse.**

**Alcance previsto (a detallar al planificar):**
- Esquema de BD del Core: `profiles`, `groups`, `group_members`, `invitations`, `participants`, `api_keys`, `device_tokens`, `instance_settings` (spec §8) con RLS y tests de aislamiento.
- Endpoints transversales del Core derivados de ese esquema (sobre el contrato de API v1; el inventario exacto se decide aquí).
- Instalador de módulos en runtime (DDL y rollback), manifests de módulos, config de módulos por grupo.
- Shell del admin + infra de realtime/notificaciones (partes de Core que no son de módulo).

**Puerta de entrada:** spec de API v1 `finalizada` (cumplida, 2026-10-25); sprint de infra (setup del usuario) puede ir en paralelo o después.