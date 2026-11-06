# Sprint-05 Core base — Plan de implementación

> **For agentic workers:** este plan define los entregables y pasos de cada tarea del sprint de forma
> granular. No contiene código completo: contiene archivos, interfaces, esqueletos y tests que hay que
> escribir. Cada tarea sigue el ciclo **TDD: test rojo → implementación → verde**. Los detalles finos
> de comportamiento (mensajes, formas exactas) están en las specs citadas; el plan fija los
> nombres y rutas de los archivos y el orden de implementación.

**Fecha:** 2026-10-31
**Autor:** Agente (plan de ejecución)
**Estado:** Aprobado por el usuario
**Sprint:** [sprint-08-core-base](../../tasks/sprint-08-core-base/README.md)
**Specs:** [2026-10-26-core-data-model.md](../specs/2026-10-26-core-data-model.md) · [2026-10-26-core-api.md](../specs/2026-10-26-core-api.md) · [2026-10-26-instance-config.md](../specs/2026-10-26-instance-config.md) · [2026-10-26-i18n-operativa.md](../specs/2026-10-26-i18n-operativa.md) · [2026-10-26-observabilidad.md](../specs/2026-10-26-observabilidad.md) · [2026-10-25-auth.md](../specs/2026-10-25-auth.md) · [2026-10-25-api-v1.md](../specs/2026-10-25-api-v1.md)

## Meta (Goal)

Implementar la **base del Core** con TDD: migraciones y RLS de las tablas base, auth con guard de
scopes y `/setup` atómico, esqueleto `/api/v1` con envelope de errores y rate limiting, settings
cifrados con catálogo de 18 claves, pipeline i18n operativo y observabilidad (logger JSON + Sentry
con scrub fail-closed).

## Arquitectura (Architecture)

- **Capa de aplicación** en `packages/core` (nuevo paquete del workspace, `@027apps/core`):
  casos de uso (setup, settings, guard), errores de dominio, pipeline de puertas, cifrado,
  catálogo de settings, logger y Sentry.
- **Puertas delgadas** en `apps/admin/src/app/api/v1/**` (route handlers): autentican, autorizan
  (guard), validan (zod `.strict()`) y delegan en el caso de uso. Sin lógica de negocio.
- **Entorno de ejecución:** Supabase local (`supabase start`, ya versionado en el repo) para
  desarrollo y para la **suite de integración** `packages/db-tests` (RLS, migraciones, auth local).
  El proyecto cloud `027apps-dev` + Vercel solo hacen falta para cerrar el sprint (aceptación en
  preview), no para empezar.
- **Test a dos niveles** (ADR 0004 + `testing-strategy.md`): caso de uso (sin HTTP) y puerta
  (route handler con request fabricado). RLS se testea en `packages/db-tests` con SQL real.

## Tech Stack

- Next.js 16 (route handlers, React 19), TypeScript, pnpm workspace.
- Supabase local (Postgres + Auth + GoTrue) con `supabase start`.
- Vitest (unit + integración), `pg` (node-postgres) para la suite RLS, `@supabase/ssr` para sesión
  por cookies, `@supabase/supabase-js` (ya instalado), `zod` (nuevo), `@sentry/nextjs` (nuevo).
- **Docs Next.js 16:** antes de escribir cualquier código Next, leer `node_modules/next/dist/docs`
  (rutas, route handlers, middleware, server components).

## Restricciones globales (de las specs y convenciones)

1. **TDD**: cada tarea arranca con los tests que fallan antes del código.
2. **RLS en todas las tablas** con `SECURITY DEFINER` helpers (STABLE, `search_path = ''`,
   `REVOKE EXECUTE FROM PUBLIC`).
3. **IDs `uuid`**, `timestamptz`, dinero nunca en el Core (solo `amount_minor` en módulos, ADR 0008).
4. **Errores** con envelope ADR 0007: `{ error: { code, message, request_id, details } }` —
   códigos en `snake_case`, sin SQL, stack traces, rutas internas ni secretos.
5. **`X-Request-Id`** en todas las respuestas (éxito y error), generado en la puerta (UUIDv4,
   nunca del cliente). El envelope de error lo repite.
6. **zod `.strict()`** en todos los bordes de entrada.
7. **AES-256-GCM** para `value_encrypted`: nonce de 12 B nuevo por cifrado, AAD = `<versión>|<category_key>.<key>`,
   formato `v1:<iv_b64>:<tag_b64>:<ciphertext_b64>`. La clave maestra vive solo en
   `SETTINGS_ENCRYPTION_KEY` (env del hosting, jamás en BD/git/logs).
8. **Rate limiting** sobre `rate_limit_counters` (decisión Z, task-01) con upsert atómico:
   `INSERT … ON CONFLICT (key, window_start) DO UPDATE SET count = count + 1`.
9. **i18n**: el texto inglés es la clave; los 9 locales (`en es ca it fr de pt gl eu`) se validan en CI.
10. **Sin `any`**; sin colores hardcodeados (solo tokens de `design-tokens.css`).
11. Cada tarea actualiza su `docs/tasks/sprint-08-core-base/task-NN.md` con `adrs:` y evidencia real.
12. Idioma: código/commits/PR en inglés; docs internos en español.

## Focus de revisión (los 5 puntos de riesgo más probables)

1. **RLS sin cobertura completa**: cada tabla nueva debe tener su suite de aislamiento. Una tabla
   sin RLS = fuga.
2. **Envelope con internos**: un stack trace, SQL o secreto en el envelope → test de puerta que
   detecta cualquier fuga por cada código de error.
3. **`request_id` no propagado** en todas las respuestas (incluido CORS `expose`).
4. **Cifrado de settings**: nonce reutilizado, AAD ausente o formato sin versión → tests vectoriales.
5. **i18n**: placeholder `{x}` en un locale pero no en otro, o catálogo stale que rompe el runtime.

---

## Task 1: Migraciones base + RLS + suite de aislamiento (sprint-08-core-base task-01)

**Files:**
- Create: `supabase/migrations/0001_profiles.sql`
- Create: `supabase/migrations/0002_settings.sql`
- Create: `supabase/migrations/0003_currencies.sql`
- Create: `supabase/migrations/0004_rate_limit_counters.sql`
- Create: `packages/db-tests/package.json`
- Create: `packages/db-tests/tsconfig.json`
- Create: `packages/db-tests/vitest.config.mts`
- Create: `packages/db-tests/src/pg.ts`
- Create: `packages/db-tests/src/rls/profiles.test.ts`
- Create: `packages/db-tests/src/rls/settings.test.ts`
- Create: `packages/db-tests/src/rls/currencies.test.ts`
- Create: `packages/db-tests/src/rls/rate-limit.test.ts`
- Create: `packages/test-utils/package.json` (factories + family-set de `testing-strategy.md` §3)
- Modify: `.github/workflows/ci.yml` (job `supabase`)
- Modify: `docs/flows/cicd.md`
- Modify: `docs/tasks/sprint-08-core-base/task-01.md`

