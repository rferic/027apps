# Sprint 14 — Apariencia por usuario (plan)

**Goal:** tema e idioma por perfil, con la cookie como pista de carga rápida y la base como
fuente de verdad.

**Spec:** [`2026-11-11-user-appearance-design.md`](../specs/2026-11-11-user-appearance-design.md).
**Tarea:** [`task-05`](../../tasks/sprint-14-mejoras/task-05.md).

## Pasos

- [x] Migración `0021`: `profiles.theme` + `grant update (theme)`; test de privilegios a cuatro
  columnas.
- [x] API: `theme` en `userPatchSchema` y en `updateUser`; OpenAPI regenerado.
- [x] `panel-guard`: lee `locale` y `theme`, con fallback si el valor no es válido.
- [x] Layout del panel: usa el perfil y aplica `panelThemeScript` antes del contenido.
- [x] Switchers: aplican al instante, persisten con `PATCH` y revierten si falla; el idioma
  refresca.
- [x] Tests: guard, usuarios, privilegios.
- [x] `pnpm lint`, `pnpm tsc`, `pnpm --filter admin test`, `pnpm --filter admin build`.
- [ ] Prueba manual: dos cuentas en el mismo navegador conservan su apariencia.
- [ ] Revisión con ojos nuevos y auditoría de seguridad antes de `finalizada`.
