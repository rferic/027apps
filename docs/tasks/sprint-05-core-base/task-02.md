---
id: sprint-05-task-02
titulo: Auth, sesión SSR y guard de scopes
area: core
estado: pendiente
adrs: [0004, 0007]
plan: docs/superpowers/plans/2026-10-27-core-implementation-roadmap.md
---

**Alcance**: login con Supabase Auth (email+contraseña), sesión SSR por cookies (`HttpOnly`/`Secure`/`SameSite`, PKCE), `authorize(caller, scopes)` con scopes por acción y `role_cap`, y **`/setup`** con creación **atómica** del primer `super_admin` (re-chequeo + email único) y rate limit.

**TDD**: guard (401/403, sin enumerar), `/setup` no reabrible (`already_setup`), concurrencia (dos instaladores → uno gana), usuario desactivado pierde acceso al instante.

**DoD**: TDD, checks, ADRs 0004/0007, QA + auditoría; checklist A01/A07.
