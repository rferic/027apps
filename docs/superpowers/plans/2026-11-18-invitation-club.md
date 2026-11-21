# Invitaciones de club: niveles, cuota y QR — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que cada miembro pueda invitar a un número limitado de personas según su nivel, con QR
rotativo, enlace compartible, cuota viva y solicitud de ampliación al administrador.

**Architecture:** se extiende el flujo de invitaciones existente (`public.invitations`, canje
público, panel) en lugar de crear un dominio paralelo. La cuota se calcula en vivo desde tres
hechos —perfiles traídos, invitaciones pendientes y concesiones— y se comprueba bajo un advisory
lock por invitador. El QR es un código bearer corto que acuña una invitación normal; el enlace es
esa misma invitación con TTL largo. Los avisos usan el outbox y el push que ya existen.

**Tech Stack:** TypeScript (Next.js 16 admin + `packages/core`), Postgres/Supabase (migraciones
SQL, RLS, `pg`), Vitest (`packages/core`, `packages/db-tests`, `apps/admin`), Android Kotlin +
Compose (app), Zod, OpenAPI generado.

**Spec:** [`docs/superpowers/specs/2026-11-18-invitation-club-design.md`](../specs/2026-11-18-invitation-club-design.md)

## Global Constraints

- Niveles por defecto: `[{level:1,quota:5},{level:2,quota:2},{level:3,quota:1}]`, máximo 20
  niveles, `quota` 0..100, contiguos desde 1. El array vacío cierra las invitaciones de miembro.
- El nivel se escribe **solo al crear el perfil**; una cuenta existente conserva el suyo.
- Administradores y superadministradores: `unlimited = true`, sin nivel y sin cuota.
- La cuota cuenta perfiles con `role = 'user'` e `invited_by = uid` (desactivados incluidos),
  invitaciones pendientes vigentes (`used_at` y `revoked_at` NULL, `expires_at` futuro) y
  concesiones activas. La purga libera; la desactivación no.
- Toda creación de invitación o intercambio de QR comprueba la cuota y escribe en la **misma
  transacción** con `pg_advisory_xact_lock(hashtext('invite:' || uid))`.
- Invitación de miembro: rol `user`, `source = 'member'`, TTL 48 h. QR: código 90 s,
  `source = 'qr'`, invitación de 15 min. Nunca se guarda el token en claro.
- El QR se canjea con `POST` desde un botón; el `GET` de `/join/[code]` no muta.
- Endpoints de miembro: sesión y propiedad; los de administrador: `invitations:read|write` y
  `users:write`. Zod en todos los bordes; el servidor deriva rol, nivel, categorías y módulos.
- Textos en inglés como clave en `packages/i18n/catalog.en.json`; 9 idiomas en la app. Colores
  solo por tokens. Nada de `any` injustificado ni `console.log`.
- Commits en Conventional Commits, en inglés; rama `sprint/18-invitation-club`; un PR draft contra
  `staging` desde el primer commit; sin merge sin orden explícita.
- **Ninguna UI (Tasks 6–9) empieza hasta que el propietario apruebe los mockups de la Task 0.** Si
  el mockup cambia un flujo, se actualiza la spec antes de implementarlo.
- Cierre: `pnpm lint && pnpm tsc && pnpm test`, `pnpm --filter admin build`,
  `pnpm --filter db-tests test`, `pnpm check:openapi`, `cd apps/android &&
  ./gradlew :app:testDebugUnitTest`, y auditoría de seguridad por un agente distinto del autor.

## Review Focus

Estos son los cinco fallos que más probablemente aparecerán aunque el camino feliz pase. Cada uno
tiene su test en la tarea que lo posee.

1. **Dos invitaciones con una sola plaza** creadas en paralelo: una debe ganar y la otra recibir
   `invitation_quota_exhausted` (Task 3).
2. **Dos administradores aprueban la misma solicitud** a la vez: una sola concesión (Task 5).
3. **Un invitador desactivado con un enlace vivo**: el canje no debe crear la cuenta (Task 4).
4. **Un QR reabierto o pulsado dos veces**: el segundo canje es `join_code_used`, no una segunda
   invitación ni un token reproducido (Task 3).
5. **Purga de un invitador con invitados dentro**: los invitados quedan huérfanos y dejan de contar
   contra nadie, sin contadores desviados (Task 2).

## Mapa de archivos

| Área | Archivos |
|---|---|
| SQL | `supabase/migrations/0037_invitation_club.sql` (nuevo) |
| Core | `packages/core/src/invitations/{quota,member,join-codes,requests,shared}.ts` (nuevos); `service.ts` y `api.ts` (modificados); `packages/core/src/users/{api,service}.ts` (nivel); `packages/core/src/settings/catalog.ts`; `packages/core/src/realtime/service.ts` (campos de push); `packages/core/src/openapi/{registry,schemas}.ts` |
| Rutas | `apps/admin/src/app/api/v1/me/invitations/**`, `me/join-codes/**`, `me/invitation-requests/**`, `join-codes/**`, `invitation-requests/**`, `users/[id]/invitation-grants/**` (nuevas); `invitations/**` y `users/[id]/route.ts` (modificadas); página pública `apps/admin/src/app/join/[code]/**` |
| Panel | `apps/admin/src/app/(panel)/panel/requests/page.tsx` (nueva); `components/{invitation-levels-editor,member-invitation-panel,pending-requests-badge,invitation-request-actions}.tsx` (nuevos); `panel/{invitations,members/[id],page}.tsx`, `components/{settings-form,invitation-actions}.tsx`, `lib/{settings-form,invitation-mutations}.ts` (modificados) |
| App | `ui/screens/InviteMembersScreen.kt` (nuevo); `ui/{AppRoot,AppViewModel,AppState}.kt`, `data/{Dtos,ApiClient}.kt`, `PushText.kt`, `PushMessagingService.kt`, `ui/i18n/{Strings,LocalStrings}.kt`, `Changelog.kt`, `app/build.gradle.kts`, `AndroidManifest.xml` (modificados) |
| Docs | `docs/flows/invitations.md`, `docs/superpowers/specs/2026-10-26-realtime-notificaciones.md`, `docs/ai/landing.md` |
| Mockups | `docs/mockups/invitation-club/{index.html,README.md}` (Task 0) |

---

### Task 0: Mockups de todas las pantallas (puerta P2)

**Files:**
- Create: `docs/mockups/invitation-club/index.html`
- Create: `docs/mockups/invitation-club/README.md`
- Create: `docs/mockups/invitation-club/preview-*.png` (capturas de las superficies principales)

**Interfaces:**
- Consumes: la spec aprobada (flujos, estados y copy de §6–§8).
- Produces: la puerta **P2**: ninguna tarea de UI (6, 7, 8, 9) empieza hasta que el propietario
  apruebe este mockup. Si el mockup cambia un flujo, la spec se actualiza primero.