**Interfaces produced:**

- `core_is_super_admin()`, `core_is_admin()` — SQL `SECURITY DEFINER`, `STABLE`, `SET search_path = ''`,
  `REVOKE EXECUTE FROM PUBLIC` y `GRANT EXECUTE TO authenticated, service_role`.
- `profiles` — id uuid PK → `auth.users(id)`, display_name, locale, timezone,
  role `CHECK (role IN ('super_admin','admin','user'))`, deactivated_at, created_at, updated_at.
- `settings_categories` — category_key PK, label, help, icon, sort_order, source
  (`CHECK (source = 'core' OR source LIKE 'module:%')`), created_at.
- `settings` — id uuid PK, category_key FK, key, label, help, value jsonb, value_encrypted text,
  is_secret bool, is_public bool, mcp_access `CHECK ('none','read','write')`, sort_order,
  updated_by uuid FK→profiles, updated_by_key uuid, created_at, updated_at,
  `UNIQUE (category_key, key)`,
  `CHECK ((updated_by IS NOT NULL) + (updated_by_key IS NOT NULL) <= 1)`,
  `CHECK (is_secret = false OR (value IS NULL AND value_encrypted IS NOT NULL))`,
  `CHECK (is_secret = true OR value_encrypted IS NULL)`.
- `currencies` — code text PK, enabled bool default true, created_at, updated_at.
- `rate_limit_counters` — (key text, window_start timestamptz) PK, count int, expires_at timestamptz.
- `packages/db-tests/src/pg.ts`:
  ```ts
  export async function withClient<T>(fn: (c: Client) => Promise<T>): Promise<T>
  export async function impersonate(c: Client, userId: string): Promise<void>
  // Ejecuta SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '{"sub": "..."}', true);
  ```

**Steps:**

1. Escribe `0001_profiles.sql` con la tabla + helpers `core_is_super_admin()` / `core_is_admin()`,
   **sin** políticas RLS todavía.
2. Escribe `0002_settings.sql` (categories + settings, sin RLS) y `0003_currencies.sql` (tabla +
   `INSERT` de la lista completa ISO 4217 con `enabled = true`, ~180 filas — lista canónica de la
   tabla oficial ISO; el executor la genera de una sola vez y la commitea).
3. Escribe `0004_rate_limit_counters.sql` (sin RLS).
4. `supabase db reset` → migraciones aplicadas limpias. `supabase start` activo.
5. Crea el paquete `packages/db-tests` con `vitest.config.mts` (env: `SUPABASE_DB_URL` con
   `postgres://postgres:postgres@127.0.0.1:54322/postgres` de la pila local).
6. Escribe los tests RLS **fallando** (rojo):
   - `profiles.test.ts`: «un usuario no puede leer la fila de otro», «un usuario no puede editarse
     su rol (column grant)», «un admin puede leer todos los perfiles», «un usuario desactivado no
     aparece en listados de admin», «anon no puede leer nada».
   - `settings.test.ts`: «un usuario no puede leer settings», «un admin puede leer settings»,
     «un usuario no puede insertar/actualizar settings», «is_secret=true con value → CHECK viola»,
     «updated_by y updated_by_key simultáneos → CHECK viola».
   - `currencies.test.ts`: «un autenticado puede leer», «un admin puede deshabilitar», «un usuario
     no puede deshabilitar», «anon no puede leer».
   - `rate-limit.test.ts`: «un autenticado no puede leer», «un autenticado no puede insertar»
     (RLS niega todo; solo service_role escribe).
7. Ejecuta `pnpm --filter db-tests test` → confirma **rojo**.
8. Añade RLS a las migraciones (edita 0001–0004 en el mismo commit, `supabase db reset` de nuevo):
   - `profiles`: `ENABLE ROW LEVEL SECURITY`; `GRANT SELECT ON profiles TO authenticated`;
     `GRANT UPDATE (display_name, locale, timezone) ON profiles TO authenticated` (column grant —
     protege `role` y `deactivated_at`); policies: `FOR SELECT USING (id = auth.uid() OR core_is_admin())`,
     `FOR UPDATE USING (id = auth.uid())` y otra `FOR UPDATE USING (core_is_admin())`
     con `WITH CHECK (core_is_admin())`.
   - `settings` / `settings_categories`: RLS con SELECT/INSERT/UPDATE solo `core_is_admin()`;
     no hay policy para anon ni para usuarios.
   - `currencies`: `GRANT SELECT TO authenticated`; policy `FOR SELECT USING (auth.uid() IS NOT NULL)`;
     policy `FOR UPDATE USING (core_is_admin()) WITH CHECK (core_is_admin())`.
   - `rate_limit_counters`: RLS enable, **sin policies** (deniega todo a anon/authenticated;
     el servidor usa `service_role` que bypassa RLS).
9. Ejecuta los tests → **verde**. Confirma que fallan si quitas una política (spot-check).
10. Actualiza `docs/tasks/sprint-08-core-base/task-01.md` con evidencia (salida de `supabase db reset`
    + tests) y `adrs: [0004, 0008]`.

**Acceptance criteria:**
- `supabase db reset` aplica las 4 migraciones limpias (output leído por el executor).
- `pnpm --filter db-tests test` pasa 100 % y valida cada política.
- Un usuario **no puede** escalar `role` ni `deactivated_at` (column grants bloquean a nivel SQL).
- `rate_limit_counters` es ilegible para anon/authenticated (solo service_role).
- Job `supabase` en CI con `supabase start` + `pnpm --filter db-tests test`.

---

## Task 2: Esqueleto de la API v1 (sprint-08-core-base task-03)

