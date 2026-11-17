---
id: sprint-16-task-04
titulo: Contrato de invitación — preview (A2), rol (A6) y cuenta existente (A7)
area: core + bd + panel
estado: test
plan: docs/superpowers/plans/2026-11-16-invitation-session-migration.md
fuente: docs/superpowers/specs/2026-11-16-invitation-session-migration-design.md
adrs: [0004, 0007, 0008]
---

**Tarea**: ampliar el contrato de invitaciones **antes** de construir los formularios: vista previa
pública por token (A2), rol en la invitación con guardrails (A6) y flujo para un email que ya tiene
cuenta (A7). Incluye la variante de email y la migración de datos.

**Implementación completa 2026-11-17; en revisión/QA y auditoría de seguridad antes de
`finalizada`.**

- Migración `0035_invitation_role_ttl.sql` aplicada y verificada: rol `user`/`admin`, duración
  original con backfill real (`ceil`, 1..365) y default 7.
- `previewInvitation` + `GET /api/v1/invitations/{token}/preview` (público, 60/min por IP): estado
  pending/used/expired, `account_exists`, `role_applies`, nombre e idioma de la invitación,
  `inviter_name` (null con clave), `instance_name` y `timezone`. Revocada y desconocida → mismo 404;
  sin id, hash, módulos, categoría ni rol actual de una cuenta existente.
- `createInvitation` acepta `role` (guard en el servicio: sesión `super_admin` o clave de servicio
  con `roleCap: super_admin`; delegada nunca; `admin` → 403; `super_admin` → 400), guarda
  `expires_in_days`, ya no rechaza un email registrado y devuelve `account_exists`. Respuesta 201
  con rol y `account_exists`.
- `RedeemResult.user.role` es el rol **efectivo** del perfil, `super_admin` incluido: canjear
  una cuenta existente nunca lo degrada (D6) y la web decide panel/bienvenida con ese valor.
- `redeemInvitation` recibe el `Caller`: una cuenta existente exige **su** sesión (D21) y sin ella
  o con otra devuelve `409 existing_account_signin_required` sin consumir; conserva nombre, rol y
  contraseña; una cuenta nueva toma el rol y el nombre de la invitación e ignora `display_name`; el
  `password` solo es obligatorio para la cuenta nueva. La ruta usa el resolvedor de auth real.
- `renewInvitation` + `POST /api/v1/invitations/{id}/renew`: solo caducadas, rota el token, reusa
  `expires_in_days`, limpia los intentos de email y comparte el cooldown de 60 s sin rotar cuando
  devuelve 429.
- Email con variantes de cuenta existente (D16) y rol admin en 9 idiomas; el mailer calcula
  `accountExists`. Panel: selector de rol solo para `super_admin`, rol visible en lista y ficha, y
  el panel de creación explica cuenta existente y rol admin.
- OpenAPI regenerado (preview, renew, `Invitation` con `role`/`expires_in_days`, `RedeemResult` con
  `role`, `InvitationCreated` con `account_exists`).

**Evidencia**: `pnpm --filter @027apps/core test` (504), `pnpm --filter admin test` (1208),
`pnpm tsc`, `pnpm lint`, `pnpm i18n:check` y `pnpm check:openapi` en verde; `db-tests` de
invitaciones 31/31 en local con `SUPABASE_DB_URL`; CI en verde en `f71727c` (incluye `supabase` con
la migración y los `db-tests`). Prueba real contra el `next dev` local: preview de una invitación
nueva devuelve el contrato de §6.2 y `account_exists: true` + `role_applies: false` para una cuenta
existente; token desconocido → 404.

Pendiente: auditoría de seguridad (preview público, guardrail de rol, sesión primero, single-use y
logs) y la revisión/QA antes de `finalizada`.

**Auditoría de seguridad (2026-11-17)**

- A01 acceso: el preview es público solo por token (60/min por IP) y no enumera: revocada y
  desconocida comparten 404; crear y renovar exigen sesión y `invitations:write`; el rol se valida
  en el servicio (sesión `super_admin` o clave de servicio con `roleCap: super_admin`, delegada
  nunca) y una cuenta existente exige **su** sesión.
- A02 cripto/exposición: el token sigue solo como SHA-256; el preview no devuelve id, hash,
  módulos, categoría ni el rol actual de una cuenta existente. Se añadieron `cache-control:
  no-store`, `x-robots-tag: noindex` y `referrer-policy: no-referrer` a las respuestas de preview y
  canje (antes solo los llevaba la página), con test. `routeOf` redacta el token en las rutas
  nuevas (`/preview`, `/redeem`) y hay test.