- [ ] **Step 1: Inventaría las pantallas y sus estados**

El mockup cubre, como mínimo:

| Área | Pantalla | Estados |
|---|---|---|
| App | Invitaciones | con plazas, 0 plazas, cargando, error de red |
| App | QR | cuenta atrás 90 s, renovación, caducado |
| App | Crear enlace | generado, copiado, caducado |
| App | Solicitud | formulario, pendiente, aprobada, rechazada, cancelada |
| App | Revocar invitación | confirmación |
| App | Solicitudes (admin) | lista de solo lectura, vacío |
| Web | `/join/[code]` | pendiente, caducado, usado, club lleno |
| Web | `/invite/[token]` | anónima, cuenta existente, usada, caducada |
| Panel | Ajustes → Invitaciones | 3 niveles, añadir/quitar, lista vacía (solo admins) |
| Panel | Solicitudes | pendientes primero, aprobar con cantidad, rechazar con motivo, vacío |
| Panel | Miembros → ficha | nivel, base + concedidas, usadas/reservadas, concesiones, sin nivel |
| Panel | Miembros → árbol | subárbol, huérfanos por purga |
| Panel | Invitaciones | admin/member/qr, anónima, acciones por origen |
| Panel | Módulos → ficha | `delegable` encendido/apagado |

- [ ] **Step 2: Construye el HTML**

`index.html` autocontenido (sin CDN), con los tokens de `apps/admin/tokens.json` en claro y oscuro,
marcos de móvil (390 px), web pública y panel (1100 px), navegación por anclas y un botón de tema.
Copy en español; nombres y datos de ejemplo (Ana, Luis, «Familia»). Nada de hex libres fuera de los
tokens. El QR es un patrón de maqueta, no un QR real.

- [ ] **Step 3: Documenta el mockup**

`README.md` con la tabla de pantallas/estados, las decisiones de copy y jerarquía, el contraste AA,
lo que queda fuera y la puerta P2.

- [ ] **Step 4: Capturas**

Genera `preview-*.png` de las superficies principales con el navegador (Playwright, `orca browser`
o captura manual) para revisión rápida. No se commitea ningún dato real.

- [ ] **Step 5: Revisión del propietario (P2)**

Abre `docs/mockups/invitation-club/index.html` y recorre las pantallas. Si pide cambios, se aplican
al mockup y, si cambian un flujo, a la spec. **Sin aprobación escrita no empieza la UI.**

- [ ] **Step 6: Commit**

```bash
git add docs/mockups/invitation-club
git commit -m "docs(invitations): mockups for the club invitation screens"
```

---

### Task 1: Migración, ajustes y modelo base

**Files:**
- Create: `supabase/migrations/0037_invitation_club.sql`
- Modify: `packages/core/src/settings/catalog.ts` (categoría `invitations`, clave `invitations.levels`, default y schema)
- Modify: `packages/db-tests/src/settings/catalog.test.ts` y `packages/core/src/settings/catalog.test.ts` (conteos 5→6 categorías, 18→19 claves)
- Test: `packages/db-tests/src/rls/invitation-club.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: columnas `profiles.invited_by`, `profiles.invite_level`; `invitations.depth/source/redeemed_by` y `email`/`name`/`expires_in_days` nullable; tablas `invitation_categories`, `join_codes`, `invitation_requests`, `invitation_quota_grants`; `module_registry.delegable`; ajuste `invitations.levels`.

- [ ] **Step 1: Escribe la migración**

Crea `supabase/migrations/0037_invitation_club.sql` con exactamente este contenido (los comentarios
explican la decisión; no cambies los nombres):

```sql
-- 0037 — club invitations: levels, live quota, QR codes and grants.
-- Additive: the admin invitation flow keeps working with email/name.

alter table public.profiles
  add column invited_by uuid references public.profiles (id) on delete set null,
  add column invite_level integer check (invite_level between 1 and 100);

update public.profiles
   set invite_level = 1
 where role = 'user' and invite_level is null;

alter table public.invitations
  alter column email drop not null,
  alter column name drop not null,
  alter column expires_in_days drop not null,
  add column depth integer check (depth between 1 and 100),
  add column source text not null default 'admin'
    check (source in ('admin', 'member', 'qr')),
  add column redeemed_by uuid references public.profiles (id) on delete set null;

update public.invitations set depth = 1, source = 'admin' where depth is null;

alter table public.module_registry
  add column delegable boolean not null default false;

create table public.invitation_categories (
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  user_category_id uuid not null references public.user_categories (id) on delete cascade,
  primary key (invitation_id, user_category_id)
);

create table public.join_codes (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references public.profiles (id) on delete cascade,
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  used_at timestamptz,
  invitation_id uuid references public.invitations (id) on delete set null,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create table public.invitation_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null check (amount between 1 and 20),
  reason text check (reason is null or length(btrim(reason)) between 1 and 280),
  state text not null default 'pending'
    check (state in ('pending', 'approved', 'rejected', 'cancelled')),
  granted_amount integer check (granted_amount between 1 and 100),
  resolution_reason text
    check (resolution_reason is null or length(btrim(resolution_reason)) between 1 and 280),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check ((state = 'pending') = (resolved_at is null))
);

create unique index invitation_requests_one_pending
  on public.invitation_requests (requester_id) where state = 'pending';

create table public.invitation_quota_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null check (amount between 1 and 100),
  granted_by uuid references public.profiles (id) on delete set null,
  granted_by_key uuid,
  request_id uuid references public.invitation_requests (id) on delete set null,
  reason text,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (num_nonnulls(granted_by, granted_by_key) <= 1)
);

create index profiles_invited_by_idx on public.profiles (invited_by)
  where invited_by is not null;

create index invitations_inviter_pending_idx
  on public.invitations (created_by, expires_at)
  where used_at is null and revoked_at is null;

create index join_codes_inviter_recent_idx
  on public.join_codes (inviter_id, created_at desc);

alter table public.invitation_categories enable row level security;
alter table public.join_codes enable row level security;
alter table public.invitation_requests enable row level security;
alter table public.invitation_quota_grants enable row level security;

-- Server-only tables: no grants to anon/authenticated, same as device_transfers.
revoke all on public.invitation_categories from anon, authenticated;
revoke all on public.join_codes from anon, authenticated;
revoke all on public.invitation_requests from anon, authenticated;
revoke all on public.invitation_quota_grants from anon, authenticated;

insert into public.settings_categories (category_key, label, help, icon, sort_order)
values ('invitations', 'Invitations',
        'Who can join and how many people each member may bring.', 'users', 60)
on conflict (category_key) do nothing;

insert into public.settings
  (category_key, key, label, help, value, is_secret, is_public, mcp_access, sort_order)
values
  ('invitations', 'invitations.levels', 'Invitation levels',
   'JSON array of {level, quota}; level 1 is an admin invitee.',
   '[{"level":1,"quota":5},{"level":2,"quota":2},{"level":3,"quota":1}]'::jsonb,
   false, false, 'none', 10)