**Files:**
- Create: `packages/core/package.json` (name `@027apps/core`, dep zod)
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/vitest.config.mts`
- Create: `packages/core/src/errors.ts`
- Create: `packages/core/src/api/types.ts`
- Create: `packages/core/src/api/door.ts`
- Create: `packages/core/src/api/rate-limit.ts`
- Create: `packages/core/src/errors.test.ts`
- Create: `packages/core/src/api/door.test.ts`
- Create: `packages/core/src/api/rate-limit.test.ts`
- Create: `packages/core/src/api/rate-limit-storage.ts` (port + implementación con service client)
- Modify: `.github/workflows/ci.yml` (job `admin`: añadir `pnpm --filter @027apps/core test`)

**Interfaces produced:**

```ts
// packages/core/src/errors.ts
export type DomainErrorCode =
  | 'validation_failed' | 'unauthorized' | 'insufficient_scope' | 'not_found'
  | 'conflict' | 'rate_limited' | 'already_setup' | 'currency_not_enabled'
  | 'locale_not_available' | 'internal';
export class DomainError extends Error {
  constructor(code: DomainErrorCode, message?: string, details?: Record<string, unknown>);
  readonly code: DomainErrorCode;
  readonly details?: Record<string, unknown>;
}
export function toEnvelope(err: unknown, requestId: string): { error: { code, message, request_id, details? } }
```

```ts
// packages/core/src/api/types.ts
export type Caller =
  | { kind: 'session'; userId: string; role: 'super_admin' | 'admin' | 'user' }
  | { kind: 'service'; keyId: string; scopes: string[]; roleCap: 'admin' | 'super_admin' }
  | { kind: 'delegated'; keyId: string; scopes: string[]; roleCap: 'admin' | 'super_admin'; userId: string }
  | { kind: 'anon' };

export interface RequestContext {
  requestId: string;
  caller: Caller;
  body?: unknown;
  searchParams: URLSearchParams;
}

