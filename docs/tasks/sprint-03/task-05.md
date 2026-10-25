---
id: sprint03-task-05
titulo: Estrategia de testing — `docs/conventions/testing-strategy.md` (definición)
area: core
estado: finalizada
---

Tarea 5 del sprint 03. Sprint de **definición**: no genera código, solo documentación aprobada.

**Entregable**: `docs/conventions/testing-strategy.md` — el elemento «Estrategia de testing: unit/integración/E2E/RLS/visual, coverage mínimo, fixtures» del backlog de la spec §11.

**Estado (2026-10-25):**
- Conversación de diseño con el usuario: decisiones aprobadas — **A1** umbrales de coverage por conjunto de archivos (90/80 dominio, 85/75 puertas, 80/70 componentes; RLS sin cobertura + suite de aislamiento; E2E sin coverage + caminos críticos); **B** E2E móvil con **Maestro** (Detox aplazado si la suite crece); **C1** E2E web smoke mínimo (login, wizard, invitación, revocar; puerta a listados cuando el admin tenga su primer listado); **D2** RLS = suite SQL por tabla + script de aislamiento con dos grupos (RLS y contrato API, nunca se filtra el grupo vecino).
- TDD obligatorio (DoD), tests a dos niveles (ADR 0004: caso de uso y puerta), ADRs testables en `adrs:` del frontmatter (ADR 0004/0005/0006/0007/0008), fixtures con factories compartidas + family-set estándar, test de i18n sobre locales activos (ADR 0008).

**Revisión y aprobación (2026-10-25):**
- Revisado por segundo agente (DoD de Docs): veredicto CAMBIOS NECESARIOS → corregidos los 6 hallazgos (1 Media: el umbral de coverage lo aplica solo el job `admin`, no `android`; 5 Baja: nomenclatura Playwright `web` dentro de `apps/admin`, `packages/test-utils` como única ruta de factories, cita de i18n spec §4 no §3, suite RLS como job `supabase`/`rls` a añadir en infra, reconciliación «SQL unit» = tests de políticas RLS). Rutas citadas verificadas; sin contradicciones con spec/ADRs/DoD/CI.
- Aprobado por el usuario (2026-10-25): A1 umbrales, Maestro (B), C1 smoke web, D2 RLS con dos grupos.
