# Spec — Core: realtime y notificaciones (sprint 04, task 04)

**Fecha:** 2026-10-26
**Estado:** Borrador para aprobación del usuario
**Base:** [ADR 0006](../../adr/0006-realtime.md) (Supabase Realtime Broadcast, publicación desde la API tras el commit, aislamiento por RLS) · [spec de auth §7](2026-10-25-auth.md) (frontera Supabase, `JWT_EXPIRY = 900 s`) · [spec de API v1 §3.9](2026-10-25-api-v1.md) (envelope `{ type, resource, payload }`, payloads por módulo) · [spec de datos](2026-10-26-core-data-model.md) (task-01: `devices`, `settings`, `module_registry`) · [spec de API](2026-10-26-core-api.md) (task-02: `/devices`, `user.deactivated`) · [spec de módulos](2026-10-26-modulo-system.md) (task-03: manifest, `eventos`, `hooks`) · [ADR 0004](../../adr/0004-bordes-y-capa-de-aplicacion.md) (efectos externos tras el commit, representación compartida) · [ADR 0007](../../adr/0007-manejo-de-errores.md) (ni datos internos en respuestas ni en logs)
**Decide el usuario:** arquitectura de canales, catálogo de eventos, FCM opcional, sin email de negocio en v1 (2026-10-26)

## 1. Objetivo

Definir **cómo se publican y entregan los eventos de dominio** (realtime) y **cómo se notifican** (push), partiendo de la decisión del usuario: **el realtime tiene destinatarios explícitos** — eventos **para admins**, eventos **para todos**, eventos **para un usuario concreto** y eventos **cuyo canal lo decide el módulo** (por el canal del usuario o por un canal propio de una entidad suya, p. ej. un grupo de gastos).

**Límite de alcance:** esta spec fija el contrato de canales, el envelope, el catálogo de eventos **del Core** y el mecanismo de push. Los **eventos de negocio de cada módulo** (su nombre, su `target` y su payload) los declara la spec del módulo en su manifest (task-03); aquí se define **cómo** se enrutan, no qué eventos de negocio existen.

## 2. Canales y destinatarios

### 2.1 Canales fijos del Core

| Canal | Topic | Quién puede unirse (RLS) | Uso |
|---|---|---|---|
| **`admins`** | `admins` | `is_admin()` (task-01 §5) | eventos de administración de la instancia |
| **`all`** | `all` | cualquier `profiles` autenticado | avisos generales de instancia |
| **`user`** | `user-<uuid>` | `auth.uid() = <uuid>` | eventos dirigidos a una persona |

Los tres son **privados** (`private: true`): el cliente se suscribe con su sesión de Supabase y Supabase evalúa la política RLS antes de dejarle entrar.

### 2.2 Canales de módulo (el módulo decide)

El manifest del módulo (task-03 §3) declara sus canales:

```jsonc
"channels": [
  {
    "pattern": "group-{id}",                    // topic del módulo: "group-<uuid>"
    "members_fn": "split_expenses_channel_members"  // función SQL del módulo
  }
]
```

- `members_fn(topic text) returns setof uuid` — **función security definer** que el módulo aporta en sus migraciones y devuelve **quién puede recibir/escuchar** ese topic.
- **Un solo contrato para dos usos**: la política RLS de `realtime.messages` la usa para decidir si `auth.uid()` puede unirse, y el Core la usa para resolver **destinatarios de push**. Una única fuente de verdad, sin duplicar criterios.
- La función se registra al instalar el módulo y se elimina al desinstalarlo (task-03). Si el módulo se desinstala, sus canales dejan de existir.
- Un módulo puede **no declarar canales propios** y enrutar todo por `user` (decisión suya).

### 2.3 `target` de un evento

Cada evento declara su destinatario:

