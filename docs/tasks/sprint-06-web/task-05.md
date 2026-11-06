---
id: sprint-06-task-05
titulo: Shell y navegación + `/modules`
area: web
estado: test
adrs: [0004, 0005, 0007]
plan: docs/superpowers/plans/2026-11-06-web-admin.md
spec: docs/superpowers/specs/2026-11-06-web-admin-design.md
---

**Alcance**: route group `(panel)` con guard de rol en servidor (403 sin enumerar), shell con marca/ítem activo/logout/selector de idioma, i18n vía `GET /translations`, `GET /api/v1/me` para el guard, responsive móvil, y `/modules` read-only que fija el patrón de datos.

**TDD**: guard, nav, i18n, `me`, página con filas/vacío/error.

**DoD**: TDD, lint/tsc/test/i18n:check/build, revisión y OWASP (A01, A07, A05).
