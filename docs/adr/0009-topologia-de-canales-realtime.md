# ADR 0009 — Topología de canales realtime (sustituye la topología del ADR 0006)

**Fecha:** 2026-10-26
**Estado:** Aceptada
**Decisora:** usuario (rferic), en conversación de diseño
**Sustituye:** [ADR 0006](0006-realtime.md) **§1 (último inciso) y §4 (topología de topics)**, y el §6 en lo relativo a que el panel no se suscribe. El resto del ADR 0006 (Broadcast, publicación desde la API tras el commit, RLS sobre `realtime.messages`, `JWT_EXPIRY = 900 s`, claves `sb_secret_*`, límites del Free) **sigue vigente**.
**Base:** [spec de auth §7](../superpowers/specs/2026-10-25-auth.md) (Supabase = identidad + transporte) · [spec de API v1 §3.9](../superpowers/specs/2026-10-25-api-v1.md) (envelope de eventos) · [spec de datos del Core](../superpowers/specs/2026-10-26-core-data-model.md) (reframe: el Core no modela grupos) · [spec de realtime del Core](../superpowers/specs/2026-10-26-realtime-notificaciones.md)

## Contexto

El ADR 0006 fijó una topología **por grupo**: *"siempre por grupo (`group-<id>`)… **jamás se emite a 'todos'**"*. Se escribió cuando el Core modelaba "grupos" con membresía.

El **reframe del Core (2026-10-26)** eliminó esa entidad: el Core ya no tiene grupos; los grupos son **tablas propias de cada módulo** (p. ej. los grupos de gastos de Split Expenses). Por tanto:

1. Un topic `group-<id>` **no tiene a qué apuntar** en el Core.
2. Los eventos tienen **destinatarios distintos según su naturaleza**: unos interesan a los admins, otros a una persona concreta, otros a los miembros de una entidad de un módulo.
3. La RLS de `realtime.messages` no puede depender de una membresía que el Core desconoce.

## Decisión

Se sustituye la topología por un **sistema de canales con destinatario explícito**:

### 1. Canales fijos del Core

| Canal | Topic | RLS |
|---|---|---|
| `admins` | `admins` | `is_admin()` — consumido por el **panel web** y por admins en el móvil |
| `all` | `all` | cualquier `profiles` autenticado |
| `user` | `user-<uuid>` | `auth.uid() = <uuid>` |

Los tres son privados (`private: true`). **`all` existe pero es la excepción**: se emite solo con política explícita y **nunca** desde un módulo sin declararlo (ver §3).

### 2. Canales de módulo (los declara el módulo)

El manifest declara `channels: [{ pattern, members_fn }]`. El Core los **persiste** en `module_channels` y una **única política RLS** en `realtime.messages` los resuelve (ver §4). Un módulo puede no declarar canales y enrutar todo por `user`.

### 3. `publish()` valida el destinatario

La publicación servidor→canal usa credenciales de servidor (`sb_secret_*`), que **se saltan la RLS**. Por tanto el único gate es `publish()`, que **rechaza**:

- un `target` fuera de la lista cerrada (`admins` | `all` | `user` | canal declarado **por el emisor**);
- un topic que no case con el patrón declarado;
- publicar en `admins`/`all` desde un módulo que no lo declara expresamente en su manifest;
- publicar desde un módulo que no está `active`.

### 4. Una sola política, no una por topic

**Corrección crítica**: las políticas **permisivas** de Postgres se combinan con **OR**. Escribir una política por canal (p. ej. "`all` → `auth.uid() IS NOT NULL`") **autorizaría todos los topics**, porque ninguna compara `realtime.topic()`. Por eso:

- **Una única política** `SELECT` sobre `realtime.messages` que exige `core_can_subscribe(realtime.topic())`.
- `core_can_subscribe(text)` es **security definer**, `STABLE`, `SET search_path = ''`, con `EXECUTE` revocado de `PUBLIC`, y despacha por topic:

| Topic | Condición |
|---|---|
| `admins` | `core_is_admin()` |
| `all` | `auth.uid() IS NOT NULL` |
| `user-<uuid>` | `auth.uid()::text = substring(topic from 6)` |
| resto | existe `module_channels` cuyo `pattern` (con `{id}` = uuid) casa con el topic **y** el módulo está `active` **y** `auth.uid() = ANY(members_fn(topic))` |

- La política la crea **el Core** (rol `postgres`), no los módulos: el instalador solo inserta/borra filas en `module_channels`. Esto evita que un DDL de módulo toque `realtime.*` (coherente con la restricción "permisos mínimos" de la spec de módulos, decisión C).
- **Fallo cerrado**: si `members_fn` lanza o tarda, la suscripción se **deniega** y se loguea con `request_id`.
- **`members_fn` endurecida** (contrato del módulo): `SECURITY DEFINER`, `SET search_path = ''`, `STABLE`, `REVOKE EXECUTE FROM PUBLIC`, nombre validado por `^[a-z][a-z0-9_]{0,62}$` al instalar.

### 5. El panel web sí se suscribe

Se revisa **ADR 0006 §6**: el panel **sí** se suscribe al canal `admins` (para ver en vivo invitaciones, altas, cambios de módulos y configuración). La revalidación del ADR 0005 **sigue siendo el mecanismo de lectura** (dato inicial + caché); realtime es solo una **señal de invalidación inmediata** adicional, no una segunda fuente de datos.

## Alternativas consideradas

- **Mantener topic por grupo**: imposible tras el reframe (el Core no tiene grupos).
- **Topology por módulo solamente** (`module-<key>`): no permite dirigir un evento a **una persona** ni aislar por entidad; obliga a cada módulo a filtrar en cliente, y no permite avisos personales limpios.
- **Un topic por usuario para todo**: obliga a publicar N veces (uno por destinatario) y no modela entidades compartidas (un grupo de gastos con 4 miembros).
- **Una política por canal**: **descartada por la fuga de aislamiento** descrita en §4 (combinación OR de políticas permisivas).

## Consecuencias

- **Delta a api-v1 §3.9** (registrada en la spec de realtime): el envelope interno del servidor es `{ type, target, resource, payload }`; **`target` no viaja al cliente** (es metadato de enrutado). El contrato del wire sigue siendo `{ type, resource, payload }`.
- **Delta al modelo de datos** (task-01): nuevas tablas `module_channels` y `event_outbox`; `devices.push_token` **UNIQUE**.
- **Entrega at-least-once**: la publicación usa **outbox transaccional** (la fila del evento se inserta en la transacción del caso de uso; el envío ocurre después del commit y se reintenta). Los consumidores (incluidos los `hooks` de módulos) son **idempotentes** por `event_id`.
- El **admin web** pasa a consumir `admins`; el móvil de un admin también.
- ADR 0006 queda **parcialmente sustituido**; su cabecera enlaza a este ADR.