export interface DoorOptions {
  scopes: string[];
  auth: (req: Request) => Promise<Caller>;
  rateLimit?: { identity: 'user' | 'key' | 'ip'; limit: number };
  cors?: boolean;
}
export interface DoorDeps {
  rateLimitStorage: RateLimitStorage;
  logger: (entry: LogEntry) => void;  // Task 6 lo sustituye por logger JSON; ahora console stub
}
export function withDoor(
  req: Request,
  options: DoorOptions,
  deps: DoorDeps,
  handler: (ctx: RequestContext) => Promise<Response | JsonValue>,
): Promise<Response>
```

```ts
// packages/core/src/api/rate-limit-storage.ts
export interface RateLimitStorage {
  increment(key: string, windowStart: Date, expiresAt: Date): Promise<{ count: number }>;
}
export function createSupabaseRateLimitStorage(client: SupabaseServiceClient): RateLimitStorage
// SQL: INSERT INTO rate_limit_counters (key, window_start, count, expires_at)
//      VALUES ($1, $2, 1, $3)
//      ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limit_counters.count + 1
//      RETURNING count
```

**Pipeline de `withDoor` (orden de pasos):**

1. Genera `requestId = crypto.randomUUID()` (nunca del cliente).
2. OPTIONS + `cors` → responde preflight: si el origen está en allowlist → 204 con
   `Access-Control-Allow-Origin/Methods/Headers`; si no → 403 envelope.
3. Resuelve `caller = await options.auth(req)`.
4. Si `rateLimit` presente: deriva la identidad (`user` → userId, `key` → keyId, `ip` → IP),
   llama a `rateLimitStorage.increment()`. Si `count > limit` → DomainError('rate_limited')
   + `Retry-After` header con los segundos hasta el fin de ventana.
5. Si el método trae cuerpo (POST/PATCH/PUT): valida con el schema zod del handler
   (`.strict()`); fallo → `DomainError('validation_failed', undefined, zodError.flatten())`.
6. Ejecuta `handler(ctx)`; el handler puede devolver un `JsonValue` (se serializa como JSON 200)
   o un `Response` (se devuelve tal cual).
7. `DomainError` → respuesta con el envelope ADR 0007 + cabecera `X-Request-Id` + código HTTP
   correspondiente (400/401/403/404/409/429/500).
8. Error desconocido → DomainError('internal', 'Internal server error') sin internos, logueado.
9. Siempre añade cabecera `X-Request-Id` (éxito y error). CORS `expose: ['X-Request-Id']`.

**Steps:**

1. Crea el paquete `packages/core` con `tsconfig.json` que extienda el base y `vitest.config.mts`.
2. Escribe `errors.test.ts` (rojo): para cada código, el envelope tiene la forma exacta y el
   mensaje por defecto en inglés (es la clave del catálogo i18n, task-05); `toEnvelope` no incluye
   stack, SQL ni rutas internas aunque el error lleve más info.
3. Implementa `errors.ts` (verde).
4. Escribe `rate-limit.test.ts` (rojo): incremento atómico (counter sube en cada llamada),
   dos llamadas desde la misma identidad comparten ventana, ventana nueva por minuto distinto,
   fake storage con múltiples clientes.
5. Implementa `rate-limit-storage.ts` (verde) — el SQL se ejecuta con un cliente `pg`/supabase-js
   inyectado (para poder testear con fake + real más adelante).
6. Escribe `door.test.ts` (rojo): los casos listados arriba (envelope, X-Request-Id, 401/403/429,
   Retry-After, CORS allowlist, CORS rechazo, `validation_failed` con `details` de zod, error
   desconocido → 500 sin internos).
7. Implementa `door.ts` (verde).
8. Añade `pnpm --filter @027apps/core test` al job `admin` de CI.
9. Actualiza `docs/tasks/sprint-08-core-base/task-03.md` con evidencia y `adrs: [0004, 0007, 0008]`.

**Acceptance criteria:**
- Cada `DomainError` produce el envelope exacto y el código HTTP correcto.
- `X-Request-Id` presente en éxito y en error; `request_id` en el envelope de error.
- `429` con cabecera `Retry-After`.
- CORS preflight con origen no listado → 403; con origen listado → 204 con cabeceras.
- Sin `any`, sin `console.log` en producción (logger stub declarado in `DoorDeps`).

---

## Task 3: Auth, sesión SSR, guard de scopes y /setup (sprint-08-core-base task-02)

**Files:**
- Create: `packages/core/src/auth/guard.ts`
- Create: `packages/core/src/auth/caller.ts`
- Create: `packages/core/src/auth/setup.ts`
- Create: `packages/core/src/auth/guard.test.ts`
- Create: `packages/db-tests/src/auth/caller.test.ts`
- Create: `packages/db-tests/src/auth/setup.test.ts`
- Create: `apps/admin/src/lib/supabase/server.ts` (SSR helper — @supabase/ssr)
- Create: `apps/admin/src/lib/supabase/admin.ts` (service client para el servidor)
- Create: `apps/admin/src/lib/api/door.ts` (helper que une withDoor + resolver real + storage real)
- Create: `apps/admin/src/app/api/v1/setup/super-admin/route.ts`
- Create: `apps/admin/src/app/(auth)/login/page.tsx`
- Create: `apps/admin/src/app/setup/page.tsx` (wizard: pasos 1–2)
- Create: `apps/admin/src/app/setup/page.test.tsx`
- Modify: `apps/admin/src/middleware.ts` (refresh de sesión con @supabase/ssr)
- Modify: `supabase/config.toml` (JWT expiry 900 s — verificar el nombre exacto de la clave
  en la documentación del config.toml de Supabase; el target es 900)
- Modify: `apps/admin/.env.local` (añadir `SETTINGS_ENCRYPTION_KEY` placeholder para dev)
- Modify: `apps/admin/package.json` (dependencias @supabase/ssr, zod)

**Interfaces produced:**

```ts
// packages/core/src/auth/guard.ts
export function authorize(caller: Caller, scopes: string[]): Caller;
// - session: comprueba el rol contra los scopes requeridos (perfil → 'profile:read' siempre ok,
//   gestión → is_admin(), lo de super_admin → is_super_admin()).
// - service/delegated: min(scopes, roleCap) — una clave con roleCap='admin' no puede actuar
//   como super_admin.
// - anon: DomainError('unauthorized').
// - sin el scope requerido → DomainError('insufficient_scope') (403, sin enumerar el recurso).
```

```ts
// packages/core/src/auth/caller.ts
export interface CallerResolverDeps {
  supabase: SupabaseServerClient; // session auth (verifica el JWT con getUser)
  profiles: ProfilesPort;         // lee el rol desde profiles
}
export async function resolveCaller(req: Request, deps: CallerResolverDeps): Promise<Caller>
// - Authorization: Bearer <jwt> → session caller (verificado con getUser(jwt)).
// - Sin header → anon caller (la puerta decide si lo admite).
```

```ts
// packages/core/src/auth/setup.ts
export interface SetupDeps {
  auth: { createUser(email: string, password: string): Promise<{ userId: string }> };
  db: { query(sql: string, params: unknown[]): Promise<QueryResult> };
}
export async function createFirstSuperAdmin(
  deps: SetupDeps,
  input: { email: string; password: string; displayName: string },
): Promise<{ userId: string; email: string }>
// - Transacción: SELECT pg_advisory_xact_lock(hashtext('core_setup'));
//   re-chequeo de requires_setup (no super_admin existente) → DomainError('already_setup') si hay.
// - INSERT profiles (role='super_admin', display_name, email).
// - Si la transacción falla → rollback; el usuario de Auth queda huérfano (limpieza: se borra
//   con deleteUser si falla el insert).
```

**Steps:**

1. `pnpm --filter admin add @supabase/ssr zod` (y `pg` a `db-tests` ya añadido en task 1).
2. `supabase/config.toml`: fija el JWT de access token a 900 s (verifica la clave exacta en la
   documentación oficial del config.toml de Supabase). `supabase db reset` + `supabase start`.
3. Escribe `guard.test.ts` (rojo) en `packages/core`:
   - `authorize(session super_admin, ['settings:write'])` → ok.
   - `authorize(session user, ['users:read'])` → DomainError('insufficient_scope').
   - `authorize(session admin, ['users:write'])` → ok (admin gestiona, no toca super_admin).
   - `authorize(service, ['settings:write'])` con roleCap='admin' → DomainError('insufficient_scope').
   - `authorize(anon, ['profile:read'])` → DomainError('unauthorized').
4. Implementa `guard.ts` (verde).
5. Escribe `caller.test.ts` (rojo) en `db-tests` contra la pila local:
   - Crea un usuario de Auth vía Admin API local (`service_role`), obtiene sesión (signInWithPassword),
     construye un Request con `Authorization: Bearer <access_token>`.
   - `resolveCaller` → session caller con rol desde `profiles`.
   - Sin header → anon caller.
   - Token inválido → DomainError('unauthorized').
6. Implementa `caller.ts` (verde).
7. Escribe `setup.test.ts` (rojo) en `db-tests`:
   - Dos `createFirstSuperAdmin` concurrentes → exactamente uno resuelve; el otro lanza
     DomainError('already_setup').
   - Tras un setup exitoso, una segunda llamada lanza `already_setup` (sin filtrar datos).
   - El `display_name` y `email` persisten en `profiles`.
   - Si el INSERT falla, el usuario de Auth se borra (limpieza).
8. Implementa `setup.ts` (verde).
9. Crea `apps/admin/src/lib/supabase/server.ts` (SSR helper con cookies, `@supabase/ssr`) y
   `apps/admin/src/lib/supabase/admin.ts` (service client para el servidor).
10. Crea `apps/admin/src/lib/api/door.ts`: helper que une `withDoor` + `resolveCaller` real +
    storage real + logger stub.
11. Crea `apps/admin/src/app/api/v1/setup/super-admin/route.ts`:
    - Door pública (`auth: () => anon caller`), rate limit por IP (30/min, decision K del instance-config),
      zod `.strict()` con `{ email, password (min 6), display_name (1..80) }`.
    - `createFirstSuperAdmin` + después `signInWithPassword` en el server client (para que el
      browser reciba las cookies de sesión por el middleware).
    - Respuesta 201 `{ user: { id, email } }` (sin secrets).
12. Crea `apps/admin/src/app/(auth)/login/page.tsx` (formulario email+contraseña, UI mínima con
    tokens del DS, `t("…")` para textos) y `apps/admin/src/app/setup/page.tsx` (pasos 1–2 del
    wizard: paso 1 verifica envs — solo guía visual, no API; paso 2 formulario super admin).
13. Test de página `apps/admin/src/app/setup/page.test.tsx` (rojo): renderiza el formulario, al
    enviar llama al route handler, redirige a `/` tras 201.
14. `apps/admin/src/middleware.ts`: refresh de sesión con `@supabase/ssr` (`updateSession`).
15. `apps/admin/.env.local` (ignorado por git): añade `SETTINGS_ENCRYPTION_KEY=<demo-32B-base64>`
    (la generada en sprint-04-infra task-09; el usuario la pega manualmente si hace falta).
16. Actualiza `docs/tasks/sprint-08-core-base/task-02.md` con evidencia y `adrs: [0004, 0007]`.

**Acceptance criteria:**
- Guard: 401 (anon) / 403 (sin scope) sin fugas, mensajes en inglés (clave i18n).
- `/setup` no reabrible: `already_setup` tras el primer super_admin.
- Concurrencia: dos instaladores → uno gana, otro `already_setup`.
- Login page + middleware SSR con cookies HttpOnly/Secure/SameSite.
- La sesión del wizard (paso 2) deja al usuario autenticado y con `role='super_admin'`.

---

## Task 4: Salud, instancia, settings cifrados y currencies (sprint-08-core-base task-04)

**Files:**
- Create: `packages/core/src/crypto.ts` (AES-256-GCM con formato versionado)
- Create: `packages/core/src/crypto.test.ts`
- Create: `packages/core/src/settings/catalog.ts` (18 claves con zod + metadata)
- Create: `packages/core/src/settings/catalog.test.ts` (idempotencia de seed + 18 claves)
- Create: `packages/core/src/settings/service.ts` (read/write/mask + seeding)
- Create: `packages/core/src/settings/service.test.ts` (db-tests: integración con pila local)
- Create: `apps/admin/src/app/api/v1/health/route.ts`
- Create: `apps/admin/src/app/api/v1/instance/route.ts`
- Create: `apps/admin/src/app/api/v1/settings/route.ts`
- Create: `apps/admin/src/app/api/v1/settings/[category]/[key]/route.ts`
- Create: `apps/admin/src/app/api/v1/settings-categories/route.ts`
- Create: `apps/admin/src/app/api/v1/currencies/route.ts`
- Create: `apps/admin/src/app/api/v1/currencies/[code]/route.ts`
- Create: `packages/db-tests/src/api/settings.test.ts` (integración de puertas con la pila local)
- Modify: `supabase/migrations/0002_settings.sql` (seed del catálogo: 18 filas + categorías)
- Modify: `docs/tasks/sprint-08-core-base/task-04.md`

**Interfaces produced:**

```ts
// packages/core/src/crypto.ts
export interface EncryptionKeyPort {
  decrypt(valueEncrypted: string, slot: string): Promise<string>;  // slot = "<category_key>.<key>"
  encrypt(plaintext: string, slot: string): Promise<string>;
}
export function createSettingsEncryption(key: string): EncryptionKeyPort
// AES-256-GCM, nonce 12 B nuevo por cifrado, AAD = "<versión>|<slot>",
// formato "v1:<iv_b64>:<tag_b64>:<ciphertext_b64>".
// Rotación: al re-cifrar, nonce nuevo y AAD recalculado. Fallo de descifrado → null (se trata
// como no configurado, se loguea sin el valor).
```

```ts
// packages/core/src/settings/catalog.ts
export interface SettingMeta {
  key: string;          // "instance.name"
  category: string;
  type: 'string' | 'int' | 'url' | 'locale' | 'currency' | 'locales' | 'json' | 'enum' | 'array';
  label: string; help: string;
  isSecret: boolean; isPublic: boolean;
  mcpAccess: 'none' | 'read' | 'write';
  sort: number;
  superAdminOnly: boolean;
  schema: z.ZodType;
  validateCoherence?: (all: Record<string, unknown>) => void; // p. ej. FCM coherente
}
export const SETTINGS_CATALOG: SettingMeta[];  // 18 claves, tabla §4 del instance-config
export function getSettingMeta(key: string): SettingMeta | undefined;
```

Las 18 claves (defaults de §4 del instance-config):

| Clave | Default | Secreto | Público | mcp_access |
|---|---|---|---|---|
| `instance.name` | `027Apps` | no | sí | read |
| `localization.default_locale` | `en` | no | sí | read |
| `localization.timezone` | `UTC` | no | sí | read |
| `localization.default_currency` | `EUR` | no | sí | read |
| `localization.enabled_locales` | `["en"]` | no | sí | read |
| `security.jwt_expiry` | `900` (solo lectura) | no | no | none |
| `instance.public_url` | — (obligatoria) | no | sí | none |
| `security.cors_allowlist` | `[]` (máx 20, sin `*`, sin rutas) | no | no | none |
| `notifications.push.provider` | `none` (`fcm`\|`none`) | no | no | none |
| `notifications.push.fcm_project_id` | — | no | sí | read |
| `notifications.push.fcm_app_id` | — | no | sí | read |
| `notifications.push.fcm_api_key` | — | no | sí | read |
| `notifications.push.fcm_sender_id` | — | no | sí | read |
| `notifications.push.fcm_service_account` | — | **sí** | no | none |
| `rate_limit.mobile_per_min` | `120` | no | no | none |
| `rate_limit.api_key_per_min` | `30` | no | no | none |
| `rate_limit.write_per_min` | `10` | no | no | none |
| `rate_limit.public_per_min` | `30` | no | no | none |

```ts
// packages/core/src/settings/service.ts
export interface SettingsDeps {
  db: SupabaseServiceClient;   // service_role
  encryption: EncryptionKeyPort | null; // null = clave ausente (degraded)
}
export async function readAllSettings(deps): Promise<Setting[]>            // masked para API admin
export async function readPublicSettings(deps): Promise<Setting[]>         // is_public = true
export async function readSettingsForApi(deps, caller): Promise<Setting[]> // /settings
export async function writeSetting(deps, caller, key, value): Promise<Setting> // /settings/{category}.{key}
// writeSetting:
//   - meta = getSettingMeta(key) → si no existe: DomainError('not_found')
//   - superAdminOnly && caller.role !== 'super_admin' → DomainError('insufficient_scope')
//   - mcp_access = 'none' (v1) → solo session admin/super_admin (reservado MCP)
//   - valida con meta.schema (zod) + coherencia
//   - para is_secret: cifra (nonce nuevo, AAD) → value_encrypted
//   - updated_by = caller.userId (sesión); updated_by_key reservado (sprint-09-core-data)
//   - No se puede modificar la metadata (label, help, is_secret, is_public, mcp_access, source)
```

```ts
// packages/core/src/settings/health-status.ts (se usa en /health y /instance)
export interface HealthStatus {
  status: 'ok' | 'degraded';
  degradedReasons: string[];
}
export async function computeHealth(deps): Promise<HealthStatus>
// degraded si: no hay conexión BD, o secretos configurados y SETTINGS_ENCRYPTION_KEY ausente/inválida.
```

**Steps:**

1. Escribe `crypto.test.ts` (rojo) — la tabla de tests:
   - Cifra → descifra: ida y vuelta correcta.
   - Dos cifrados del mismo plaintext con el mismo slot producen ciphertexts **diferentes**
     (nonce nuevo por cifrado).
   - El AAD cambia al cambiar el slot → descifrado con otro slot **falla** (no devuelve el claro).
   - Formato de salida empieza por `v1:`.
   - Rotación: re-cifrado con la misma clave produce ciphertext distinto, descifra igual.
   - Descifrado con clave incorrecta → devuelve null (no lanza), logueado sin el valor.
2. Implementa `crypto.ts` (verde) con Node `crypto` (`createCipheriv('aes-256-gcm')`).
3. Escribe `catalog.test.ts` (rojo) en `db-tests`:
   - El seed del catálogo (18 claves) tras una migración limpia coincide exactamente con las
     filas de `settings` + `settings_categories` (sync check — fail si drift).
   - `readAllSettings` devuelve 18 settings con defaults.
   - `is_secret=true` filas tienen `value = null` y `value_encrypted != null` (FK CHECK).
4. Implementa `catalog.ts` (zod schemas de la tabla) + seed en `0002_settings.sql`.
5. Escribe `service.test.ts` (rojo) en `db-tests`:
   - `writeSetting` con una clave inexistente → `not_found`.
   - `writeSetting('security.jwt_expiry', …)` → rechazado (solo lectura).
   - `writeSetting('security.cors_allowlist', …)` por un admin (no super_admin) → `insufficient_scope`.
   - `writeSetting('instance.public_url', 'not-a-url')` → `validation_failed` con `details` por campo.
   - `writeSetting('localization.default_currency', 'XXX')` → `currency_not_enabled` (no existe o
     deshabilitada).
   - `writeSetting('localization.enabled_locales', ['es'])` (sin `en`) → `validation_failed`
     (`en` obligatorio).
   - FCM coherente: `provider=fcm` sin las 5 claves → `validation_failed`; service account JSON
     con `project_id` distinto → `validation_failed`.
   - `writeSetting('notifications.push.fcm_service_account', …)` → `value_encrypted` presente y
     `value = null`; **`value_encrypted` nunca sale por la API**.
6. Implementa `service.ts` (verde).
7. Crea las rutas de la API:
   - `GET /api/v1/health`: door pública, sin rate limit (o con 30/min por IP, decisión de
     instance-config §6), `computeHealth` → `{ status, degradedReasons? }` + HTTP 200/503,
     `Cache-Control: public, max-age=30`.
   - `GET /api/v1/instance`: door pública. Devuelve `{ version, requires_setup, setup_incomplete,
     settings_public }`. `settings_public` = los 8 is_public (`instance.name`,
     `localization.default_locale/timezone/default_currency/enabled_locales`,
     `instance.public_url`, los 4 `fcm_*` públicos). **Nunca** CORS, rate limits, `security.*` ni
     secretos. `version` del `package.json` del Core.
   - `GET /api/v1/settings`: door con `authorize(caller, ['settings:read'])`; respuestas enmascaradas
     (`{ key, label, category, is_secret, configured, is_public, mcp_access, sort }`, sin valores).
   - `GET /api/v1/settings-categories`: `authorize(caller, ['settings:read'])`; agrupado por `sort_order`.
   - `PATCH /api/v1/settings/{category}.{key}`: `authorize(caller, ['settings:write'])` + regla de
     `superAdminOnly`; body `.strict()` `{ value }` solo; `writeSetting` (valor/cifrado).
   - `GET /api/v1/currencies`: autenticado; lista enabled + default.
   - `PATCH /api/v1/currencies/{code}`: `authorize(caller, ['currencies:write'])`; deshabilitar la
     moneda default → `DomainError('currency_not_enabled')`.
8. Escribe `settings.test.ts` (rojo) en `db-tests` (integración de puertas con request fabricados
   contra la pila local): los flujos completos GET/PATCH sobre las rutas de la API.
9. Implementa las rutas (verde).
10. `apps/admin/.env.local` debe tener `SETTINGS_ENCRYPTION_KEY` (ya hecho en task 3).
11. Actualiza `docs/tasks/sprint-08-core-base/task-04.md` con evidencia y `adrs: [0004, 0007, 0008]`.

**Acceptance criteria:**
- Los 18 settings del catálogo se siembran por migración y el sync check detecta drift.
- Secretos: nonce nuevo por cifrado, AAD por slot, formato `v1:`; write-only (nunca sale en claro).
- `/settings` GET muestra secrets enmascarados (`configured: bool`, sin valor).
- `/instance` nunca expone CORS, rate limits, `security.*` ni secretos.
- `/health` responde 200 (ok) o 503 (degraded) con `Cache-Control: max-age=30`.
- Moneda default no deshabilitable (`currency_not_enabled`).

---

## Task 5: i18n operativa (sprint-08-core-base task-05)

**Files:**
- Create: `packages/i18n/package.json` (scripts `scan`, `check`)
- Create: `packages/i18n/catalog.en.json` (array de cadenas en inglés)
- Create: `packages/i18n/locales/es.json`, `ca.json`, `it.json`, `fr.json`, `de.json`, `pt.json`,
  `gl.json`, `eu.json`
- Create: `packages/i18n/src/scan.ts` (extrae `t(...)` de `apps/admin/src` y actualiza el catálogo)
- Create: `packages/i18n/src/check.ts` (valida claves, placeholders, JSON, stale)
- Create: `packages/i18n/src/t.ts` (runtime: `t(text, map) => string`)
- Create: `packages/i18n/src/scan.test.ts`, `check.test.ts`
- Create: `supabase/migrations/0006_translations.sql`
- Create: `packages/core/src/i18n/seed.ts` (upsert idempotente con prioridad)
- Create: `packages/core/src/i18n/seed.test.ts` (db-tests)
- Create: `packages/core/src/i18n/etag.ts` (sha256 del cuerpo servido)
- Create: `packages/core/src/i18n/etag.test.ts`
- Create: `apps/admin/src/app/api/v1/translations/route.ts` (GET ?locale → mapa + ETag)
- Create: `packages/db-tests/src/api/translations.test.ts` (ETag, siembra, colisión módulo↔Core)
- Modify: `apps/admin/src/lib/i18n.ts` (loader server-side de traducciones)
- Modify: `package.json` (scripts `i18n:scan` / `i18n:check` a nivel raíz)
- Modify: `.github/workflows/ci.yml` (job `admin`: añadir `pnpm i18n:check`)
- Create: `docs/flows/i18n.md` (ya existe de sprint-05-core-design task-09; verificar y actualizar si
  el runtime cambió)

**Interfaces produced:**

```ts
// supabase/migrations/0006_translations.sql
CREATE TABLE public.translations (
  locale text NOT NULL CHECK (locale IN ('en','es','ca','it','fr','de','pt','gl','eu')),
  text_hash text NOT NULL,           -- sha256(text_en) hex
  text_en text NOT NULL,
  translated_text text NOT NULL CHECK (length(translated_text) <= 2000),
  source text NOT NULL DEFAULT 'code' CHECK (source IN ('code','module','import','manual')),
  updated_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (locale, text_hash)
);
```

```ts
// packages/core/src/i18n/seed.ts
export interface TranslationSeed {
  locale: string; textEn: string; translated: string; source: 'code' | 'module';
}
export async function seedTranslations(deps, seeds: TranslationSeed[]): Promise<void>
// Upsert con prioridad manual > import > code > module:
//   INSERT … ON CONFLICT (locale, text_hash) DO UPDATE SET
//     translated_text = EXCLUDED.translated_text,
//     source = EXCLUDED.source
//   WHERE translations.source IN ('code', 'module')
//   -- para seed source='module': solo sobrescribe filas con source='module' (no pisa Core).
// Las cadenas 'manual' e 'import' nunca se sobrescriben por siembra.
```

```ts
// packages/core/src/i18n/etag.ts
export function computeEtag(body: unknown): string  // sha256 del JSON serializado, formato '"<hex>"'
```

**Steps:**

1. Crea el paquete `packages/i18n` con `catalog.en.json` inicial (las cadenas usadas por login y
   setup, extraídas con `scan`) y los 8 locales traducidos (los 9 del set: `en es ca it fr de pt
   gl eu` — el executor traduce; el check de CI valida que las 9 tengan las mismas claves).
2. Escribe `scan.test.ts` (rojo): extrae `t("Email")` → añade al catálogo; no duplica; no elimina
   cadenas aún presentes en el código.
3. Implementa `scan.ts` (verde) con un AST parser ligero (regex sobre `t\("([^"]+)"` — suficiente
   para v1; el AST completo es sprint-06-web).