on conflict (category_key, key) do nothing;
```

- [ ] **Step 2: Registra el ajuste en el catálogo**

En `packages/core/src/settings/catalog.ts`:

```ts
const invitationLevelsSchema = z
  .array(
    z.object({
      level: z.number().int().min(1).max(20),
      quota: z.number().int().min(0).max(100),
    }).strict(),
  )
  .max(20)
  .refine(
    (rows) => rows.every((row, index) => row.level === index + 1),
    'levels must be contiguous from 1',
  );
```

Añade la categoría `{ categoryKey: 'invitations', label: 'Invitations', help: 'Who can join and how many people each member may bring.', icon: 'users', sortOrder: 60 }`, la entrada de catálogo con `key: 'invitations.levels'`, `category: 'invitations'`, `type: 'json'`, `isSecret: false`, `isPublic: false`, `mcpAccess: 'none'`, `sortOrder: 10`, `superAdminOnly: false`, `readOnly: false`, `schema: invitationLevelsSchema`, y el default en `CATALOG_DEFAULTS`:

```ts
'invitations.levels': [
  { level: 1, quota: 5 },
  { level: 2, quota: 2 },
  { level: 3, quota: 1 },
],
```

- [ ] **Step 3: Actualiza la vista de invitaciones**

En `packages/core/src/invitations/service.ts`, `InvitationView` gana `source`, `depth`,
`anonymous`, `created_by` (id + nombre) y `redeemed_by` (id + nombre), y `expires_in_days` pasa a
`number | null`. Actualiza `toView`, `listInvitations` y `getInvitation` con esos campos y el join a
`profiles` para los nombres. Los tests existentes de la vista se ajustan a los campos nuevos, sin
cambiar su intención.

- [ ] **Step 4: Escribe los tests de esquema y RLS**

Crea `packages/db-tests/src/rls/invitation-club.test.ts` con estos casos (usa el patrón de
`src/rls/invitations.test.ts`: `pg` local, transacciones con `ROLLBACK`):

```ts
describe("invitation club schema", () => {
  it("backfills existing users to level 1 and leaves admins without a level", ...);
  it("accepts an anonymous invitation with null email and name", ...);
  it("keeps join codes, requests and grants away from anon and authenticated", ...);
  it("allows one pending request per user and a second after it is resolved", ...);
  it("defaults module_registry.delegable to false", ...);
});
```

El caso de visibilidad debe intentar `select`, `insert`, `update` y `delete` como `anon` y
`authenticated` y esperar error de permiso (no 0 filas).

- [ ] **Step 5: Ejecuta los tests y verifica el rojo/verde**

Run: `supabase start && pnpm --filter db-tests test -- src/rls/invitation-club.test.ts`
Expected: FAIL primero si la migración no está aplicada; después de `supabase db reset` (solo el
stack local; borra los datos de desarrollo), PASS.

Run: `pnpm --filter db-tests test -- src/settings/catalog.test.ts`
Expected: FAIL por los conteos viejos; actualiza 5→6 categorías y 18→19 claves y vuelve a PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0037_invitation_club.sql packages/core/src/settings/catalog.ts packages/db-tests/src/rls/invitation-club.test.ts packages/db-tests/src/settings/catalog.test.ts
git commit -m "feat(invitations): add club levels, quota and QR model"
```

---

### Task 2: Cuota viva y nivel del miembro

**Files:**
- Create: `packages/core/src/invitations/quota.ts`
- Create: `packages/core/src/invitations/quota.test.ts`
- Modify: `packages/core/src/users/api.ts` (zod de `invitation_level`)
- Modify: `packages/core/src/users/service.ts` (`UserPatch`, `UserView`, validación)
- Test: `packages/core/src/users/service.test.ts`, `packages/db-tests/src/invitations/quota.test.ts`

**Interfaces:**
- Consumes: Task 1 (columnas, tablas, ajuste).
- Produces:
  ```ts
  export type InvitationLevel = { level: number; quota: number };
  export type InvitationQuota = {
    level: number | null;
    base: number;
    granted: number;
    used: number;
    reserved: number;
    remaining: number;
    unlimited: boolean;
  };
  export function parseInvitationLevels(value: unknown): InvitationLevel[];
  export function baseQuotaFor(levels: InvitationLevel[], level: number | null): number;
  export async function invitationQuota(db: QueryClient, userId: string): Promise<InvitationQuota>;
  ```
- `users.service` acepta `invitation_level: number | null` en `UserPatch` y lo devuelve en `UserView`; `GET /users` acepta `invited_by`.

- [ ] **Step 1: Escribe el test de la cuota**

En `packages/core/src/invitations/quota.test.ts` (unitario, con un `QueryClient` falso que devuelve
las filas del caso):

```ts
it("parses contiguous levels and ignores an invalid setting", ...);
it("returns 0 for a level missing from the list", ...);
it("adds active grants and keeps revoked ones out", ...);
it("counts only role=user profiles and pending valid invitations", ...);
it("returns unlimited for an admin", ...);
```

En `packages/db-tests/src/invitations/quota.test.ts` (integración):

```ts
it("a deactivated invitee still occupies and a purged one frees the seat", ...);
it("expired and revoked invitations release the reservation", ...);
it("a redemption over an existing account releases the reservation without counting a profile", ...);
it("two concurrent creations with one seat produce exactly one invitation", ...);
```

- [ ] **Step 2: Ejecuta el test y verifica el rojo**

Run: `pnpm --filter @027apps/core test -- src/invitations/quota.test.ts`
Expected: FAIL `invitationQuota is not a function`.

- [ ] **Step 3: Implementa `quota.ts`**

`parseInvitationLevels` acepta el valor de `settings` (array o string JSON) y devuelve `[]` si no
valida. `invitationQuota` lee `profiles.invite_level` y `role`, el ajuste, y ejecuta una sola
consulta con subselects para `granted`, `used` y `reserved`; `unlimited` es `role in
('admin','super_admin')`. No lances errores de dominio desde esta lectura.

- [ ] **Step 4: Añade `invitation_level` a la API de usuarios**

En `users/api.ts`, el schema de `PATCH /users/{id}` acepta `invitation_level:
z.number().int().min(1).max(20).nullable().optional()`. En `users/service.ts`, un `user` no puede
quedar con `null` (400 `validation_failed`); un `admin`/`super_admin` debe quedar con `null`.
Actualiza `UserView` y el test existente de `PATCH`.

- [ ] **Step 5: Añade el filtro `invited_by` a la lista de usuarios**

En `packages/core/src/users/api.ts`, el schema de filtros de `GET /users` acepta `invited_by: uuid`
opcional; en `users/service.ts`, `UserListFilters` lo aplica (`where invited_by = $n`) y el test
lista solo los invitados directos de un miembro. Es lo que el panel usa para el árbol.