- A03 inyección: zod en el borde (rol `super_admin` → 400), SQL parametrizado y el escapado del
  email intacto.
- A04 abuso: límites por IP en preview/canje, cooldown de 60 s en renovación **antes** de rotar
  (un 429 no invalida el enlace), single-use con `for update` sin cambios.
- A07 autenticación: sesión primero (D21); el puerto de Auth no tiene `verifyPassword` y el Core
  nunca verifica contraseñas; una cuenta existente conserva nombre, rol y contraseña.
- Veredicto: sin hallazgos abiertos; el único hueco encontrado (cabeceras de las respuestas con
  token) queda corregido. Pendiente la revisión independiente.

**Punto de partida (verificado)**
- `createInvitation` rechaza un email registrado con `email_registered`.
- `redeemInvitation` reutiliza una cuenta existente y conserva su contraseña, pero **no la
  verifica**; hoy no es explotable porque no se puede invitar a un email existente, pero lo será al
  quitar esa restricción.
- `InvitationView` no tiene rol ni duración; `profiles` se inserta siempre con `role = 'user'`.
- No hay endpoint público de preview.
- `rotateInvitationToken` rechaza caducadas; no hay renovación.

**Alcance**
- Dentro:
  - Migración `0035_invitation_role_ttl.sql` (`role`, `expires_in_days`, backfill).
  - `previewInvitation` (spec §6.2) + `GET /api/v1/invitations/{token}/preview`.
  - `createInvitation` con `role` (solo sesión `super_admin` o clave de servicio con
    `roleCap: "super_admin"`; una clave delegada nunca), `expires_in_days`, email existente
    permitido y `account_exists` en la respuesta.
  - `redeemInvitation` con **sesión del mismo usuario** para cuentas existentes (D21, sesión
    primero): no verifica contraseñas en el Core; sin sesión u otro usuario →
    `409 existing_account_signin_required`. Nombre de la invitación (ignora `display_name`), rol
    solo en perfiles nuevos y rol/nombre/contraseña conservados en existentes. La ruta usa el
    resolvedor de auth real, no `anon` fijo.
  - `renewInvitation` y su ruta (el panel se cablea en la 09).
  - `InvitationsAuth` se queda con `findUserByEmail`, `createUser` y `deleteUser`; **no** hay
    `verifyPassword` ni cliente anon de verificación.
  - Email: variantes cuenta nueva/existente y rol admin, en 9 idiomas; asunto con `instance.name`.
  - Panel: selector de rol visible solo a `super_admin`; rol y `account_exists` visibles.
  - OpenAPI y tests.
- Fuera: formularios web/app (06/07); la pantalla de renovación (09); el QR (10).

**Dependencias**: tarea 01. La 06 y la 07 dependen de esta.

**Riesgos**: que el guardrail de rol se quede solo en la UI (debe estar en el servicio y probarse
con sesión, service y delegada; la delegada siempre denegada); que el canje de una cuenta existente
se haga sin sesión o con otro usuario (debe ser `409 existing_account_signin_required`, sin
consumir); que el backfill de
`expires_in_days` redondee mal (usar `ceil` y probar filas reales); que el email de cuenta
existente confunda (copy explícito).

**Criterios de aceptación**
- `GET /invitations/{token}/preview` devuelve el contrato de §6.2 sin id, hash, módulos ni rol
  actual de una cuenta existente.
- Un `admin` no puede crear `admin` (403); un `super_admin` sí; `super_admin` como rol → 400; una
  clave de servicio con `roleCap` distinto tampoco.
- Invitar a un email existente devuelve 201 con `account_exists: true` y envía la variante.
- Canjear una cuenta existente sin sesión o con otro usuario devuelve `409
  existing_account_signin_required` y no consume; con la sesión del mismo usuario, conserva
  contraseña, nombre y rol. La contraseña incorrecta la devuelve Supabase Auth al firmar, antes de
  llamar al canje.
- Una cuenta nueva nace con el rol de la invitación; `display_name` no cambia el nombre.
- `renewInvitation` solo actúa sobre caducadas, rota el token, reusa la duración y respeta el
  cooldown.
- `pnpm --filter core test`, `pnpm --filter db-tests test`, `pnpm check:openapi` en verde.
- Auditoría de seguridad: sin enumeración en preview, sin PII en logs, single-use bajo lock.

**Puertas de usuario**
- Aprobar D6 (rol de cuenta existente), D16 (email existente) y D10 (duración de renovación).
- Confirmar el fingerprint/APK no aplica aquí.

**Auditoría de seguridad**: obligatoria antes de `finalizada` (A01, A02, A03, A04, A07): preview
público, verificación de contraseña, guardrail de rol, single-use y logs.
