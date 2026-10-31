---
id: sprint-08-new-module-skill-task-06
titulo: Integración y validación final
area: docs
estado: finalizada
plan: docs/superpowers/plans/2026-10-31-sprint-08-new-module-skill.md
fuente: docs/superpowers/specs/2026-10-31-sprint-08-new-module-skill.md §9, §11; docs/superpowers/plans/2026-10-27-core-implementation-roadmap.md
adrs: [0004, 0007, 0008]
---

**Tarea**: integrar el sprint en el roadmap y las referencias, verificar la no-regresión y
cerrar el sprint con la revisión de segundo agente.

**Alcance**:
- Añadir `sprint-08-new-module-skill` como vía paralela en el roadmap del Core.
- Actualizar la spec del sistema de módulos para referenciar la metodología y la skill (sin
  tocar el contrato).
- Revisar `AGENTS.md`, `docs/flows/agents.md` y `feature.md` para enlaces que falten.
- Ejecutar `pnpm lint && pnpm tsc && pnpm test` y `node scripts/check-ai-docs.mjs`.
- Actualizar estados de las seis tareas a `finalizada` tras resolver hallazgos.

**Criterios de aceptación**:
- El roadmap deja claro que el sprint no es dependencia del Core.
- Todos los enlaces apuntan a ficheros existentes.
- `pnpm` y el check de CI en verde con salida leída.
- Revisión de segundo agente (DoD de Docs); auditoría de seguridad si toca secretos o
  configuración sensible.

## Bitácora

- Roadmap actualizado: `sprint-08-new-module-skill` aparece como vía paralela, sin bloquear
  al Core.
- Spec del sistema de módulos actualizada: ya no habla de «esqueleto a completar»; enlaza la
  metodología (`docs/flows/new-module.md`), el contrato canónico (`docs/ai/module-system.md`)
  y la skill.
- Revisión de segundo agente (sesión `ses_e6d606483ffecx4Nvxav2G6FOq`) con hallazgos
  resueltos:
  - **High**: `docs/flows/cicd.md` actualizado para el job `ai-docs`; `release.needs` incluye
    `ai-docs`; lista de checks requeridos actualizada.
  - **Medium**: spec marcada como aprobada; corregida la frase de plantillas sobre i18n;
    task-06 con estado y bitácora.
  - **Low**: nota en el contrato sobre referencias cruzadas validadas por el registry/CI del
    Core; «CI del Core» en lugar de «CI»; ejemplo mínimo renombrado a `example-calendar`;
    eliminada la referencia a `TODO` en el flujo; añadido el paso de cierre a la skill.
- Verificación: `pnpm install --frozen-lockfile`; `pnpm lint && pnpm tsc && pnpm test` →
  9 archivos y 36 tests en verde; `node scripts/check-ai-docs.mjs` → pasa; los ejemplos
  `minimal.json` y `full.json` validan contra el esquema con `ajv-cli`.
- Seguridad: el job `ai-docs` no usa secretos y corre con `contents: read`; no se han
  introducido valores sensibles. Sin auditoría OWASP adicional por ser cambio de docs/tooling.
- Las seis tareas quedan `finalizada`; el sprint queda en `test` a la espera de aceptación y
  orden de merge del usuario.