4. Escribe `check.test.ts` (rojo) — tabla de casos:
   - Clave faltante en un locale → fallo con lista de claves faltantes.
   - Clave sobrante en un locale → fallo.
   - Placeholder `{x}` presente en inglés pero no en la traducción → fallo.
   - JSON inválido → fallo.
   - Catálogo stale respecto al código → fallo (hay que correr `i18n:scan`).
   - 9 locales correctos → pasa.
5. Implementa `check.ts` (verde).
6. Escribe la migración `0006_translations.sql`.
7. Escribe `seed.test.ts` (rojo) en `db-tests`:
   - Siembra idempotente: correr dos veces el mismo seed no duplica filas ni cambia el resultado.
   - Colisión módulo↔Core: sembrar una cadena con `source='module'` cuyo `text_en` coincide con
     una existente con `source='code'` → **no sobrescribe** la del Core (aviso logueado).
   - Una traducción editada por el admin (`source='manual'`) **sobrevive** a una re-siembra.
   - Retirada de cadenas `code`: al des-instalar/se retirar, las filas de source='module' se borran,
     las 'manual' se conservan (task-03).
8. Implementa `seed.ts` (verde).
9. Escribe `etag.test.ts` (rojo): dos requests con el mismo cuerpo → mismo ETag; cambiar una
   traducción cambia el ETag.
