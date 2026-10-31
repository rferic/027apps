---
id: sprint-06-core-data
titulo: Core datos y plataforma — personas, claves, módulos, realtime y jobs
area: core
estado: pendiente
plan: docs/superpowers/plans/2026-10-27-core-implementation-roadmap.md
---

Sprint de **implementación** de la superficie transversal completa: personas, invitaciones, claves, módulos, realtime y mantenimiento.

**Depende de:** sprint-05 (base, auth, API, settings). **Specs:** task-02/03/04/06/07 del diseño del Core.

| # | Tarea | Entregable |
|---|---|---|
| 01 | Usuarios y roles | list/get/update/assign-role/deactivate + invariantes root y ≥1 super_admin |
| 02 | Categorías de usuarios | CRUD + miembros + asignar módulo (materializa `user_modules`) |
| 03 | Invitaciones | crear/listar/revocar + `/redeem` público (email+contraseña, single-use) |
| 04 | API keys y dispositivos | emisión single-show, scopes, `role_cap`, revocación; `POST /devices` |
| 05 | Módulos | registry, manifest, instalador (digest + rol), lifecycle, `admin_pages`, docs check, settings de módulo |
| 06 | Realtime, outbox, push y jobs | canales + `core_can_subscribe`, `publish()` + outbox, FCM, `maintenance/*` con lease |

**Cierre:** DoD de Código completo + auditoría OWASP por tarea.
