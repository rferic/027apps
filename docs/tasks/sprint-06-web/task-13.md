---
id: sprint-06-task-13
titulo: Scopes de claves API y claves delegadas por propietario
area: web
estado: pendiente
adrs: [0004, 0007]
plan: docs/superpowers/plans/2026-11-08-api-key-scopes.md
spec: docs/superpowers/specs/2026-11-08-api-key-scopes-design.md
---

**Alcance**: alinear el guard y la gestión de claves con la política de scopes acordada el
2026-11-08 (spec: `docs/superpowers/specs/2026-11-08-api-key-scopes-design.md`).

Hoy `packages/core/src/auth/guard.ts` da a `USER_SCOPES` (y por herencia a admin y super_admin)
`api_keys:read/write/revoke`, y una clave delegada hereda el suelo del rol de su dueño
(`ROLE_CAP_FLOOR[role]`, con `maintenance:run` incluido si el dueño es super_admin), así que puede
llevar `settings:*`, `invitations:*` o `users:write`. Una service key hereda además `profile:*` y
`devices:*`. El panel permite crear `service` solo a super_admin y delegadas a cualquier panel role,
siempre atribuidas al actor: no existe selector de propietario.

Cambios:

- **Guard**: suelos separados por tipo de credencial. `ADMIN_SCOPES` deja de incluir `api_keys:*`;
  los conserva la sesión `user` (sobre las suyas), la sesión super_admin y los dos caps de service.
  `delegated` usa un allowlist fijo (nunca `settings:*`, `currencies:write`, `users:write`,
  `users:deactivate`, `roles:assign`, `user_categories:write`, `invitations:*`,
  `modules:grant/manage`, `maintenance:run`) y gana `users:read` y `user_categories:read` de toda la
  instancia (las categorías clasifican, no aíslan). `service` usa el set administrativo sin
  `profile:*` ni `devices:*`; `maintenance:run` sigue solo en cap super_admin.
- **`role_cap`**: obligatorio solo para `service`. En `delegated` el cap efectivo sigue siendo el rol
  vivo del perfil (`packages/core/src/auth/caller.ts:73`); si una fila antigua trae `role_cap`, el
  runtime lo ignora. No hay migración destructiva: el check de `0009` ya impide esa fila.
- **Recorte al validar**: los scopes efectivos de una clave se calculan en cada petición como
  `scopes ∩ allowlist(kind, cap)`; una clave antigua con scopes retirados deja de poder usarlos sin
  reescribir filas (no hay backfill de `scopes`).
- **Propiedad**: `POST /api/v1/api-keys` acepta `user_id` opcional solo para una sesión super_admin;
  una clave (incluida una delegada de un super_admin) nunca crea claves para otro usuario y no puede
  pedir scopes fuera de los suyos (no escalada). Propietario inexistente o desactivado → 404.
- **Límite**: 5 claves delegadas activas por usuario, validado en el Core dentro de transacción con
  `pg_advisory_xact_lock` por propietario; la sexta → 409 `conflict`.
- **Panel**: `/keys` y `/keys/new` pasan a `requirePanel("super_admin")`, el ítem Claves solo
  aparece a super_admin y el formulario añade selector de propietario (delegadas) y ofrece los
  scopes de cada tipo desde el allowlist del Core. Un admin deja de llegar: `api_keys:*` sale de
  `ADMIN_SCOPES` y la página devuelve el 403 genérico.
- **RLS**: la política de lectura de `api_keys` deja de dar al rol admin visibilidad de las
  delegadas (`supabase/migrations/0015_api_keys_owner_policy.sql`).

**Fuera de alcance**: el runtime de módulos (los scopes `<módulo>:read|read_write` se validan al
crear contra `module_registry`/`user_modules` y el acceso efectivo lo sigue comprobando
`hasAccess`); la app Android (solo consume el contrato: `user_id` opcional y 409 del límite, en una
tarea posterior); el listado de claves por una service key (sigue siendo acción de panel con
dueño); cambios en el modelo de datos más allá del índice/política citados.

## TDD

- `packages/core/src/auth/guard.test.ts`: sesión admin sin `api_keys:*`; sesión `user` con
  `api_keys:*`; super_admin con ellos; delegada con `users:read`/`user_categories:read`; delegada con
  `settings:write`, `currencies:write`, `users:write`, `users:deactivate`, `roles:assign`,
  `user_categories:write`, `invitations:write`, `modules:grant`, `modules:manage` y
  `maintenance:run` → 403; `service` con `profile:read` o `devices:read` → 403; `service` con
  `api_keys:read` en ambos caps; `service` cap admin sin `maintenance:run` ni `users:deactivate`;
  scopes almacenados fuera del allowlist se recortan (acción pedida → 403; el resto sigue).
