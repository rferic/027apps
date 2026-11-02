---
id: sprint-05-task-02
titulo: Auth, sesión SSR y guard de scopes
area: core
estado: test
adrs: [0004, 0007]
plan: docs/superpowers/plans/2026-10-31-sprint-05-core-base.md
---

**Alcance**: login con Supabase Auth (email+contraseña), sesión SSR por cookies (`HttpOnly`/`Secure`/`SameSite`, PKCE), `authorize(caller, scopes)` con scopes por acción y `role_cap`, y **`/setup`** con creación **atómica** del primer `super_admin` (re-chequeo + email único) y rate limit.

**TDD**: guard (401/403, sin enumerar), `/setup` no reabrible (`already_setup`), concurrencia (dos instaladores → uno gana), usuario desactivado pierde acceso al instante.

**DoD**: TDD, checks, ADRs 0004/0007, QA + auditoría; checklist A01/A07.

## Bitácora (2026-11-01)

- **Core auth** (`packages/core/src/auth/`): `guard.ts` (scopes por acción con `role_cap`: sesión por rol, claves por `min(scopes, roleCap)`, anon → 401, sin scope → 403 sin enumerar), `caller.ts` (`Authorization: Bearer <jwt>` → `getUser(jwt)` verificado + rol leído de `profiles`; sin header → anon; token inválido o perfil desactivado → 401) y `setup.ts` (creación atómica del primer super_admin: transacción con `pg_advisory_xact_lock('core_setup')`, re-chequeo `already_setup`, rollback + borrado del usuario Auth huérfano si el INSERT falla).
- **Tests core**: `guard.test.ts` (7 tests: super_admin ok, admin gestiona, user no escala a gestión, roleCap de claves, anon 401).
- **Tests db-tests**: `auth/caller.test.ts` (4: sesión con rol, anon sin header, token inválido 401, perfil desactivado 401) y `auth/setup.test.ts` (4: dos instaladores concurrentes → 1 gana + 1 `already_setup`, segundo intento → `already_setup`, persistencia de display_name/role con la identidad solo en `auth.users`, rollback limpio con `ON DELETE CASCADE`). **33/33 en db-tests, 40/40 en core.**
- **Hallazgos y correcciones durante la fase verde**:
  1. **Bug en `setup.ts`**: el INSERT incluía `email` en `public.profiles`, columna que no existe en `0001_profiles.sql` (la identidad vive solo en `auth.users`). Corregido: INSERT por `(id, display_name, role)`.
  2. **Usuario de Auth por SQL directo no autentica**: insertar en `auth.users` sin fila en `auth.identities` hace que GoTrue responda «Database error querying schema» al hacer login (comprobado con un script de sonda contra la pila local). Los tests de sesión crean el usuario vía **Admin API** (`auth.admin.createUser`) y limpian con `deleteUser`; el `createTestUser` de SQL queda para los tests RLS que fabrican JWT claims sin sesión real.
  3. **Test de rollback ajustado al esquema**: el perfil del usuario cascada con el borrado del auth user (`ON DELETE CASCADE`); el invariante testado es que **no queda estado parcial** (ni usuario ni perfil super_admin).
  4. **`@027apps/core` sin exports y sin link**: `db-tests` y `admin` no resolvían `@027apps/core/...` (pnpm strict). Añadido mapa `exports` en core (subrutas → `src/*.ts`) y dependencias `workspace:*` en ambos.
  5. **Test del guard con identidad de objeto**: el test comparaba dos objetos recién creados con `toBe`; reescrito para reutilizar la misma instancia.
- **Admin** (`apps/admin/`):
  - `lib/supabase/server.ts`: SSR client con cookies (`@supabase/ssr`; en Next 16 `cookies()` es async).
  - `lib/supabase/admin.ts`: service client (`SUPABASE_SERVICE_ROLE_KEY`, sin `NEXT_PUBLIC_`).
  - `lib/api/door.ts`: junta `withDoor` + `resolveCaller` real + storage de rate limit Postgres + logger JSON; expone `withTransactionClient` para transacciones en la misma conexión.
  - `app/api/v1/setup/super-admin/route.ts`: door pública con rate limit por IP (30/min), zod `.strict()`, `createFirstSuperAdmin` + `signInWithPassword` (cookies de sesión vía proxy) y 201 `{ user: { id, email } }`.
  - `app/(auth)/login/page.tsx` + `(auth)/actions.ts`: login email+contraseña con server action (credenciales nunca en JS de cliente).
  - `app/setup/page.tsx` + `submit.ts` + `page.test.tsx`: wizard pasos 1–2; el test cubre render del formulario y el contrato de `submitSuperAdmin` (201 ok, 409 mensaje del envelope, fallback genérico).
  - `src/proxy.ts`: **desviación del plan** — `middleware.ts` está deprecado en Next.js 16 y renombrado a `proxy.ts` (doc oficial en `node_modules/next/dist/docs`); el refresh de sesión corre en `proxy` con `@supabase/ssr`.