10. Implementa `etag.ts` (verde).
11. Crea `GET /api/v1/translations?locale=`: door autenticada (cualquier sesión); devuelve
    `{ text_en → traducción }` resuelto con fallback (lo que falta cae a inglés) + cabecera `ETag`.
    Si el request trae `If-None-Match` igual → 304 sin cuerpo. Solo locales **habilitados** en
    settings; `en` siempre.
12. Escribe `translations.test.ts` (rojo) en `db-tests`:
    - ETag estable en 2 requests sucesivos sin cambios.
    - ETag cambia tras editar una traducción.
    - Solo locales habilitados; `en` siempre disponible.
    - Un locale deshabilitado → `locale_not_available`.
13. Implementa la ruta (verde).
14. `apps/admin/src/lib/i18n.ts`: loader server-side (lee traducciones de la BD para el locale del
    perfil o `default_locale`, devuelve un Map para `t()`).
15. Scripts raíz `pnpm i18n:scan` / `pnpm i18n:check` y añadir `i18n:check` al job `admin`.
16. Actualiza `docs/tasks/sprint-08-core-base/task-05.md` con evidencia y `adrs: [0004, 0007, 0008]`.

**Acceptance criteria:**
- `i18n:check` falla en los 5 casos de fallo y pasa con los 9 locales correctos.
- `i18n:scan` actualiza el catálogo sin romper traducciones existentes.
- `seedTranslations` es idempotente y respeta la prioridad manual > import > code > module.
- `GET /translations?locale` devuelve el mapa + ETag; 304 con `If-None-Match`.
- Colisión módulo↔Core no sobrescribe la cadena del Core.

