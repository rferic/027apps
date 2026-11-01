---
id: sprint-05-task-01
titulo: Migraciones base, RLS y suite de aislamiento
area: core
estado: finalizada
adrs: [0004, 0008]
plan: docs/superpowers/plans/2026-10-31-sprint-05-core-base.md
---

**Alcance**: migraciones de `profiles` (con `role`, `deactivated_at`), `settings_categories`, `settings` (`value`/`value_encrypted`, `is_secret`, `is_public`, `mcp_access`), `currencies`; RLS con `core_is_admin()`/`core_is_super_admin()` (definers `search_path=''`, `REVOKE` de PUBLIC) y **suite de aislamiento** por tabla (dos usuarios, datos cruzados).

**TDD**: tests SQL de políticas (miembro A no lee B; usuario normal no escala `role`; settings secretos ilegibles) antes de escribir las políticas.

**DoD**: TDD, `lint/tsc/test`, CI, ADRs 0004/0008, QA + **auditoría OWASP**; `docs/conventions/security-checklist.md` A01/A01-RLS marcada.

## Bitácora (2026-11-01)

- **Migraciones aplicadas limpias** con `supabase db reset` sobre la pila local: `0001_profiles.sql`, `0002_settings.sql`, `0003_currencies.sql`, `0004_rate_limit_counters.sql` («Finished supabase db reset on branch main»).
- **Suite de aislamiento en verde**: 4 ficheros, **23/23 tests** con `pnpm --filter db-tests test` (`profiles`, `settings`, `currencies`, `rate-limit`).
- **Bugs corregidos durante la fase verde** (los tests los destaparon):
  1. `packages/db-tests/src/pg.ts`: `count()` leía la columna `n`, pero las queries usaban `count(*)` sin alias → devolvía siempre 0. Ahora toma el primer valor de la primera fila.
  2. `0001_profiles.sql`: las políticas no estaban acotadas a `to authenticated`; `anon` evaluaba `core_is_admin()` y recibía `permission denied` en vez de 0 filas. Acotadas a `authenticated`.
  3. `0003_currencies.sql`: el `UPDATE` con `using (core_is_admin())` producía updates silenciosos de 0 filas; cambiado a `using (true) with check (core_is_admin())` para que el fallo sea un error RLS explícito.
  4. `0004_rate_limit_counters.sql`: faltaba `grant select` a `anon`/`authenticated` (ahora ven 0 filas en vez de `permission denied`).
  5. `profiles.test.ts`: `SAVEPOINT`s para aislar aserciones negativas (la segunda heredaba «transaction is aborted»).
  6. `vitest.config.mts`: carga de `.env.local` con `node:fs` (Vitest 5 no exporta `loadEnv` de `vitest/config`).
- **Decisión de diseño en `settings`**: la escritura pasa siempre por la API (`service_role`); en SQL solo hay políticas de `SELECT` para `core_is_admin()`. Los tests lo documentan («un admin no puede insertar settings»).
- **Verde**: `pnpm lint && pnpm tsc` (admin, db-tests, test-utils) sin errores.
- **CI**: job `supabase` en `.github/workflows/ci.yml` (`supabase/setup-cli@v1.7.3` fijado por SHA, `supabase start` + `pnpm --filter db-tests test`, `SUPABASE_DB_URL` local). `docs/flows/cicd.md` actualizado (triggers, gates y sección de migraciones).
- **`packages/test-utils`**: scaffold con el family-set estándar (`testing-strategy.md` §3: grupo «familia», 4 miembros con pareja incluida, EUR). Las factories por entidad se añaden con el módulo que las use.
- **Auditoría QA + OWASP (2026-11-01)**: auditor independiente (agente `ingeniero`, ojos nuevos). Veredicto: **CAMBIOS NECESARIOS (menores)**; sin hallazgos críticos ni altos. Hallazgos y resolución:
  1. **[MEDIO]** `settings`/`settings_categories` sin `to authenticated`: anon recibía `permission denied` en vez de 0 filas. **Corregido**: políticas acotadas a `authenticated`; test nuevo «anon no puede leer settings ni settings_categories».
  2. **[BAJO]** El test «usuario desactivado» no comprobaba lo que su nombre afirmaba. **Corregido**: reescrito como «un admin desactivado pierde su condición de admin y solo se ve a sí mismo».
  3. **[BAJO]** Faltaba test de `deactivated_at` (criterio nº 3). **Corregido**: test nuevo «un usuario no puede editar su deactivated_at (column grant)».
  4. **[BAJO]** `currencies.code` sin constraint ISO 4217. **Corregido** con `CHECK (code ~ '^[A-Z]{3}$')`; el trigger de `updated_at` se difiere a task-04 (documentado en la migración).
  5. **[BAJO/observación]** CHECK de actor en `settings` es `≤1`, no `=1`. **Aceptado con motivo**: las filas sembradas por migración no tienen actor; la API exige exactamente uno en cada escritura con `service_role`; se reevalúa en sprint-06 cuando exista `api_keys`.
- **Tras los fixes**: `supabase db reset` limpio y **25/25 tests** verdes (antes 23); `pnpm lint && pnpm tsc` verdes. CI del commit `0ffeefd` en verde, incluido el job `supabase`.
- **Segunda pasada del auditor (2026-11-01)**: **APROBADA**. Verificó contra la BD real: políticas `to authenticated` (anon ve 0 filas), test de desactivación correcto, column grant de `deactivated_at`, CHECK ISO 4217 sin romper el seed (0 discrepancias de 155 divisas). Sin regresiones. **Checklist A01/A01-RLS**: A01 `✔` (RLS como segunda barrera, `role`/`deactivated_at` no editables, sin enumeración); A01-RLS `✔` (RLS habilitada, deny por defecto, definers `search_path=''` y REVOKE de PUBLIC, suite de aislamiento por tabla, actores identificables, sin CASCADE indebido).
- **Limpieza post-auditoría (2026-11-01)**: `poolOptions` sustituido por `fileParallelism: false` (Vitest 5, aviso eliminado); script `tsc` añadido a `packages/db-tests` (la puerta raíz ya typechequea la suite); `@types/pg` añadido y tipo de `role` en `profiles.test.ts` corregido. Verde: `pnpm lint && pnpm tsc && pnpm test` (36 admin + 25 db-tests).
- **Idioma (2026-11-01)**: comentarios y nombres de tests del código traducidos al inglés en migraciones, `packages/*` y `apps/admin` (convención plan §12: código/commits en inglés). El texto de UI y los fixtures siguen en español hasta la i18n de task-05; los docs internos siguen en español. Verde de nuevo tras el cambio.
