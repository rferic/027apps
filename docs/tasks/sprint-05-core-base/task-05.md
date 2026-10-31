---
id: sprint-05-task-05
titulo: i18n operativa (catálogo, checks de CI, siembra y endpoint)
area: core
estado: pendiente
adrs: [0007, 0008]
plan: docs/superpowers/plans/2026-10-27-core-implementation-roadmap.md
---

**Alcance**: `packages/i18n/catalog.en.json` + 8 locales en el formato canónico; scripts `i18n:scan`/`i18n:check` en el job `admin` (faltantes, sobrantes, placeholders, JSON inválido, catálogo stale); siembra idempotente en `translations` (9 locales, prioridad `manual > import > code > module`); `GET /translations?locale` con **ETag del cuerpo servido**.

**TDD**: check falla en cada caso; siembra no duplica; un módulo no pisa texto del Core; edición manual invalida ETag.

**DoD**: TDD, checks, ADRs 0007/0008, QA + auditoría; checklist A03.
