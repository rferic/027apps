# Spec — Scopes de claves API y claves delegadas por propietario

**Fecha:** 2026-11-08 · **Estado:** Pendiente de aprobación del usuario
**Base:** [tokens §5](2026-10-25-token-model.md) · [core-api §3.6](2026-10-26-core-api.md) ·
[ADR 0004](../../adr/0004-bordes-y-capa-de-aplicacion.md) ·
[ADR 0007](../../adr/0007-manejo-de-errores.md)

## 1. Objetivo

Que una clave delegada sirva al dueño y a apps de terceros sin administrar la instancia, y que una
clave `service` administre sin datos personales ni dispositivos. Hoy ambas heredan el suelo del rol
de su `role_cap` y una delegada de un admin puede llevar `settings:*`, `invitations:*` o
`users:write`.

## 2. Estado actual (verificado)

- `packages/core/src/auth/guard.ts`: `USER_SCOPES` incluye `api_keys:read/write/revoke`;
  `ADMIN_SCOPES` lo hereda y añade el resto; `SUPER_ADMIN_SCOPES` añade `users:deactivate`; el set
  de service añade `maintenance:run`. `authorize` filtra los scopes de una credencial de máquina con
  `ROLE_CAP_FLOOR[roleCap]`, un único suelo por rol y no por tipo de clave.
- Una clave delegada usa `role_cap = null` (el check de `0009_api_keys_devices.sql` lo impone) y
  toma el rol **vivo** del perfil como cap (`packages/core/src/auth/caller.ts:73`), así que su suelo
  es el del dueño: admin → todo lo de admin, super_admin → incluso `maintenance:run`.
- `createApiKeySchema` (`packages/core/src/api-keys/api.ts`) no acepta `user_id`: toda delegada se
  atribuye al actor (`packages/core/src/api-keys/service.ts:153`).
- `api_keys` exige `service ⇔ role_cap` y `delegated ⇔ user_id`; no hay límite de claves activas.
- La política `api_keys_select` de `0009_api_keys_devices.sql` deja al rol admin leer las delegadas
  de todos.
- Panel: `/keys` y `/keys/new` piden `requirePanel("admin")`; el menú muestra «Claves» a cualquier
  panel role; el formulario no elige propietario y ofrece `ADMIN_SCOPES` completos a una delegada
  (`apps/admin/src/lib/api-key-scopes.ts`).

## 3. Política de scopes

Leyenda: ✓ permitido · ✗ denegado · «propias» solo sobre claves del mismo dueño.

| Scope | Delegada | Service cap admin | Service cap super | Sesión admin | Sesión super_admin | Sesión user |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| `profile:read` / `profile:write` | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ |
| `currencies:read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `currencies:write` | ✗ | ✓ | ✓ | ✗ | ✓ | ✗ |
| `devices:read` / `write` / `revoke` | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ |
| `modules:read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `<módulo>:read` / `<módulo>:read_write` | ✓ si el dueño tiene el módulo asignado | ✗ | ✗ | — | — | — |
| `modules:grant` / `modules:manage` | ✗ | ✓ | ✓ | ✓ | ✓ | ✗ |
| `api_keys:read` / `write` / `revoke` | ✓ (propias) | ✓ | ✓ | ✗ | ✓ | ✓ (propias) |
| `users:read` | ✓ (instancia completa, sin email) | ✓ | ✓ | ✓ | ✓ | ✗ |
| `users:write` | ✗ | ✓ | ✓ | ✓ | ✓ | ✗ |
| `users:deactivate` | ✗ | ✗ | ✓ | ✗ | ✓ | ✗ |
| `roles:assign` | ✗ | ✓ | ✓ | ✓ | ✓ | ✗ |
| `user_categories:read` | ✓ (instancia completa) | ✓ | ✓ | ✓ | ✓ | ✗ |
| `user_categories:write` | ✗ | ✓ | ✓ | ✓ | ✓ | ✗ |
| `invitations:read` / `write` | ✗ | ✓ | ✓ | ✓ | ✓ | ✗ |
| `settings:read` / `settings:write` | ✗ | ✓ | ✓ | ✓ | ✓ | ✗ |
| `maintenance:run` | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ |

Notas de interpretación (para aprobar junto con la política):

- El **cap** de una service key es radio de daño, no un rol: reduce `users:deactivate` y
  `maintenance:run`, pero no retira `api_keys:*` porque la clave solo la mintea un super_admin.
  `role_cap` sigue siendo obligatorio para `service`.
