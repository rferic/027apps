---
id: sprint-16-task-04
titulo: Contrato de invitación — preview (A2), rol (A6) y cuenta existente (A7)
area: core + bd + panel
estado: en curso
plan: docs/superpowers/plans/2026-11-16-invitation-session-migration.md
fuente: docs/superpowers/specs/2026-11-16-invitation-session-migration-design.md
adrs: [0004, 0007, 0008]
---

**Tarea**: ampliar el contrato de invitaciones **antes** de construir los formularios: vista previa
pública por token (A2), rol en la invitación con guardrails (A6) y flujo para un email que ya tiene
cuenta (A7). Incluye la variante de email y la migración de datos.

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