- [ ] **Step 6: Revoca pendientes al desactivar o purgar**

En `users/service.ts`, dentro de la transacción de `deactivateUser` y de `purgeUser`, revoca las
invitaciones pendientes (`revoked_at = now()`) y los códigos vigentes del afectado. No toca a sus
invitados ni a sus concesiones. Test: un enlace vivo de un usuario desactivado deja de canjearse.

- [ ] **Step 7: Ejecuta los tests y verifica el verde**

Run: `pnpm --filter @027apps/core test -- src/invitations/quota.test.ts src/users/service.test.ts`
Expected: PASS.
Run: `pnpm --filter db-tests test -- src/invitations/quota.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/invitations/quota.ts packages/core/src/invitations/quota.test.ts packages/core/src/users packages/db-tests/src/invitations/quota.test.ts
git commit -m "feat(invitations): compute live quota from level, invitees and grants"
```

---

### Task 3: Invitación de miembro, QR e intercambio

**Files:**
- Create: `packages/core/src/invitations/shared.ts` (token/hash/transacción compartidos)
- Create: `packages/core/src/invitations/member.ts`
- Create: `packages/core/src/invitations/join-codes.ts`
- Create: `packages/core/src/invitations/member.test.ts`, `join-codes.test.ts`
- Modify: `packages/core/src/invitations/service.ts` (usa `shared.ts` en vez de duplicar)
- Modify: `packages/core/src/invitations/api.ts` (handlers nuevos)
- Create: `apps/admin/src/app/api/v1/me/invitations/route.ts`, `apps/admin/src/app/api/v1/me/invitations/[id]/route.ts`, `apps/admin/src/app/api/v1/me/join-codes/route.ts`, `apps/admin/src/app/api/v1/join-codes/[code]/preview/route.ts`, `apps/admin/src/app/api/v1/join-codes/[code]/exchange/route.ts`
- Create: `apps/admin/src/app/join/[code]/page.tsx`, `apps/admin/src/app/join/[code]/join-continue.tsx`, `apps/admin/src/app/join/[code]/page.test.tsx`
- Modify: `apps/admin/src/lib/public-paths.ts`
- Test: `packages/db-tests/src/api/invitation-club.test.ts`

**Interfaces:**
- Consumes: `invitationQuota`, `parseInvitationLevels` (Task 2); `newInviteToken`, `hashInviteToken`, `withInviteTx` (shared).
- Produces:
  ```ts
  export type InheritedPackage = { categories: string[]; modules: string[] };
  export async function inheritPackage(db: QueryClient, inviterId: string): Promise<InheritedPackage>;
  export async function createMemberInvitation(deps, caller): Promise<{ invitation: InvitationView; token: string; path: string }>;
  export async function revokeOwnInvitation(deps, caller, id: string): Promise<void>;
  export async function createJoinCode(deps, caller): Promise<{ id: string; code: string; expires_at: string; path: string }>;
  export async function previewJoinCode(deps, code: string): Promise<{ state: 'pending'|'expired'|'used'; inviter_name: string|null; instance_name: string }>;
  export async function exchangeJoinCode(deps, code: string): Promise<{ token: string; path: string }>;
  ```

- [ ] **Step 1: Escribe los tests de miembro y QR**

En `member.test.ts`:

```ts
it("creates an anonymous 48h invitation with role user and depth level+1", ...);
it("inherits public modules, delegable private modules and every category", ...);
it("refuses when the inviter has no seats left", ...);
it("revokes only the caller's own pending invitation", ...);
```

En `join-codes.test.ts`:

```ts
it("mints a 90s one-use code that exchanges for a 15min invitation", ...);
it("a second exchange is join_code_used and never replays the token", ...);
it("an expired or unknown code is not_found", ...);
it("an inactive inviter cannot mint or exchange", ...);
```

En `packages/db-tests/src/api/invitation-club.test.ts`, el caso de carrera:

```ts
it("two concurrent member invitations with one seat produce one 201 and one 409", ...);
```

- [ ] **Step 2: Ejecuta y verifica el rojo**

Run: `pnpm --filter @027apps/core test -- src/invitations/member.test.ts src/invitations/join-codes.test.ts`
Expected: FAIL (módulos no existen).

- [ ] **Step 3: Implementa `shared.ts`, `member.ts` y `join-codes.ts`**

- `shared.ts`: `newInviteToken(prefix)`, `hashInviteToken(token)`, `withInviteTx(deps, fn)`; mueve
  ahí la implementación privada de `service.ts` y úsala desde los dos sitios.
- `member.ts`: dentro de `withInviteTx`, `select pg_advisory_xact_lock(hashtext('invite:'||uid))`,
  `invitationQuota`, y si `remaining <= 0` lanza `DomainError('invitation_quota_exhausted')`. Inserta
  la invitación anónima (`email`/`name` NULL, `source='member'`, `depth = invite_level + 1`,
  `role='user'`, `expires_at = now + 48h`, `created_by = uid`) y copia el paquete heredado en
  `invitation_modules`/`invitation_categories`.
- `join-codes.ts`: token `027_join_` + 32 bytes base64url, hash SHA-256, TTL 90 s, limpieza de
  códigos viejos del invitador. El exchange bloquea la fila (`for update`), valida TTL y que el
  invitador siga activo, comprueba la cuota, crea la invitación (`source='qr'`, TTL 15 min), marca
  `used_at`/`invitation_id` y devuelve el token una vez. Si `used_at` no es NULL, `join_code_used`.

- [ ] **Step 4: Añade los handlers y las rutas**

En `packages/core/src/invitations/api.ts`, exporta `memberInvitationsRoute`,
`createMemberInvitationRoute`, `revokeMemberInvitationRoute`, `createJoinCodeRoute`,
`joinCodePreviewRoute` y `joinCodeExchangeRoute`, con los scopes/rate limits de la spec §6.2–6.3.
Los rate limits públicos usan `identity: "ip"`. Las rutas de Next solo cablean `getInfra()` y estos
handlers.

- [ ] **Step 5: Crea la página `/join/[code]`**

Crea `apps/admin/src/app/join/[code]/page.tsx` (server component que llama al preview y pinta
invitador, instancia y estado) y `join-continue.tsx` (cliente con el botón **Continuar** que hace
`POST /join-codes/{code}/exchange` y navega a `/invite/<token>`). Añade `/join/<segmento>` a
`apps/admin/src/lib/public-paths.ts` y su test. La página es `noindex`/`no-referrer`; el GET no
muta nada. Tras el canje, navega con `window.location.assign(path)` (no con `router.push`), para que
el App Link de `/invite/` abra la app si está instalada; si no, la web sigue el flujo normal.

- [ ] **Step 6: Ejecuta y verifica el verde**

