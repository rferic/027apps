---
id: sprint-06-task-08
titulo: Categorías + invitaciones
area: web
estado: test
adrs: [0004, 0005, 0007]
plan: docs/superpowers/plans/2026-11-06-web-admin.md
spec: docs/superpowers/specs/2026-11-06-web-admin-design.md
---

**Alcance**: CRUD de categorías, miembros, asignación de módulos (materializa `user_modules`), crear/listar/revocar invitaciones.

**TDD**: CRUD, asignación, estados.

**DoD**: igual.

## Informe de implementación (2026-11-07)

**Alcance entregado**: `/categories`, `/categories/[id]`, `/invitations`; CRUD de
categorías, miembros y plantilla de módulos; crear/listar/revocar invitaciones;
M2b (idioma/zona del perfil en el canje). Tests de helpers de mutación, de
lectura en proceso y de render estático de páginas.

### §10.1 Acciones sobre uno mismo

- **Invitarme a mí mismo**: el API lo permite; `createInvitation` no compara el
  email con el actor (`packages/core/src/invitations/service.ts:197`). El canje
  reutiliza la cuenta existente (`findUserByEmail`) y no cambia el rol, así que
  no hay escalada: solo consume la invitación. La UI no lo bloquea.
- **Borrar una categoría que me contiene**: el API lo permite y el borrado hace
  `cascade` solo sobre `user_category_members`
  (`packages/core/src/user-categories/service.ts:199`); `user_modules` (el grant
  real) no se toca. Sin efecto sobre el rol ni los scopes.
- **Quitarme de mi categoría**: `removeMember` tampoco comprueba el actor
  (`packages/core/src/user-categories/service.ts:234`); no revoca módulos. La UI
  ofrece la acción y el diálogo nombra al miembro y la consecuencia.
- **Conclusión**: ninguna de las tres rompe invariantes porque el rol y los
  scopes viven en `profiles`/`guard`, no en las categorías. El actor de estas
  páginas es `admin`, que ya tiene todos los scopes de gestión
  (`packages/core/src/auth/guard.ts:26`).

### §10.2 Procedencia del dato

- **Categoría**: `name`, `slug`, `created_at` y `member_count` (subconsulta
  `count(*)` viva) salen de `public.user_categories`
  (`packages/core/src/user-categories/service.ts:93`); `modules` de
  `public.user_category_modules` (`service.ts:70`); los miembros del `join` con
  `public.profiles` (`service.ts:112`). Un `0` es un cero real, no un “sin
  configurar”.
- **Módulo**: la clave es la del registro; el nombre se resuelve con
  `GET /api/v1/modules`. Si un módulo ya no está en el catálogo, la UI muestra la
  clave (`category-modules.tsx`, `names.get(key) ?? key`) en vez de inventar un
  nombre.
- **Invitación**: email, nombre, `expires_at`, `used_at`, `revoked_at` y
  `created_at` salen de `public.invitations`; el estado se **deriva** en
  `statusOf` (uso → revocada → caducada → pendiente,
  `packages/core/src/invitations/service.ts:146`), no viene de la base; los
  módulos de `public.invitation_modules`. La categoría se muestra por nombre
  desde el listado de categorías; `null` o un id desconocido se pinta “—”
  (`invitations/page.tsx`, `categoryName`).
- **Fechas**: se formatean con `Intl.DateTimeFormat(locale, {year, month,
  day})` sin zona de instancia (`invitations/page.tsx:50`). Es la deuda **M2d**
  de task-07 (ADR 0008, task-11); no se redefine aquí.
- **Acciones por rol**: categorías e invitaciones están en `ADMIN_SCOPES`
  (`guard.ts:26`), así que no hay controles de `super_admin` que ocultar en estas
  páginas; un `admin` ve todo lo que el API le permite.

### §10.3 Coherencia wizard → perfil

El canje crea el perfil con `localization.default_locale` y
`localization.timezone` de `settings`, con fallback por clave a `en`/`UTC`
(`packages/core/src/invitations/service.ts:182` y `:380`). Las cuentas ya
existentes conservan sus preferencias (`on conflict do nothing`). Cubierto por
tests unitarios (`packages/core/src/invitations/service.test.ts`, 4 casos) y de
integración (`packages/db-tests/src/invitations/service.test.ts`).

### No cubierto sin DOM

Apertura/cierre de `<dialog>`, cancelación con Escape durante la petición, copia
al portapapeles, doble submit y cualquier handler de cliente: quedan para
task-11, igual que en task-07. Los tests de páginas son de render estático y los
de mutación usan un `fetcher` inyectado. La lista de categorías no tiene
paginación porque `GET /api/v1/user-categories` devuelve el listado completo ni
la de invitaciones porque `GET /api/v1/invitations` tampoco pagina.

### Verificación (2026-11-07)

- `pnpm --filter core test`: 19 ficheros, 173 tests.
- `pnpm --filter admin test`: 46 ficheros, 309 tests.
- `pnpm --filter db-tests exec vitest run src/invitations/service.test.ts`: 10 tests.
- `pnpm lint` y `pnpm tsc`: verdes.
- `pnpm i18n:check`: 292 cadenas, 9 locales.