---

## Task 6: Observabilidad (sprint-08-core-base task-06)

**Files:**
- Create: `packages/core/src/logger.ts` (JSON una línea, redacción)
- Create: `packages/core/src/logger.test.ts`
- Create: `packages/core/src/sentry.ts` (init + beforeSend scrub fail-closed)
- Create: `packages/core/src/sentry.test.ts`
- Create: `packages/core/src/observability/scrub.ts` (helper de redacción de eventos)
- Create: `packages/core/src/observability/scrub.test.ts`
- Modify: `packages/core/src/api/door.ts` (logger JSON en cada request: level, route, status,
  duration_ms, actor, request_id, code)
- Create: `apps/admin/instrumentation.ts` (hook de Next.js para Sentry)
- Create: `apps/admin/sentry.client.config.ts` + `sentry.server.config.ts`
- Modify: `apps/admin/package.json` (dependencia @sentry/nextjs)
- Create: `docs/guia-debugging.md`
- Modify: `docs/tasks/sprint-08-core-base/task-06.md`

**Interfaces produced:**

```ts
// packages/core/src/logger.ts
export interface LogEntry {
  ts: string;               // ISO 8601
  level: 'info' | 'warn' | 'error';
  msg: string;
  request_id?: string;
  route?: string;
  status?: number;
  duration_ms?: number;
  actor?: string;           // userId o kind de caller (sin email, sin IP)
  code?: string;
}
export function serializeLog(entry: LogEntry): string
// Una línea JSON con keys ordenadas, sin saltos de línea (los strings se escapan),
// sin PII (email, IP, tokens, body). Nunca se loguea el body ni el valor de settings.
```