Run: `pnpm --filter @027apps/core test -- src/invitations`
Expected: PASS.
Run: `pnpm --filter admin test -- src/app/join src/lib/public-paths.test.ts`
Expected: PASS.
Run: `pnpm --filter db-tests test -- src/api/invitation-club.test.ts`
Expected: PASS, incluida la carrera.

- [ ] **Step 7: Actualiza OpenAPI y commit**

Añade las operaciones a `packages/core/src/openapi/registry.ts` y ejecuta
`pnpm --filter @027apps/core openapi:generate`.

```bash
git add packages/core/src/invitations apps/admin/src/app/api/v1/me apps/admin/src/app/api/v1/join-codes apps/admin/src/app/join apps/admin/src/lib/public-paths.ts packages/core/src/openapi docs/api/openapi.json packages/db-tests/src/api/invitation-club.test.ts
git commit -m "feat(invitations): member invitations, rotating QR codes and quota checks"
```

---

### Task 4: Canje anónimo, herencia y nivel grabado

**Files:**
- Modify: `packages/core/src/invitations/service.ts` (`previewInvitation`, `assertRedeemable`, `redeemInvitation`)
- Modify: `packages/core/src/invitations/api.ts` (`redeemInvitationSchema` con `name`)
- Modify: `apps/admin/src/app/invite/[token]/{page.tsx,invite-form.tsx,invite-wizard.tsx}` (campos editables cuando `requires_identity`)
- Modify: `apps/admin/src/lib/invite-form.ts` (validación nombre/email)
- Test: `packages/core/src/invitations/service.test.ts`, `packages/db-tests/src/api/invitation-club.test.ts`, `apps/admin/src/app/invite/[token]/invite-form.test.tsx`

**Interfaces:**
- Consumes: Task 3 (invitaciones anónimas), Task 1 (`invited_by`, `invite_level`, `invitation_categories`).
- Produces: `InvitationPreview.requires_identity: boolean`; `RedeemInput.name?: string`; el perfil creado recibe `invited_by = created_by` y `invite_level = depth` (NULL si el rol es `admin`).

- [ ] **Step 1: Escribe los tests**

```ts
it("previews an anonymous invitation with requires_identity and no email", ...);
it("redeems an anonymous invitation with the name and email from the form", ...);
it("still rejects an email that does not match a named invitation", ...);
it("keeps an existing account's name, role, level and invited_by", ...);
it("leaves invite_level null when the invitation grants admin", ...);
it("does not redeem when the inviter was deactivated", ...);
```

- [ ] **Step 2: Ejecuta y verifica el rojo**

Run: `pnpm --filter @027apps/core test -- src/invitations/service.test.ts`
Expected: FAIL en los casos nuevos.

- [ ] **Step 3: Implementa el canje anónimo**

- `previewInvitation`: si `email`/`name` son NULL, devuelve `requires_identity: true`,
  `email: null`, `name: null`, `account_exists: false` y no llama a Auth.
- `assertRedeemable`: si `row.email` es NULL, acepta cualquier email; si no, exige coincidencia.
- `redeemInvitation`: resuelve `email`/`name` del body cuando la invitación es anónima; crea el
  perfil con `invited_by` y `invite_level`; inserta `invitation_categories` en
  `user_category_members`; mantiene `invitation_modules` como única fuente de acceso. Antes de
  tocar Auth, comprueba que el invitador no está desactivado (`invitation_inviter_inactive`).
- `redeemInvitationSchema`: `name` opcional 1..80; `email` obligatorio.

- [ ] **Step 4: Actualiza el formulario web**

`invite-form.ts` exige nombre y email cuando el preview trae `requires_identity`; los campos se
ocultan/sustituyen por la ficha bloqueada cuando no. El test de componente cubre los dos modos.

- [ ] **Step 5: Ejecuta y verifica el verde**

Run: `pnpm --filter @027apps/core test -- src/invitations/service.test.ts`
Run: `pnpm --filter admin test -- src/app/invite`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/invitations apps/admin/src/app/invite apps/admin/src/lib/invite-form.ts
git commit -m "feat(invitations): redeem anonymous invitations and inherit the inviter package"
```

---

### Task 5: Solicitudes, concesiones y push

**Files:**
- Create: `packages/core/src/invitations/requests.ts`, `requests.test.ts`
- Modify: `packages/core/src/invitations/api.ts` (handlers de solicitudes y concesiones)
- Modify: `packages/core/src/realtime/service.ts` (push: `state` y `places`; nunca `amount` en estos eventos)
- Modify: `packages/core/src/users/api.ts` (rutas de grants) — o handlers en `requests.ts`
- Create: `apps/admin/src/app/api/v1/me/invitation-requests/route.ts`, `.../[id]/cancel/route.ts`, `apps/admin/src/app/api/v1/invitation-requests/route.ts`, `.../[id]/approve/route.ts`, `.../[id]/reject/route.ts`, `apps/admin/src/app/api/v1/users/[id]/invitation-grants/route.ts`, `.../[grantId]/route.ts`
- Test: `packages/core/src/invitations/requests.test.ts`, `packages/db-tests/src/api/invitation-club.test.ts`, `packages/core/src/realtime/service.test.ts`

**Interfaces:**
- Consumes: `invitationQuota`, `invitations.levels`, outbox.
- Produces:
  ```ts
  export type InvitationRequestView = {
    id: string; requester: { id: string; display_name: string; level: number | null };
    amount: number; reason: string | null; state: 'pending'|'approved'|'rejected'|'cancelled';
    granted_amount: number | null; resolution_reason: string | null;
    resolved_by: { id: string; display_name: string } | null;
    resolved_at: string | null; created_at: string;
  };
  export type GrantView = {
    id: string; user_id: string; amount: number;
    granted_by: { id: string; display_name: string } | null;
    request_id: string | null; reason: string | null;
    revoked_at: string | null; created_at: string;
  };
  export async function requestInvitationQuota(deps, caller, input: { amount: number; reason?: string }): Promise<InvitationRequestView>;
  export async function cancelInvitationRequest(deps, caller, id: string): Promise<void>;
  export async function listInvitationRequests(deps, page): Promise<{ requests: InvitationRequestView[]; total: number }>;
  export async function listOwnInvitationRequests(deps, userId: string, limit: number): Promise<InvitationRequestView[]>;
  export async function approveInvitationRequest(deps, caller, id: string, amount: number): Promise<InvitationRequestView>;
  export async function rejectInvitationRequest(deps, caller, id: string, reason?: string): Promise<InvitationRequestView>;
  export async function grantInvitationQuota(deps, caller, userId: string, input: { amount: number; reason?: string }): Promise<GrantView>;
  export async function listInvitationGrants(deps, userId: string): Promise<GrantView[]>;
  export async function revokeInvitationGrant(deps, caller, userId: string, grantId: string): Promise<void>;
  ```

- [ ] **Step 1: Escribe los tests**

```ts
it("refuses a request while the caller still has seats", ...);      // invitation_quota_available
it("keeps one pending request and allows another after cancelling", ...);
it("approves once when two admins click at the same time", ...);   // request_resolved
it("creates one grant with the approved amount and emits request_resolved", ...);
it("rejects and cancels with a reason and never grants", ...);
it("lists and revokes grants without deleting history", ...);
it("sends push with key and state, and never an amount", ...);
```

- [ ] **Step 2: Ejecuta y verifica el rojo**

Run: `pnpm --filter @027apps/core test -- src/invitations/requests.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementa `requests.ts`**

