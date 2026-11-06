---
id: sprint-08-task-05
titulo: i18n operativa (catálogo, checks de CI, siembra y endpoint)
area: core
estado: finalizada
adrs: [0004, 0007, 0008]
plan: docs/superpowers/plans/2026-10-31-sprint-08-core-base.md
---

**Alcance**: `packages/i18n/catalog.en.json` + 8 locales en el formato canónico; scripts `i18n:scan`/`i18n:check` en el job `admin` (faltantes, sobrantes, placeholders, JSON inválido, catálogo stale); siembra idempotente en `translations` (9 locales, prioridad `manual > import > code > module`); `GET /translations?locale` con **ETag del cuerpo servido**.

**TDD**: check falla en cada caso; siembra no duplica; un módulo no pisa texto del Core; edición manual invalida ETag.

**DoD**: TDD, checks, ADRs 0007/0008, QA + auditoría; checklist A03.

## Bitácora (2026-11-05)

- **Pipeline** (`packages/i18n`): `catalog.en.json` (51 cadenas de login/setup), 8 locales (`es ca it fr de pt gl eu`) con las mismas 51 claves, `scan.ts` (extrae `t("…")` de `apps/admin/src`, ignora tests y `it(`), `check.ts` (claves faltantes/sobrantes, placeholders, JSON, catálogo ↔ código) y `t.ts` (`t(text, map?)` con fallback a inglés). Tests: 16.
- **CI**: `pnpm i18n:check` añadido al job `admin` de `.github/workflows/ci.yml`. `tsx` añadido a las devDependencies del paquete.
- **BD**: migración `0006_translations.sql` (tabla, CHECKs, RLS de lectura, índices), aplicada en local y en el proyecto remoto. `seedTranslations` idempotente con prioridad `manual > import > code > module`, borrado de filas `code` retiradas y conservación de `manual`/`import`. Tests de integración: idempotencia, prioridad, retirada (5).
- **Runtime**: `GET /api/v1/translations?locale=xx` en `packages/core/src/i18n/api.ts` (door con sesión y rate limit, solo locales habilitados, ETag del cuerpo servido, 304 con `If-None-Match`); ruta fina en `apps/admin`; loader `apps/admin/src/lib/i18n.ts`. Tests de integración: 5 (200 + ETag, 304, locale no habilitado, locale inválido, 401 anon).
- **Verde**: `pnpm lint` ✓, `pnpm tsc` ✓, `pnpm test` ✓ (i18n 16, core 99, admin 77, db-tests 87), `pnpm i18n:check` ✓ (51 cadenas, 9 locales), `pnpm --filter admin build` ✓.
- **Desviaciones v1 documentadas**: (1) la adopción de `t()` en la UI queda pendiente (sprint-06-web); el catálogo está pre-sembrado y el check es unidireccional: una cadena usada en código y ausente del catálogo **falla**, mientras que una cadena del catálogo aún no envuelta es **warning**. (2) `POST /translations/import` y `PUT /translations/{locale}/{text_hash}` (spec §7) no forman parte del plan de sprint-08-core-base; quedan para sprint-06-web.
- **Pendiente para `finalizada`**: QA + auditoría OWASP de esta tarea.
- **QA + auditoría OWASP** (`ingeniero`): APROBADA CON CAMBIOS, **sin críticos ni altos**. Fixes aplicados:
  - ETag determinista: `ORDER BY text_en` en la query y `Cache-Control: private, max-age=0, must-revalidate` (antes el orden de filas podía cambiar el hash sin cambiar el contenido).
  - `getDefaultLocale` eliminado: código muerto con un parseo jsonb incorrecto (`JSON.parse("en")`); el loader `loadTranslations` se conserva para sprint-06-web.
  - Limpieza de filas `code` acotada a locales con seeds `code`: un seed `module` nunca borra cadenas del Core.
  - Tests nuevos: 403 sin scope, 429 rate limit, mapa vacío de un locale habilitado y ETag que cambia tras una edición `manual`.
  - RLS documentada en la migración: la app lee por `/api/v1` (service role, solo locales habilitados); la policy de lectura es para futuros clientes directos.
- **Revisión de estilo** (`cocinero`): APROBADA CON CAMBIOS. Fixes: `validateSeed` eliminado (código muerto), `SUPPORTED_LOCALES` único (desde `settings/catalog`), tests de ETag separados en `etag.test.ts` sin `await` sobre función síncrona, JSDoc corregido y casts `as unknown` sustituidos por conversiones explícitas.
- **Verde final**: i18n 16, core 96, admin 77, db-tests 91; `i18n:check` ✓; build ✓. `estado: finalizada`.
