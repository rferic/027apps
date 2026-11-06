---
id: sprint-web-task-09
titulo: Claves API + ajustes
area: web
estado: pendiente
adrs: [0004, 0005, 0007]
plan: docs/superpowers/plans/2026-11-06-web-admin.md
spec: docs/superpowers/specs/2026-11-06-web-admin-design.md
---

**Alcance**: `/keys` (secreto una sola vez, revocar, uso super_admin) y `/settings` (categorías, `is_secret → configured`, batch write de task-04, `security.*`/`public_url`/CORS super_admin, monedas).

**TDD**: listar/crear/revocar, copia única, enmascarado, batch, visibilidad.

**DoD**: igual, énfasis A05 y A01.