- Crear: exige sesión, `remaining === 0`, una sola pendiente; inserta y encola
  `invitation.requested` con `target: 'admins'`, `resource: { request_id, actor_name, amount,
  level, remaining }`, `notify: ['push']`.
- Aprobar: `update public.invitation_requests set state='approved', granted_amount=$2,
  resolved_by=$3, resolved_at=now() where id=$1 and state='pending' returning *`; si no hay fila,
  `request_resolved`. Inserta la concesión y encola `invitation.request_resolved` con
  `target: 'user'`, `subject_id: requester_id`, `resource: { state, amount }`, `notify: ['push']`.
- Rechazar/cancelar: la misma actualización condicional, sin concesión.
- Concesiones: `grantInvitationQuota` inserta; `revokeInvitationGrant` marca `revoked_at` y
  comprueba que la concesión es de ese usuario (`404` si no).

- [ ] **Step 4: Ajusta el push y las rutas**

En `realtime/service.ts`, añade `state` y `places` al mapa de datos del push (no uses `amount` para
estos eventos). En `api.ts`, exporta los handlers con los scopes y rate limits de la spec §6.2–6.4.
Las rutas de Next cablean `getInfra()` y los servicios; las de grants usan `users:write`. Extiende
`GET /me/invitations` (Task 3) con `requests: listOwnInvitationRequests(deps, caller.userId, 10)`,
que es el histórico que pinta la app.

- [ ] **Step 5: Ejecuta y verifica el verde**

Run: `pnpm --filter @027apps/core test -- src/invitations/requests.test.ts src/realtime/service.test.ts`
Run: `pnpm --filter db-tests test -- src/api/invitation-club.test.ts`
Expected: PASS, incluida la doble aprobación.

- [ ] **Step 6: OpenAPI y commit**

```bash
git add packages/core/src/invitations/requests.ts packages/core/src/invitations/requests.test.ts packages/core/src/invitations/api.ts packages/core/src/realtime/service.ts packages/core/src/openapi docs/api/openapi.json apps/admin/src/app/api/v1
git commit -m "feat(invitations): quota requests, grants and admin push"
```

---

### Task 6: Panel — ajustes de niveles, delegable y ficha del miembro

**Files:**
- Create: `apps/admin/src/components/invitation-levels-editor.tsx`, `.test.tsx`
- Create: `apps/admin/src/components/member-invitation-panel.tsx`, `.test.tsx`
- Create: `apps/admin/src/lib/invitation-grants.ts`, `.test.ts`
- Modify: `apps/admin/src/components/settings-form.tsx` (+ `lib/settings-form.ts`) para el editor
- Modify: `apps/admin/src/lib/settings-sections.ts` (slug `invitations`, sección, etiqueta) y `settings-sections.test.ts`
- Modify: `apps/admin/src/components/panel-nav.tsx` (icono `UsersIcon` y entrada de ajustes) y `panel-nav.test.tsx`
- Modify: `apps/admin/src/app/(panel)/panel/members/[id]/page.tsx`
- Modify: `apps/admin/src/app/(panel)/panel/modules/[key]/page.tsx` y su formulario de módulo
- Modify: `packages/core/src/modules/api.ts` (schema `delegable`), `packages/core/src/modules/service.ts` (update)
- Modify: `packages/core/src/modules/service.test.ts`

**Interfaces:**
- Consumes: Task 5 (grants), Task 2 (levels), `GET/PATCH /users/{id}`, `POST/DELETE /users/{id}/invitation-grants`.
- Produces: componentes cliente que hablan con la API por `fetch` y revalidan la página.

- [ ] **Step 1: Escribe los tests de los componentes**

```tsx
it("adds, removes and reorders contiguous levels and blocks gaps", ...);
it("serializes the levels array and sends it in the batch", ...);
it("shows base, granted and used, and disables inviting at zero", ...);
it("shows each grant with its granted_by and revokes it", ...);
it("changes the level and warns when a user has none", ...);
it("toggles module delegable", ...);
```

- [ ] **Step 2: Ejecuta y verifica el rojo**

Run: `pnpm --filter admin test -- src/components/invitation-levels-editor.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Registra la sección de ajustes**

Añade `"invitations"` a `SettingsSectionSlug`, la entrada `{ slug: "invitations", categoryKey:
"invitations", label: "Invitations", minRole: "admin" }` a `SETTINGS_SECTIONS`, y su caso en
`settingsSectionLabel`. En `panel-nav.tsx`, añade `invitations: UsersIcon` al mapa de ajustes y la
entrada de navegación. Actualiza sus tests. Sin esto, `/panel/settings/invitations` no existe.

- [ ] **Step 4: Implementa el editor de niveles**

`InvitationLevelsEditor` recibe `value: InvitationLevel[]` y `onChange(next)`. Añade/quita filas,
numera los niveles automáticamente (1..N), valida `quota` 0..100 y muestra el total máximo de
cuentas que permitiría la configuración. En `settings-form.ts`, para la clave
`invitations.levels`: `encodeSettingValue` devuelve `JSON.stringify(value)`, `parseSettingValue`
hace `JSON.parse(raw)` (y si falla devuelve `raw` para que la API lo rechace con
`validation_failed`), y el formulario renderiza el editor en vez del textarea.

- [ ] **Step 5: Implementa la ficha del miembro**

`MemberInvitationPanel` recibe el `UserView` con `invitation_level`, la cuota y las concesiones.
Muestra «nivel», «base + concedidas», «usadas/reservadas» y la lista de concesiones con su botón
de retirar. El selector de nivel llama `PATCH /users/{id}`; un `user` sin nivel muestra el aviso y
el botón de asignar. El interruptor `delegable` del módulo llama al `PATCH /modules/{key}` que ya
acepta `is_public`/`mcp_exposed`, ampliado con `delegable` en el paso anterior.

- [ ] **Step 6: Ejecuta y verifica el verde**

Run: `pnpm --filter admin test -- src/components/invitation-levels-editor.test.tsx src/components/member-invitation-panel.test.tsx src/lib/invitation-grants.test.ts src/lib/settings-form.test.ts`
Run: `pnpm --filter @027apps/core test -- src/modules/service.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/components apps/admin/src/lib apps/admin/src/app/\(panel\)/panel/members apps/admin/src/app/\(panel\)/panel/modules
git commit -m "feat(admin): invitation levels, delegable modules and member quota"
```

---

### Task 7: Panel — Solicitudes, listado y árbol

**Files:**
- Create: `apps/admin/src/app/(panel)/panel/requests/page.tsx`, `.test.tsx`
- Create: `apps/admin/src/components/pending-requests-badge.tsx`, `.test.tsx`
- Create: `apps/admin/src/components/invitation-request-actions.tsx`, `.test.tsx`
- Create: `apps/admin/src/lib/invitation-requests.ts`, `.test.ts`
- Modify: `apps/admin/src/app/(panel)/panel/page.tsx` (badge)
- Modify: `apps/admin/src/app/(panel)/panel/invitations/page.tsx` (+ `components/invitation-actions.tsx`)
- Modify: `apps/admin/src/app/(panel)/panel/members/[id]/page.tsx` (árbol)

**Interfaces:**
- Consumes: Task 5 (`GET /invitation-requests`, approve/reject), `GET /invitations`, `GET /users?…`.
- Produces: página de solicitudes y badge; la lista de invitaciones muestra `source`, `anonymous` y `created_by`, y oculta renovar/rotar/reenviar en `member`/`qr`.

- [ ] **Step 1: Escribe los tests**

```tsx
it("lists pending first with requester, amount, reason and live quota", ...);
it("approves with an amount and refuses a second click with request_resolved", ...);
it("rejects with a reason", ...);
it("polls the pending count every 60s and on focus", ...);
it("hides renew, rotate and resend for member and qr invitations", ...);
it("shows the descendant tree of a member", ...);
```

- [ ] **Step 2: Ejecuta y verifica el rojo**

Run: `pnpm --filter admin test -- src/app/\(panel\)/panel/requests/page.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementa la página y el badge**