| `target` | Se publica en | Destinatarios de push |
|---|---|---|
| `admins` | `admins` | todos los `is_admin()` |
| `all` | `all` | todos los `profiles` |
| `user` | `user-<uuid>` del sujeto del evento | ese usuario |
| `channel:<pattern>` (con `{id}` resuelto) | topic del módulo (p. ej. `group-<uuid>`) | resultado de `members_fn(topic)` |

## 3. Envelope del evento

Contrato de api-v1 §3.9, sin cambios:

```json
{
  "type": "expense.created",        // snake_case del evento de dominio
  "target": "channel:group-3f2a…",  // canal (no viaja como dato de negocio al cliente; lo usa el servidor para enrutar)
  "resource": { … },                // representación compartida del recurso (ADR 0004 §7)
  "payload": { … }                  // datos adicionales NO sensibles
}
```

- **`resource`** = la **misma representación** que devuelve el endpoint REST de ese recurso (una sola forma para REST, MCP y eventos).
- **`payload`** = solo datos no sensibles y no duplicados de `resource`.
- **Nunca** secrets, tokens, contraseñas ni datos internos (ADR 0007 §5).

## 4. Catálogo de eventos del Core (v1)

| Evento | `target` | `notify` | Cuándo |
|---|---|---|---|
| `user.deactivated` | `user` (el afectado) | — | al desactivar un usuario (task-02 §3.2); los módulos reaccionan por `hooks` (task-03) |
| `module.installed` | `admins` | — | tras commit del install (task-03 §4.1) |
| `module.activated` | `admins` | — | tras commit del activate |
| `module.deactivated` | `admins` | — | tras commit del deactivate |
| `module.uninstalled` | `admins` | — | tras commit del uninstall (task-03 §4.3) |
| `invitation.created` | `admins` | — | al crear una invitación (panel en vivo) |
| `invitation.redeemed` | `admins` | — | al canjearla (se ve el nuevo miembro sin recargar) |
| `settings.updated` | `admins` | — | al cambiar settings de instancia |

**Regla**: los eventos de **negocio** (p. ej. `expense.created`, `balance.updated`) los declara **cada módulo** en su manifest con su `target` y su `notify`; el Core no los conoce.

## 5. Publicación (servidor → Realtime)

- **Desde la API, tras el commit** (ADR 0004 §6): el caso de uso orquestador publica **después** de confirmar la transacción. Si la publicación falla, **no se revierte el dato**: se loguea con el `request_id` y queda para reintento (ADR 0007 §7). Nunca dentro de la transacción.
- **API única de publicación**: `publish(events: DomainEvent[])` en el paquete compartido del Core, usada por las puertas (casos de uso orquestadores). Una puerta no publica por su cuenta.
- **Mecanismo**: Supabase Realtime **Broadcast** sobre canales **privados** (`private: true`). **Se valida contra la documentación vigente** antes de implementar: Supabase **depreca `service_role`/`anon` a favor de `sb_secret_*`** (fin de 2026) — el plan aterriza en las claves nuevas (ADR 0006 §3). La publicación servidor→canal usa credenciales de servidor de confianza, nunca claves en cliente.
- **Sin `postgres_changes`**: el payload es un recurso con representación compartida, no una fila cruda (ADR 0006 §1).
- **`JWT_EXPIRY = 900 s`**: requisito de instalación (lo fija el wizard de `/setup`, task-06), **no** un setting editable en el panel — es un parámetro de seguridad que acota el lag de revocación de conexiones abiertas (auth §4, ADR 0006 §5). Se guarda en `settings` como valor de configuración y se documenta el trade-off.

### 5.1 RLS sobre `realtime.messages`

Una política por topic, evaluada en la suscripción:

| Topic | Condición |
|---|---|
| `admins` | `is_admin()` |
| `all` | `auth.uid() IS NOT NULL` (perfil existente) |
| `user-<uuid>` | `auth.uid() = <uuid>` |
| topic de módulo (`pattern`) | `auth.uid() = ANY(members_fn(topic))` de ese módulo |