- El allowlist delegado es **independiente del cap**: que el dueño sea admin o super_admin no amplía
  lo que su clave puede llevar. El rol del dueño se lee en cada petición y puede **reducir** el
  allowlist si algún día el rol pierde un scope que hoy contiene; lo que nunca puede es ampliarlo.
  La degradación que siempre surte efecto inmediato es la **desactivación del perfil** (la clave deja
  de resolver, 401) y la pérdida de un **grant de módulo** (sus scopes de módulo dejan de valer).
- Las categorías **clasifican, no aíslan**: `users:read` y `user_categories:read` de una delegada
  ven toda la instancia. No hay filtrado por categoría del dueño.
- La sesión `user` no gana `users:read` ni `user_categories:read`; quien necesite leer el directorio
  desde el móvil usa su clave delegada. Ampliarlo a la sesión es una línea si se prefiere (§8).
- **`role_cap` en delegadas**: el runtime lo ignora por completo —el cap efectivo es el rol del
  perfil—. Hoy el check de `0009` impide que una fila delegada lo lleve; si un dump antiguo la
  trae, se ignora sin migración destructiva. Limpiarlo sería una migración cosmética
  (`update api_keys set role_cap = null where kind = 'delegated'`) que no hace falta porque el
  constraint ya lo garantiza; se documenta como no-op.

## 4. Reglas de autorización

1. **Sesión**: set fijo del rol; el guard no cambia de forma.
2. **Service**: `scopes ∩ servicio(cap)`. Nunca `profile:*` ni `devices:*`.
3. **Delegada**: `scopes ∩ delegado`, más el grant de módulo del dueño (`user_modules` vigente)
   para scopes de módulo; `modules:hasAccess` sigue siendo la última comprobación por petición.
4. **Scopes efectivos al validar**, no al crear: el guard calcula la intersección en cada petición.
   Un scope almacenado fuera del allowlist se ignora; si la acción lo exige, responde 403
   `insufficient_scope`. No se reescriben filas.
5. **No escalada**: quien crea una clave (sesión o clave propia) solo puede pedir scopes incluidos
   en sus scopes efectivos. Una delegada con `api_keys:write` no puede mintear una clave más amplia
   que ella misma. Un caller que pide scopes fuera del allowlist de su tipo recibe
   `validation_failed` al crear (el borde zod solo valida forma, no política).
6. Errores: 401 `unauthorized` sin sesión/token; 403 `insufficient_scope` sin enumerar recursos
   (ADR 0007). Nunca se dice qué scope falta.

## 5. Propiedad y gestión

| Quién | Delegadas | Service |
|---|---|---|
| Sesión `user` | crea, lista y revoca **las suyas** vía API y app (scopes recortados a su rol) | ✗ |
| Sesión `admin` | ninguna: **no gestiona claves** (pierde `api_keys:*`; 403 en `/keys` y en la API, ítem oculto) | ✗ |
| Clave delegada con `api_keys:*` | solo las del dueño, y sin superar sus propios scopes | ✗ |
| Sesión `super_admin` | todas; crea para cualquier usuario activo con `user_id` (selector de propietario) | todas; crea con `role_cap` |
| Clave `service` cap super_admin | revoca cualquier clave por id | revoca las suyas por id; no lista |

- `POST /api/v1/api-keys` gana `user_id` (uuid, opcional). Solo una **sesión super_admin** puede
  enviarlo; para cualquier otro caller → 403. Propietario inexistente o desactivado → 404
  `not_found`. `role_cap` sigue prohibido en delegadas (el check de BD lo impone).
- Listar, detallar y revocar ya están acotados al dueño salvo super_admin. **Una clave delegada
  nunca es super_admin a efectos de propiedad**, aunque su dueño lo sea: ve solo las del dueño.
  Hoy `isSuperAdmin` mira el `roleCap` (el rol vivo del dueño) y le abre todas las claves; se
  corrige para que solo una sesión super_admin o una service key con ese cap vean el global.
- El listado de claves sigue siendo una acción de panel: `listApiKeys` rechaza a un caller `service`
  incluso con `api_keys:read`, porque no es dueño de nada (§10).
- **Panel**: solo super_admin. `/keys` y `/keys/new` → `requirePanel("super_admin")` (403 genérico
  para admin); el ítem «Claves» desaparece para admin; el formulario añade selector de propietario
  (usuarios activos, vía `GET /api/v1/users?state=active`).

## 6. Límite de 5 claves activas

- Por **usuario propietario** y solo para delegadas. Activa = `revoked_at is null` y
  (`expires_at is null` o futura).
- La sexta → 409 `conflict`; el panel deshabilita «Crear» y explica el límite.
- Se valida dentro de una transacción con lock por propietario
  (`pg_advisory_xact_lock(hashtext('api_keys:<uuid>'))`) para que dos creaciones concurrentes no lo
  superen. Las service keys no cuentan (no tienen dueño).