La página es un server component que carga con `listInvitationRequests` (o `fetch` a la API con la
sesión) y pasa los datos a un cliente. `InvitationRequestActions` usa un diálogo con cantidad
(por defecto la pedida) y motivo; tras aprobar/rechazar llama `router.refresh()`. El badge es un
cliente que consulta `GET /invitation-requests?state=pending&limit=1` al montar, cada 60 s con
`document.visibilityState === 'visible'`, y en `focus`.

- [ ] **Step 4: Ajusta la lista y el árbol**

`invitation-actions.tsx` recibe `source` y solo pinta renovar/rotar/reenviar cuando
`source === 'admin'`; para `member`/`qr` solo revocar. La ficha del miembro pinta el subárbol con
`GET /users?invited_by=<id>` (Task 2) y el nivel de cada hijo.

- [ ] **Step 5: Ejecuta y verifica el verde**

Run: `pnpm --filter admin test -- src/app/\(panel\)/panel/requests src/components/pending-requests-badge.test.tsx src/components/invitation-request-actions.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/app/\(panel\) apps/admin/src/components apps/admin/src/lib/invitation-requests.ts
git commit -m "feat(admin): requests inbox, invitation sources and member tree"
```

---

### Task 8: App — pantalla de invitación, QR y solicitud

**Files:**
- Create: `apps/android/app/src/main/java/com/rferic/zero27apps/ui/screens/InviteMembersScreen.kt`
- Create: `apps/android/app/src/test/java/com/rferic/zero27apps/InviteMembersTest.kt`
- Modify: `apps/android/app/src/main/java/com/rferic/zero27apps/ui/{AppRoot,AppViewModel,AppState}.kt`
- Modify: `apps/android/app/src/main/java/com/rferic/zero27apps/data/{Dtos,ApiClient}.kt`
- Modify: `apps/android/app/src/main/java/com/rferic/zero27apps/ui/i18n/{Strings,LocalStrings}.kt`
- Modify: `apps/android/app/src/main/java/com/rferic/zero27apps/Changelog.kt`, `app/build.gradle.kts`
- Test: `InviteMembersTest.kt`, `ChangelogTest` (existente)

**Interfaces:**
- Consumes: `GET/POST /me/invitations`, `POST /me/join-codes`, `DELETE /me/invitations/{id}`, `POST /me/invitation-requests`, `GET /invitation-requests` (admins).
- Produces: `AppState.InviteMembers` o un estado dentro de `SignedIn`; `AppViewModel.loadInvitations()`,
  `createInviteLink()`, `createJoinCode()`, `revokeInvitation(id)`, `requestQuota(amount, reason)`,
  `cancelRequest(id)`.

- [ ] **Step 1: Escribe los tests de ViewModel/API**

Con `MockEngine`, como el resto de la app:

```kotlin
@Test fun `quota bar counts used plus reserved over base plus granted`() { ... }
@Test fun `creating a link adds a pending invitation and shows the path`() { ... }
@Test fun `a join code expiring is replaced by a new one`() { ... }
@Test fun `a request shows pending and can be cancelled`() { ... }
@Test fun `an admin sees pending requests read only`() { ... }
```

- [ ] **Step 2: Ejecuta y verifica el rojo**

Run: `cd apps/android && ./gradlew :app:testDebugUnitTest --tests "com.rferic.zero27apps.InviteMembersTest"`
Expected: FAIL (la pantalla y los métodos no existen).

- [ ] **Step 3: Implementa los DTO, el cliente y el ViewModel**

Añade a `Dtos.kt` `InvitationQuotaDto`, `MemberInvitationDto`, `InviteeDto`, `InvitationRequestDto`,
`JoinCodeDto`; a `ApiClient.kt` los métodos con la misma forma que los endpoints. En
`AppViewModel`, un `StateFlow<InviteMembersState>` con `loading`, `quota`, `invitations`,
`invitees`, `requests`, `error`; las acciones actualizan el estado y recargan la cuota tras cada
cambio.

- [ ] **Step 4: Implementa la pantalla**

`InviteMembersScreen` con: barra «usadas + reservadas / base + concedidas», lista de invitados,
botón **Mostrar QR** (reutiliza `ui/migration/QrCode.kt`, `FLAG_SECURE`, cuenta atrás de 90 s y
autorrenovación a los ~75 s), botón **Crear enlace** (copia al portapapeles), lista de invitaciones
pendientes con revocar, y **Solicitar al administrador** cuando `remaining == 0`. Para admin,
sección de solicitudes de solo lectura con «Gestionar en el panel». Entrada desde **Inicio** (tarjeta
del club siempre para miembros: «Invitar» o «Pedir» según la cuota; para un admin, solicitudes
pendientes) y desde **Ajustes** (fila «Invitaciones» con la misma barra de cuota, siempre visible);
sin pestaña nueva.

- [ ] **Step 5: Sube la versión y añade el changelog**

`app/build.gradle.kts`: `versionCode = 2000`, `versionName = "0.20.0"`. En `Changelog.kt`, entrada
`0.20.0` con al menos una línea en **los 9 locales** de `shippedLocales`; `ChangelogTest` falla si
falta una.

