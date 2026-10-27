---
id: sprint-05-task-01
titulo: Migraciones base, RLS y suite de aislamiento
area: core
estado: pendiente
adrs: [0004, 0008]
plan: docs/superpowers/plans/2026-10-27-core-implementation-roadmap.md
---

**Alcance**: migraciones de `profiles` (con `role`, `deactivated_at`), `settings_categories`, `settings` (`value`/`value_encrypted`, `is_secret`, `is_public`, `mcp_access`), `currencies`; RLS con `core_is_admin()`/`core_is_super_admin()` (definers `search_path=''`, `REVOKE` de PUBLIC) y **suite de aislamiento** por tabla (dos usuarios, datos cruzados).

**TDD**: tests SQL de políticas (miembro A no lee B; usuario normal no escala `role`; settings secretos ilegibles) antes de escribir las políticas.

**DoD**: TDD, `lint/tsc/test`, CI, ADRs 0004/0008, QA + **auditoría OWASP**; `docs/conventions/security-checklist.md` A01/A01-RLS marcada.