- **Config**: `supabase/config.toml` `jwt_expiry = 900`. `apps/admin/.env.local` con las 4 envs del stack local + `SETTINGS_ENCRYPTION_KEY` (gitignored). `SUPABASE_DB_URL` añadida al env local del admin (el door y el setup la usan para el pool `pg`).
- **Verde**: `pnpm lint && pnpm tsc && pnpm test` (admin 41, core 40, db-tests 33).
- **Pendiente para `finalizada`**: QA + auditoría OWASP (checklist A01/A07) en el cierre del sprint; aceptación del wizard en preview.

## Bitácora (2026-11-02) — auditoría, fixes y CI verde

- **Auditoría (2 agentes independientes, no autores)**: revisión de código + OWASP (A01/A07/A02/A05) → veredicto «aprobada con cambios». Hallazgos corregidos en `7b549b4` (16 ficheros): door endurecida (IP real: `x-real-ip` > `x-vercel-forwarded-for` > `x-forwarded-for`; cap de cuerpo 1 MB → `payload_too_large`; respuesta CORS dedicada `cors_origin_not_allowed`; buckets de rate limit separados por tipo de clave), `setup` cuenta solo `super_admin` **activos** (ruta de recuperación cuando el único super_admin está desactivado) y `keysEqual` muerto eliminado.
- **Fix de build en CI/Vercel** (`6d0c8f5`): `door.ts` leía y validaba envs en *module scope*, que Next 16 con Cache Components ejecuta en build → build roto sin envs. Ahora las credenciales se leen perezosamente en `getInfra()` con `connection()`, que marca las 9 rutas API como dinámicas; el build pasa sin credenciales y la puerta sigue fallando cerrada en runtime. Desviación documentada aquí, no en el plan original.
- **CI en verde** (run `41419226946`, commit `a31566d`): `admin` (lint+tsc+41 tests+build sin envs), `android`, `commitlint`, `guard-secrets` (patrones corregidos: sin falsos positivos contra `process.env.X`/PEM de fixture, y detecta fixtures de prueba), `supabase` (76/76 tests de integración contra el stack local en CI; export de `SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY/DB_URL` desde `supabase status` con valores citados despojados), `Vercel` (preview desplegada y accesible con SSO).
- **Pendiente para `finalizada`**: auditoría de seguridad final post-fix (agente distinto) + aceptación del wizard en preview (requiere paso B del doc CI/CD: `SUPABASE_DB_URL` en el entorno Preview de Vercel + migraciones en la BD remota — la preview hoy responde 500 fail-closed, por diseño).

## Bitácora (2026-11-02) — auditoría final y su resolución

- **Auditoría final (agente distinto, contexto inyectado)** sobre `897ea8b^..a31566d`: veredicto **«aprobada con cambios»** — sin críticos ni altos; confirma los 9 fixes previos como resueltos y añade 2 medios bloqueantes + 5 menores.
- **Hallazgos resueltos** (commit `fix(core,admin)` de este mismo día):
  1. (Medio) Transacción sin cablear en producción: `runInTransaction` (BEGIN/COMMIT/ROLLBACK) inyectado en `settingsDeps` y `currenciesDeps` de `lib/api/door.ts`; `setup` sigue usando `withTransactionClient` como binding puro (gestiona su propio BEGIN).
  2. (Medio) Cabeceras A03: `next.config.ts` añade `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` y `X-Frame-Options: DENY` en todas las respuestas. **CSP**: el proxy emite la política estricta con nonce (patrón oficial del doc bundled) en modo **`Report-Only`** — con Cache Components todo route prerenderiza un shell estático cuyos scripts inline no pueden llevar nonce por petición, y un CSP bloqueante rompería el panel; el paso a bloqueante queda condicionado a verificación en navegador real (deuda documentada, no silenciosa).
  3. (Bajo) Cuerpo chunked sin `content-length` >1 MB: `readBody` lee el stream con cap duro (`readBodyText`); test nuevo en verde.
  4. (Bajo) Piso de contraseña: `min(12)` en la ruta de setup, placeholder «Min 12 characters» y `minimum_password_length = 12` en `supabase/config.toml` (alineación dev/producción).
  5. (Bajo) Clave maestra malformada = degradación invisible: canario `encrypt("027apps-canary")` en `createInfra`; si devuelve `null`, `encryption` se trata como ausente → `/health` degradado y escrituras fail-closed.
  6. (Bajo) GET autenticados sin tope: `rateLimits.read` (default 120/min por identidad) en `GET /settings`, `GET /settings-categories` y `GET /currencies`, con tests 429 en db-tests.
- **Hallazgos aceptados y documentados** (no código): IP spoofable sin proxy de confianza + purga de `rate_limit_counters` (deuda sprint-06, se documenta en `infrastructure.md`); `security.cors_allowlist`/`rate_limit.*` del catálogo aún inertes (sprint-06); credenciales del wizard pasan por JS cliente (contraseña del propio instalador; server action futuro); `/setup` accesible tras el setup (responde 409).
- **Verde tras los fixes**: `pnpm lint` ✓ (0 warnings), `pnpm tsc` ✓, `pnpm test` ✓ (core 69, admin 41, db-tests 78), `pnpm --filter admin build` ✓ sin envs (16/16 estáticas). Fichero huérfano `apps/admin/-w` eliminado.
