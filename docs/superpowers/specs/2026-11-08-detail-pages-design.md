# Spec — Fichas de detalle de invitaciones y módulos

**Fecha:** 2026-11-08 · **Estado:** Pendiente de aprobación del usuario
**Tarea:** [task-14](../../tasks/sprint-06-web/task-14.md) · **Plan:**
[2026-11-08-detail-pages](2026-11-08-detail-pages.md) · **Base:**
[API del Core](2026-10-26-core-api.md) · [revisión UX](2026-11-06-web-admin-ux-review.md) ·
[ADR 0004](../../adr/0004-bordes-y-capa-de-aplicacion.md) ·
[ADR 0005](../../adr/0005-estado-y-fetching-del-admin.md) ·
[ADR 0007](../../adr/0007-manejo-de-errores.md) ·
[ADR 0008](../../adr/0008-fechas-y-moneda.md)

**Problema:** `/invitations` y `/modules` son las dos últimas listas del panel sin ficha de detalle. Por
eso sus acciones siguen en la fila (contra el patrón de la §6 de la revisión UX) y los datos que una
ficha necesitaría no están en el contrato: no hay detalle de invitación ni forma de saber quién tiene un
módulo.

## §1 Contrato de `GET /api/v1/modules/{key}/grants`

- **Scope:** `modules:manage`. Las claves delegadas de los miembros tienen `modules:read`
  (`packages/core/src/auth/guard.ts`, `DELEGATED_SCOPES`), así que `modules:read` filtraría a cualquier
  miembro quién tiene qué módulo. `modules:manage` lo tienen la sesión `admin`/`super_admin` y la service
  key con ese cap.
- **Respuesta:**

```json
{
  "users": [{ "id": "uuid", "display_name": "Sara" }],
  "categories": [{ "id": "uuid", "name": "Familia" }]
}
```

- `users`: `public.user_modules` con `revoked_at is null` para ese `module_key`, con join a
  `public.profiles` solo para `display_name`. No se filtra por `deactivated_at`: el grant sigue en la
  tabla y el acceso efectivo ya lo corta la sesión (un perfil desactivado no tiene sesión de panel);
  ocultarlo daría un recuento que no cuadra con el `409` de `uninstallModule`, que cuenta exactamente
  esas filas.
- `categories`: `public.user_category_modules` para ese `module_key`, con join a
  `public.user_categories`. No hay `revoked_at`: quitar la asignación borra la fila.
- **Orden:** `display_name asc, id asc` y `name asc, id asc`. Estable y sin depender de la colación del
  cliente.
- **Una sola consulta:** dos subconsultas `json_agg(json_build_object(...))` + `coalesce(…, '[]')` sobre
  la misma sentencia. Nada de cargar usuarios y luego consultar su acceso (N+1).
- **Errores:** `404 not_found` si el módulo no existe (se comprueba antes con `getModuleRow`), `400
  validation_failed` si la key no cumple `^[a-z0-9][a-z0-9_-]{0,63}$`, `403 insufficient_scope` sin el
  scope.
- **Arrays vacíos, nunca `null`:** el `coalesce` es parte del contrato; la UI distingue «sin concesiones»
  de «no se pudo leer» por el envelope de error, no por un `null` ambiguo.

## §2 Contenido de `/invitations/{id}`

| Bloque | Origen |
|---|---|
| Breadcrumb `Invitations / <email>`, `h1` | `email` |
| Badge de estado `pending \| used \| expired \| revoked` | derivado del Core (`status`) |
| Email, nombre, caduca, creada | `email`, `name`, `expires_at`, `created_at` |
| Categoría | `user_category_id` + el nombre de `GET /user-categories`; enlace a `/categories/{id}` si existe, `—` si no |
| Módulos | `modules[]` resueltos a nombre legible con `GET /modules`; la clave si no hay nombre |
| Usada / revocada | `used_at` / `revoked_at`, solo cuando aplican |
| Quién la creó | `created_by` (nuevo) → `display_name`; `null` → «Instance» |
| Acción **Revocar** | solo `status === "pending"`, con confirmación y retorno a `/invitations` |