```ts
// packages/core/src/observability/scrub.ts
export function scrubEvent(event: SentryEvent): SentryEvent | null
// - Quita event.request.*, user.ip, user.email, breadcrumbs, extra crudo, etc.
// - Si el scrub falla → null (fail-closed: mejor no enviar el evento que filtrar datos).
// - Solo 5xx se envían; 4xx no.
// - /health 503 → no se envía (es un estado operativo, no un error).
```

```ts
// packages/core/src/sentry.ts
export function initSentry(options: { dsn: string | null; environment: string }): void
// Solo se inicializa si dsn existe. sendDefaultPii: false. beforeSend: scrubEvent.
```

**Steps:**

1. `pnpm --filter admin add @sentry/nextjs` y `pnpm --filter @027apps/core add @sentry/nextjs`
   (o solo en el core, según lo que las instrucciones del SDK de Sentry Next.js indiquen).
2. Escribe `logger.test.ts` (rojo):
   - `serializeLog` produce una sola línea JSON con keys ordenadas.
   - Un `msg` con salto de línea se escapa (no rompe el formato).
   - Un `msg` con un token/email/IP no aparecen (la redacción se aplica en el pipeline: el logger
     solo recibe campos ya limpios; el test verifica que los campos prohibidos no se serializan).
   - `duration_ms` y `status` se serializan como números.
3. Implementa `logger.ts` (verde).
4. Modifica `door.ts`: loguea por request con `level: 'info'` (2xx) o `'error'` (5xx) —
   `{ ts, level, msg, request_id, route, status, duration_ms, actor: caller.kind + userId, code }`.
5. Escribe `scrub.test.ts` (rojo):
   - Un evento con `request.headers` y `user.ip` → sale sin esos campos.
   - Un evento con `breadcrumbs` → se quitan.
   - Un evento 4xx → no se envía (return null).
   - Un evento de `/health` 503 → no se envía.
   - Si el scrub lanza → se devuelve null (fail-closed).
6. Implementa `scrub.ts` (verde).
7. Escribe `sentry.test.ts` (rojo): `initSentry` sin DSN no hace nada; con DSN inicializa con
   `sendDefaultPii: false` y `beforeSend = scrubEvent`.
8. Implementa `sentry.ts` (verde).
9. Crea `apps/admin/instrumentation.ts` (hook que llama `initSentry`) y los configs
   `sentry.client.config.ts` / `sentry.server.config.ts` según el SDK de Sentry Next.js
   (ver `node_modules/@sentry/nextjs` docs — la tarea de Next.js 16 exige leer docs locales).
10. `SENTRY_DSN` se lee de env (opcional); sin DSN no se inicializa.
11. Escribe `docs/guia-debugging.md` (cómo ver logs, correlación por request_id, cómo abrir Sentry,
    estado operativo /health, troubleshooting común).
12. Actualiza `docs/tasks/sprint-08-core-base/task-06.md` con evidencia y `adrs: [0007]`.

**Acceptance criteria:**
- Los logs son JSON de una línea, sin PII ni secretos.
- El pipeline de `withDoor` loguea cada request con `request_id`, `route`, `status`, `duration_ms`.
- Sentry solo recibe 5xx; `sendDefaultPii: false`; `beforeSend` scrub fail-closed.
- `X-Request-Id` en todas las respuestas (ya cubierto en task 2, verificado aquí).
- `docs/guia-debugging.md` documenta el flujo de depuración.

---

## Task 7: Wizard de instalación completo (pasos 3–5) (sprint-08-core-base task-07)

Añadida al sprint tras la validación del usuario: la task-02 solo entregó los pasos 1–2 y la spec
`2026-10-26-instance-config.md` §7 exige los cinco. Cierra la instalación de verdad
(`setup_incomplete = false`), que hoy es imposible desde la UI.

- Create: `packages/core/src/setup/environment.ts` (`checkEnvironment`), `packages/core/src/setup/api.ts`
  (`setupEnvironmentRoute`, `setupTestEmailRoute`), tests.
- Modify: `packages/core/src/instance/api.ts` (exportar `isSetupIncomplete`).
- Modify: `packages/core/src/auth/setup.ts` (`recordJwtExpiry` + `jwtExpirySeconds`).
- Create: `apps/admin/src/app/api/v1/setup/environment/route.ts`, `.../setup/test-email/route.ts`.
- Modify: `apps/admin/src/proxy.ts` + `src/lib/instance-gate.ts` (el wizard se cierra por
  `setup_incomplete`, no por `requires_setup`).
- Modify: `apps/admin/src/app/setup/*` (wizard por estado: entorno+admin → SMTP → preferencias → FCM).
- Modify: `apps/admin/src/app/page.tsx` (banner de configuración incompleta, spec §7.3).

Pasos TDD: 1) tests rojos de `checkEnvironment`/`isSetupIncomplete`/gate; 2) implementación;
3) verde; 4) puerta completa + `pnpm --filter admin build`; 5) QA + auditoría.

## Orden de ejecución

| # | Task | Sprint-05 task | Dependencias |
|---|---|---|---|
| 1 | Migraciones base + RLS + suite | task-01 | — |
| 2 | Esqueleto API v1 | task-03 | task-01 |
| 3 | Auth, sesión SSR, guard, /setup | task-02 | task-01 + task-03 |
| 4 | Salud, instancia, settings, currencies | task-04 | task-01 + task-03 |
| 5 | i18n operativa | task-05 | task-01 + task-04 |
| 6 | Observabilidad | task-06 | task-03 + task-05 |

El esqueleto API (task-03) se implementa **antes** que auth (task-02) porque la puerta necesita
`withDoor` + `DomainError` para poder enchufar el resolver real. El orden de task files se mantiene;
solo cambia el orden de implementación.

## Cierre del sprint

1. `pnpm lint && pnpm tsc && pnpm test` en verde en el repo completo.
2. `pnpm --filter admin build` en verde.
3. CI verde (checks `admin`, `android`, `guard-secrets`, `commitlint`, `supabase`).
4. PR #26 actualizado (rama `sprint/08-core-base`); squash merge solo con orden explícita del usuario.
5. **Auditoría OWASP** por un agente distinto del autor (checklist `security-checklist.md`).
6. QA con ojos nuevos (DoD Código punto 6).
7. Aceptación del usuario en preview Vercel (infra-06: `027apps-dev` desplegado).
8. `docs/tasks/sprint-08-core-base/task-NN.md` con `estado: finalizada` y evidencia.