- **Nunca** se emite a "todos" sin política; un topic sin política → suscripción rechazada.
- Las políticas de realtime viven **junto a** las RLS de datos (mismo PR, mismo patrón, task-10).
- Conexión abierta: la autorización se cachea durante la conexión; con `JWT_EXPIRY = 900 s` la revocación es efectiva en ≤15 min (revocación de **datos** sigue siendo instantánea en cada petición, task-01 §5).

## 6. Notificaciones push (FCM, opcional por instancia)

### 6.1 Registro del dispositivo

- La app registra su token de push en `devices` (task-01 §3.6: `platform`, `push_token`, `last_seen_at`).
- **Delta a task-02**: se añade `POST /api/v1/devices` (el propietario registra/actualiza su `push_token` y `platform`; idempotente por `(user_id, platform)`), necesario para que el móvil se suscriba a push. `GET`/`DELETE` ya estaban definidos.

### 6.2 Configuración por instancia (puerta de setup del usuario)

- **FCM es opcional**; si no está configurado, **degradación elegante**: no se envía push (realtime y bandeja al abrir siguen funcionando).
- **Un APK único para todas las instancias**: la configuración de Firebase **no se hornea** en el build (ataría el APK a un proyecto). La app inicializa Firebase **en runtime** con los valores públicos de la instancia.
- Settings (`settings`, categoría `notifications`, task-06):
  - **públicos** (`is_public: true`, los lee el móvil vía `/instance` o `/modules`-style): `fcm_project_id`, `fcm_app_id`, `fcm_api_key`, `fcm_sender_id`.
  - **secreto** (`is_secret: true`, `value_encrypted`): el **service account JSON** de envío.
- El paso "conectar Firebase" se documenta en la guía de instalación como paso opcional (junto a Supabase y SMTP).

### 6.3 Envío

- Cuando un evento declara `notify: ["push"]` (campo opcional del manifest, task-03), el Core resuelve los **destinatarios** (tabla §2.3), obtiene sus `devices` con `push_token` y envía vía **FCM HTTP v1** con el service account de la instancia.
- **El texto del push nunca lleva datos sensibles**: solo una pista genérica ("Nuevo gasto en Familia"). El detalle se pide a la API con la sesión del usuario al abrir la notificación. Evita filtrar negocio por la infraestructura de Google.
- **Fallo de push**: se loguea y se reintenta/descarta; **no revierte ni bloquea** la operación (efecto externo, ADR 0007 §7).
- **Tokens inválidos** (FCM responde `UNREGISTERED`): se marca el `device` como revocado (`revoked_at`, task-01 §3.6) y se deja de enviar a él.
- **Sin push a la web**: el admin no se suscribe ni recibe push (ADR 0005).
- **Sin email de notificación en v1** (decisión del usuario): los emails de auth los manda Supabase Auth (auth §5bis); el email propio de negocio queda reservado en `settings`.

## 7. Contratos testables (testing-strategy §5)

- **RLS de `realtime.messages`**: un usuario que no pertenece al canal no puede unirse (caso explícito: un miembro de un grupo de gastos no recibe los eventos de otro grupo, vía `members_fn`).
- **Publicación tras el commit**: el evento se publica **después** de confirmar; si el efecto falla, el dato persiste y el fallo se loguea (no hay rollback del dato).
- **Representación compartida**: el `resource` del evento coincide con la respuesta REST del mismo recurso.
- **Push**: un evento con `notify: ["push"]` envía a los dispositivos de los destinatarios del canal; sin push configurado, la operación **no falla** (degradación).
- **`JWT_EXPIRY = 900 s`**: configuración de instalación verificada por el wizard (no editable en el panel).

## 8. Decisiones tomadas (conversación de diseño, 2026-10-26)