No se muestra el token: `public.invitations` solo guarda `token_hash` y el token en claro se devuelve una
única vez en `POST /invitations` (ver §4). La página no puede, ni debe, reconstruirlo.

Guard: `requirePanel("admin")`, `instant = false`, `notFound()` real para un id inexistente (no una
tarjeta de error) y `PanelForbidden` cuando el rol no alcanza.

## §3 Contenido de `/modules/{key}`

| Bloque | Origen |
|---|---|
| Breadcrumb `Modules / <name>`, `h1` | `name` |
| Badges de estado y de `is_public` | `state`, `is_public` |
| Clave, nombre, versión, instalada | `key`, `name`, `version`, `installed_at` |
| `manifest_digest` | `manifest_digest` (aditivo a `ModuleView`) |
| `mcp_exposed` | `mcp_exposed` |
| Ajustes (solo lectura) | `GET /modules/{key}/settings`; los `is_secret` como «configured», nunca el valor |
| Concesiones | `GET /modules/{key}/grants` (§1), chips de usuarios y categorías |
| Activar / Desactivar | `POST /modules/{key}/activate\|deactivate` |
| Desinstalar | `POST /modules/{key}/uninstall`, solo `super_admin`, con confirmación y el `409` de concesiones activas |

Guard: `requirePanel("admin")`, `instant = false`, `notFound()` real. La ficha no ofrece `is_public` ni
`mcp_exposed` como controles: cambiarlos es `PATCH /modules/{key}` y queda fuera del alcance de esta
tarea (se muestran como dato).

**Pregunta abierta:** «Ir a los ajustes del módulo» apunta hoy a una página de edición que no existe. La
propuesta es dejar los ajustes en **solo lectura** en la propia ficha y no enlazar a una ruta vacía; si se
quiere edición, necesita su tarea (formulario por setting, validación por tipo en el borde y auditoría de
secretos). Decisión del usuario.

## §4 Política del enlace de canje

El token se genera con `randomBytes(32)`, se devuelve **una vez** en `POST /api/v1/invitations` y se
persiste solo como SHA-256 (`hashInvitationToken`). Reconstruirlo desde el hash no es posible, así que
enseñar el enlace en la ficha exige cambiar el modelo. Tres opciones:

1. **Guardar el token en claro** (o cifrado reversible) en `invitations`. Es un secreto de larga vida
   en la misma base de datos: rompe la propiedad de que el token solo vive en el cliente del invitado y
   amplía el daño de cualquier lectura de la tabla. **Descartada.**
2. **Reemitir** un token nuevo bajo demanda (`POST /invitations/{id}/token`), invalidando el anterior.
   Es un cambio de modelo y de contrato (nueva operación, nueva regla de auditoría) y convertiría la
   ficha en un botón de «regenerar enlace»; útil, pero es una tarea propia.
3. **No mostrarlo.** El enlace se copia al crear la invitación; si se perdió, se revoca y se crea otra
   (el `409 pending_invitation` de la iteración 17 ya impide duplicados pendientes y hay que revocar
   primero).

**Recomendación: opción 3**, con el texto de la ficha explicando dónde se vio el enlace y qué hacer si se
perdió. La decisión final es del usuario.

## §5 Deltas al contrato del Core

- **Nuevo** `GET /api/v1/modules/{key}/grants` (`modules:manage`) — §1.
- **Nuevo** `GET /api/v1/invitations/{id}` (`invitations:read`) — devuelve `InvitationView` +
  `created_by: { id, display_name } | null`; nunca token ni `token_hash`.
- **Aditivo** `ModuleView.manifest_digest: string`. La columna ya existe en `public.module_registry`
  (`installModule` la escribe con `manifestDigest`), pero `MODULE_COLUMNS` no la selecciona; deja de
  estar oculta.
- **Sin cambios** en el modelo de datos, en los scopes existentes ni en las operaciones de invitaciones y
  módulos ya publicadas.
- `docs/superpowers/specs/2026-10-26-core-api.md` §3.4/§3.5 recoge los tres puntos y
  `docs/api/openapi.json` se regenera con `pnpm check:openapi` en el mismo PR.