- `packages/core/src/api-keys/service.test.ts` (nuevo): `user_id` ignorado/rechazado para un caller
  que no es sesión super_admin; propietario inexistente o desactivado → `not_found`; scope fuera del
  allowlist delegado → `validation_failed`; scope de módulo sin grant del dueño → `validation_failed`;
  sexta clave activa → `conflict`; clave revocada o caducada no cuenta para el límite; dos
  creaciones concurrentes no superan 5 (lock); una delegada no puede pedir un scope que ella no
  tiene; una delegada nunca crea `service` ni para otro usuario;
  **la delegada de un super_admin lista, detalla y revoca solo las de su dueño** (hoy `isSuperAdmin`
  mira el cap y le abre todas).
- `packages/core/src/api-keys/api.test.ts`: el body con `user_id` llega al servicio; 403 de un caller
  sin `api_keys:write`; `user_id` con forma no-uuid → `validation_failed`.
- `packages/db-tests/src/rls/api-keys-devices.test.ts`: un admin ya no lee delegadas de otro
  usuario; el dueño sí; super_admin sí; service keys siguen ocultas a admin.
- `apps/admin/src/lib/panel-guard` + `apps/admin/src/app/(panel)/keys/*.test.tsx`: `/keys` y
  `/keys/new` con rol admin → 403 genérico.
- `apps/admin/src/components/panel-nav.test.tsx`: el ítem `/keys` no se renderiza para admin y sí
  para super_admin.
- `apps/admin/src/lib/api-key-scopes.test.ts`: delegada ofrece exactamente el allowlist delegado;
  service cap admin/super ofrece solo lo permitido; `settings`/`invitations`/`maintenance` no
  aparecen en una delegada.
- Formulario (`api-key-create-form.test.tsx`): selector de propietario solo para super_admin;
  envío con `user_id`; mensaje de límite al llegar a 5; selector de scopes podado al cambiar
  tipo/cap.

## DoD

- DoD de **Código** completo: TDD, `pnpm lint && pnpm tsc && pnpm test` en verde,
  `pnpm --filter admin build`, `pnpm i18n:check` y `pnpm --filter db-tests test` si el entorno de
  `docs/flows/local-development.md` está disponible. CI del PR en verde.
- ADRs 0004 (bordes/guard) y 0007 (envelope) respetados; el contrato `api_keys` se documenta como
  delta en `docs/superpowers/specs/2026-10-26-core-api.md` §3.6 y en
  `docs/superpowers/specs/2026-10-25-token-model.md` §5.
- QA de un segundo agente contra la spec y los criterios de aceptación (§9).
- **Auditoría de seguridad OWASP** obligatoria por un agente distinto del autor, con
  `docs/conventions/security-checklist.md`, centrada en **A01** (escalada de privilegios al mintear
  claves, propiedad y visibilidad por rol), **A02/A05** (la clave privada no aparece en listados ni
  logs; el selector de propietario no filtra datos de más), **A03** (zod en el borde y validación de
  scopes), **A04/A09** (límite de 5 y rate limit existente), **A07** (revocación y caducidad siguen
  siendo instantáneas) y **A08** (allowlist cerrada, sin scopes nuevos por accidente).
- Informe en esta tarea con hallazgos, severidad y resolución. Críticos o altos sin resolver
  bloquean `finalizada`.

## Dependencias y notas

- Se apoya en la autorización de task-02 (guard), las claves de task-09 y la UI de claves ya en
  `main`; no cambia el formato del secreto ni la resolución de tokens.
- Sin `role_cap` en delegadas: el rol se lee de `profiles` en cada petición, así que una degradación
  o desactivación del dueño surte efecto en la petición siguiente. Una clave vieja con `role_cap`
  guardado no se migra; el guard no lo lee.
- Migración `0015` solo toca RLS; no reescribe `scopes` ni `role_cap` de las filas existentes.
- **Pregunta abierta (spec §8.1)**: `users:read` no expone email hoy (`UserView` no lo tiene). Se
  mantiene oculto también para el super_admin; si el usuario quiere verlo, es una línea más su test.
  La decisión sobre hacerlo visible para **no-super_admin** queda pendiente de aprobación.
- El panel carga las claves llamando a las rutas del Core en proceso
  (`apps/admin/src/lib/panel-keys.ts`), así que el gate de rol y el guard deben coincidir: el 403 de
  `/keys` no depende solo de `requirePanel`.