| # | Decisión |
|---|---|
| A | **Canales con destinatario explícito**: 3 fijos del Core (`admins`, `all`, `user-<uuid>`) + canales de módulo declarados en el manifest con `members_fn` (una función para RLS **y** para resolver destinatarios de push) |
| B | **El módulo decide su canal**: puede enrutar por `user`, por `admins`/`all` del Core, o por un canal propio por entidad (`group-{id}`…). El Core no conoce los modelos de los módulos |
| C | **Catálogo de eventos del Core v1**: `user.deactivated`, `module.*`, `invitation.created|redeemed`, `settings.updated`. Los de negocio los declara cada módulo |
| D | **Push = FCM, opcional por instancia**, configurado **en runtime** desde settings (valores públicos + service account cifrado), porque el APK es único. Sin configurar → degradación elegante |
| E | **El texto del push no lleva datos sensibles**; el detalle se consulta a la API con la sesión |
| F | **Sin email de notificación de negocio en v1** (solo auth por Supabase SMTP) |
| G | **`JWT_EXPIRY = 900 s`** como requisito de instalación (wizard), no editable en el panel |
| H | Publicación **desde la API tras el commit** con `publish()`, mecanismo Supabase Broadcast privado validado contra doc vigente (`sb_secret_*`) |

## 9. Fuera de alcance

- **Eventos de negocio de cada módulo** (nombres, `target`, payload) → manifest y spec de cada módulo.
- **Contrato de `members_fn` concreto de Split Expenses** (su pertenencia a grupos de gastos) → spec del módulo.
- **Configuración concreta de Firebase y del wizard** (catálogo de settings, pasos) → task-06.
- **Publicación de eventos de módulos** (implementación del `publish` y del SDK) → sprint de implementación del Core.
- **Presence / chat / typing** → fuera de alcance (ADR 0006 §48).
- **Email propio de negocio** (invitaciones por email, avisos) → futuro (auth §5bis reserva el sitio).

## 10. Criterios de aceptación

- Los canales (`admins`, `all`, `user-<uuid>`, módulo) están definidos con su política RLS y su resolución de destinatarios; **un suscriptor sin permiso no puede unirse**.
- Cada evento declara su `target` y el envelope es `{ type, target, resource, payload }` con la representación compartida.
- El catálogo de eventos del Core está cerrado y los módulos declaran los suyos en el manifest.
- La publicación ocurre **tras el commit** por una única `publish()`; un fallo no revierte el dato.
- Push FCM es opcional, configurado en runtime, sin datos sensibles en el texto, con degradación elegante y limpieza de tokens inválidos.
- `JWT_EXPIRY = 900 s` queda como requisito de instalación.
- Coherente con ADR 0006, ADR 0004/0007, spec de auth §7, api-v1 §3.9, task-01/02/03.
- Aprobada por el usuario y revisada por segundo agente (DoD de Docs).

## 11. Referencias

- ADR: `docs/adr/0006-realtime.md`, `0004-bordes-y-capa-de-aplicacion.md`, `0007-manejo-de-errores.md`
- Spec de auth: `docs/superpowers/specs/2026-10-25-auth.md` §4/§5bis/§7
- Spec de API v1: `docs/superpowers/specs/2026-10-25-api-v1.md` §3.9 (eventos) y §4
- Spec de datos: `docs/superpowers/specs/2026-10-26-core-data-model.md` (task-01: `devices`, `settings`)
- Spec de API del Core: `docs/superpowers/specs/2026-10-26-core-api.md` (task-02: `/devices`, `user.deactivated`)
- Spec de módulos: `docs/superpowers/specs/2026-10-26-modulo-system.md` (task-03: manifest, `eventos`, `hooks`)
- Testing: `docs/conventions/testing-strategy.md` §5 (ADR 0006 testable)
- Plan del sprint: `docs/superpowers/plans/2026-10-26-sprint-core-design.md`
- Task: `docs/tasks/sprint-core-design/task-04.md`