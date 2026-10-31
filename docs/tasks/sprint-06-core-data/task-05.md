---
id: sprint-06-task-05
titulo: Sistema de módulos e instalador
area: core
estado: pendiente
adrs: [0004, 0007]
plan: docs/superpowers/plans/2026-10-27-core-implementation-roadmap.md
---

**Alcance**: Instalador: validar manifest, verificar `digest`/`down_digest`, aplicar `up` en transacción con **rol acotado**, sembrar settings/i18n, registry; `uninstall` revierte `down`, limpia settings/translations y aplica la **regla de atribución**; checks de CI de manifest, `docs` y `admin_pages`.

**TDD**: casos de contrato de puerta (scopes/403, representación) + caso de uso (invariantes), y los casos negativos de la checklist de seguridad aplicables.

**DoD**: DoD de Código (TDD, lint/tsc/test/build, CI), ADRs declarados, QA con ojos nuevos y **auditoría OWASP** (checklist `security-checklist.md`).