- Revocar una clave libera un hueco de inmediato; caducar también (el conteo filtra por
  `expires_at > now()`, así que no hace falta limpiar nada).

## 7. Claves existentes (migración)

**Decisión: recortar al validar, no al leer ni por backfill.**

- No se reescriben `scopes` en BD: el valor almacenado queda como pista de auditoría de lo que se
  pidió. La UI lo sigue etiquetando «Requested scopes» y no promete un efectivo que el guard pudiera
  contradecir.
- El guard aplica el allowlist en cada petición, así que una clave vieja con `settings:write`,
  `users:write`, `profile:read` (service) o `devices:*` (service) deja de poder usarlos de
  inmediato, sin esperar a una migración de datos.
- Crear y mintear sí rechazan scopes ilegales: el problema no se reproduce.
- `role_cap` de una delegada existente se ignora en runtime (§3); no se migra.
- Migración aparte: `0015_api_keys_owner_policy.sql` recrea `api_keys_select` sin la rama
  `core_is_admin()`, para que la RLS no contradiga al guard en accesos directos del móvil.

Consecuencia aceptada: una integración antigua puede empezar a recibir 403 tras el despliegue. Se
anota en el PR y la respuesta de error no dice qué scope falta (solo `insufficient_scope`).

## 8. Preguntas abiertas

1. **Email en `users:read` para no-super_admin**: la propuesta lo **excluye** (también para una
   delegada). Hoy `UserView` (`packages/core/src/users/service.ts:109`) no expone email en absoluto,
   así que la exclusión se cumple por ausencia y no hay que tocar nada. Si el usuario prefiere que
   `users:read` lo incluya para algún rol, es una línea en `toView`/consulta más su test; el resto
   seguiría oculto. **Decisión pendiente.**
2. **Sesión `user` y directorio**: se mantiene sin `users:read`/`user_categories:read`; la lectura
   de miembros desde el móvil se hace con la clave delegada del propio usuario. Ampliarlo a la
   sesión es una línea si se prefiere.

## 9. Criterios de aceptación

1. Una sesión admin recibe 403 en `GET/POST/DELETE /api/v1/api-keys` y en `/keys`; el ítem del menú
   no se renderiza para admin; una sesión `user` sigue gestionando las suyas y una super_admin todas.
2. Una sesión super_admin conserva `api_keys:*` y ve todas las claves.
3. Una clave delegada con `settings:write`, `currencies:write`, `users:write`, `users:deactivate`,
   `roles:assign`, `user_categories:write`, `invitations:write`, `modules:grant`, `modules:manage`
   o `maintenance:run` recibe 403 al intentar la acción.
4. Una clave delegada con `users:read` lista y detalla cualquier perfil de la instancia; la
   respuesta no incluye email.
5. Una clave delegada con `devices:*`, `profile:*`, `currencies:read`, `modules:read` y sus scopes
   de módulo asignados funciona igual que hoy; un módulo no asignado no es accesible.
6. Una clave `service` con `profile:read` o `devices:read` recibe 403; con `api_keys:read` funciona
   en ambos caps; con cap admin no puede `maintenance:run` ni `users:deactivate`.
7. Un super_admin crea una delegada para otro usuario con `user_id` y aparece como propietario en
   `GET` y en el panel; sin `user_id` se atribuye al actor.
8. Un caller que no es sesión super_admin que envía `user_id` recibe 403; una clave delegada no
   puede pedir scopes que ella no tenga; la delegada de un super_admin lista, detalla y revoca solo
   las claves de su dueño, nunca las de otros.
9. La sexta delegada activa de un usuario devuelve 409; tras revocar una, la creación vuelve a
   funcionar; una revocada o caducada no cuenta.
10. Las filas existentes con scopes ilegales no se modifican en BD y sus acciones quedan en 403
    (test de guard con scopes almacenados).
11. La RLS: un admin autenticado ya no lee delegadas ajenas; el dueño y super_admin sí.
12. `pnpm lint`, `pnpm tsc`, `pnpm test`, `pnpm --filter admin build` e `i18n:check` en verde.

## 10. Fuera de alcance

- Runtime de módulos y empaquetado de sus scopes (solo se validan y se comprueba el grant).
- Cliente Android: consume el contrato (`user_id` opcional, 409 del límite) en una tarea posterior;
  esta spec no toca `apps/android`.
- Listado de claves por una service key (sigue siendo acción de panel con dueño).
- Rotación de secretos, `expires_at` por defecto y uso agregado (`audit:read`).
