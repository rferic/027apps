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