- [ ] **Step 6: Ejecuta y verifica el verde**

Run: `cd apps/android && ./gradlew :app:testDebugUnitTest`
Expected: PASS, incluido `ChangelogTest`.
Run: `cd apps/android && ./gradlew :app:assembleDebug`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 7: Commit**

```bash
git add apps/android
git commit -m "feat(android): invitation screen with quota, QR and requests"
```

---

### Task 9: App — push, deep links y solicitudes de administrador

**Files:**
- Modify: `apps/android/app/src/main/java/com/rferic/zero27apps/PushText.kt`, `PushMessagingService.kt`
- Modify: `apps/android/app/src/main/java/com/rferic/zero27apps/ui/AppRoot.kt` (deep link `/join/` y destino de la push)
- Modify: `apps/android/app/src/main/AndroidManifest.xml` (App Link `/join/`)
- Modify: `apps/android/app/src/main/java/com/rferic/zero27apps/ui/i18n/{Strings,LocalStrings}.kt`
- Modify: `apps/android/app/src/main/java/com/rferic/zero27apps/Changelog.kt` (misma entrada 0.20.0)
- Test: `apps/android/app/src/test/java/com/rferic/zero27apps/PushTextTest.kt`

**Interfaces:**
- Consumes: push data `{ key, module, state }` (Task 5), `GET /invitation-requests`.
- Produces: `PushText.title/body` reconoce `push.invitation_requested` y `push.invitation_request_resolved`; la push abre la pantalla de invitación (solicitud) o el panel (administrador).

- [ ] **Step 1: Escribe los tests de `PushText`**

```kotlin
@Test fun `invitation request push uses the localized generic text`() { ... }
@Test fun `resolved push distinguishes approved from rejected`() { ... }
@Test fun `an expense push still renders amount and description`() { ... } // regresión
```

- [ ] **Step 2: Ejecuta y verifica el rojo**

Run: `cd apps/android && ./gradlew :app:testDebugUnitTest --tests "com.rferic.zero27apps.PushTextTest"`
Expected: FAIL.

- [ ] **Step 3: Implementa el mapa `key → texto`**

En `PushText.body`, antes de la composición actual, `when (data["key"])`:
`push.invitation_requested` → texto fijo «Nueva solicitud de invitación» (localizado);
`push.invitation_request_resolved` → «Solicitud aprobada» o «Solicitud rechazada» según
`data["state"]`. Sin importes ni nombres. Añade las claves a `Strings.kt` en los 9 idiomas. No
cambies el camino de `owe-no`.

- [ ] **Step 4: Deep links y destino**

`AndroidManifest.xml`: filtro App Link para `https://<host>/join/` (además de `/invite/`), y el
esquema de debug. `MainActivity`/`AppRoot` parsea `/join/<code>`, llama a
`POST /join-codes/{code}/exchange` (la apertura la provoca el usuario al escanear; no hay prefetch),
navega a `InviteScreen` con el token y, si el canje falla, muestra el error y pide otro QR. Una push
de solicitud abre la sección de solicitudes de la app; si el usuario no es admin, el servidor no le
envía esa push.

- [ ] **Step 5: Ejecuta y verifica el verde**

Run: `cd apps/android && ./gradlew :app:testDebugUnitTest`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/android
git commit -m "feat(android): localized invitation pushes and join deep links"
```

---

### Task 10: Documentación, i18n, OpenAPI y cierre

**Files:**
- Modify: `docs/flows/invitations.md`
- Modify: `docs/superpowers/specs/2026-10-26-realtime-notificaciones.md` (§4, catálogo)
- Modify: `docs/ai/landing.md` (fila Miembros, si procede)
- Modify: `packages/i18n/catalog.en.json` + `packages/i18n/locales/*.json` (textos nuevos)
- Modify: `docs/tasks/sprint-18-invitation-club/**` (estados)
- Test: suite completa + auditoría

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: documentación al día y evidencia de cierre.

- [ ] **Step 1: Actualiza los flujos y el catálogo de eventos**

Reescribe `docs/flows/invitations.md` con: niveles y cuota, QR (90 s/15 min), enlace (48 h), canje
anónimo, solicitud/aprobación, ascenso, expulsión y purga. Añade a la spec de realtime
`invitation.requested` (admins, push) e `invitation.request_resolved` (user, push).

- [ ] **Step 2: i18n**

Escribe los textos nuevos en inglés como clave, ejecuta `pnpm i18n:scan` y commitea el catálogo;
rellena los 8 locales no base (o abre el PR del traductor, según el flujo). `pnpm i18n:check` debe
pasar.

- [ ] **Step 3: OpenAPI y landing**

`pnpm --filter @027apps/core openapi:generate` y `pnpm check:openapi`. Revisa `docs/ai/landing.md`:
si la app deja de estar «prevista» para invitaciones, actualiza la fila de Miembros en el mismo PR.

- [ ] **Step 4: Verificación completa**

```bash
pnpm lint
pnpm tsc
pnpm test
pnpm --filter admin build
pnpm --filter db-tests test
pnpm check:openapi
pnpm i18n:check
cd apps/android && ./gradlew :app:testDebugUnitTest
```

Expected: todo PASS. Pega la salida en la tarea del sprint. `db-tests` asume base local limpia: usa
`supabase db reset` **solo** contra el stack local y avisando de que borra los datos de desarrollo;
nunca contra un proyecto enlazado.

- [ ] **Step 5: Auditoría de seguridad**

Un agente distinto del autor audita el diff contra `docs/conventions/security-checklist.md`:
cuota y advisory lock, aprobación condicional, RLS de las tablas nuevas, tokens y logs, rate
limits, herencia de módulos, push sin PII, QR bearer y deep links. Los hallazgos críticos/altos se
corrigen antes de `finalizada`.

- [ ] **Step 6: Commit de cierre**

```bash
git add docs packages/i18n docs/api/openapi.json
git commit -m "docs(invitations): club flow, event catalog and i18n"
```

---

## Autoevaluación del plan

- **Cobertura de la spec:** §5 (modelo) → Task 1; §5.9 (cuota) → Task 2; §6.2–6.3 (miembro/QR) →
  Task 3; §6.3 (canje anónimo) → Task 4; §6.4 (solicitudes/concesiones) → Task 5; panel → Tasks 6–7;
  app → Tasks 8–9; §10 (docs/i18n/OpenAPI/auditoría) → Task 10; pantallas y copy → Task 0 (P2).
- **Tipos:** `InvitationQuota`, `InvitationLevel`, `InvitationRequestView`, `GrantView`,
  `InvitationPreview.requires_identity` se definen una vez y se consumen con ese nombre.
- **Review Focus:** las cinco carreras/estados tienen test en Task 2, 3, 4 y 5.
- **Tamaño:** el plan decide; no transcribe los cuerpos salvo la migración y los schemas, que son
  decisiones.
