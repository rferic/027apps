# Spec — Core: realtime y notificaciones (sprint 04, task 04)

**Fecha:** 2026-10-26
**Estado:** Borrador para aprobación del usuario
**Base:** [ADR 0009](../../adr/0009-topologia-de-canales-realtime.md) (topología de canales; **sustituye la topología del [ADR 0006](../../adr/0006-realtime.md)**) · [spec de auth §4/§7](2026-10-25-auth.md) (frontera Supabase, `JWT_EXPIRY = 900 s`) · [spec de API v1 §3.9](2026-10-25-api-v1.md) (envelope de eventos; **delta 2026-10-26**) · [spec de datos](2026-10-26-core-data-model.md) (task-01: `devices`, `module_channels`, `event_outbox`, `settings`) · [spec de API del Core](2026-10-26-core-api.md) (task-02) · [spec de módulos](2026-10-26-modulo-system.md) (task-03: manifest `channels`/`eventos`/`hooks`) · [ADR 0004](../../adr/0004-bordes-y-capa-de-aplicacion.md) (efectos externos tras el commit) · [ADR 0007](../../adr/0007-manejo-de-errores.md) (ni internos en respuestas ni en logs)
**Decide el usuario:** canales con destinatario explícito, catálogo de eventos, FCM opcional-no-silencioso, outbox (at-least-once), sin email de negocio (2026-10-26)

## 1. Objetivo

Definir **cómo se publican y entregan los eventos de dominio** (realtime) y **cómo se notifican** (push), con **destinatario explícito**: eventos **para admins**, **para todos**, **para un usuario concreto** y eventos **cuyo canal lo decide el módulo** (por el canal del usuario o por un canal propio de una entidad suya, p. ej. un grupo de gastos).

**Límite de alcance:** esta spec fija el contrato de canales, el envelope, el mecanismo de entrega (outbox), el despacho de `hooks`, el catálogo de eventos **del Core** y el envío de push. Los **eventos de negocio de cada módulo** los declara su manifest y su spec (task-03 + spec del módulo).

## 2. Canales y destinatarios

### 2.1 Canales fijos del Core

| Canal | Topic | Quién puede unirse (RLS) | Consumidor |
|---|---|---|---|
| **`admins`** | `admins` | `core_is_admin()` | **panel web** (ADR 0009 §5) y admins en el móvil |
| **`all`** | `all` | `auth.uid() IS NOT NULL` | reservado: avisos generales de instancia |
| **`user`** | `user-<uuid>` | `auth.uid() = <uuid>` | el móvil de esa persona |

Todos **privados** (`private: true`): el cliente se suscribe con su sesión de Supabase y la política RLS decide antes de dejarle entrar.

> **`all` es la excepción, no la regla** (ADR 0009 §3): un módulo no puede emitir a `all`/`admins` salvo que lo declare expresamente en su manifest.

### 2.2 Canales de módulo

El manifest (task-03 §3) declara:

```jsonc
"channels": [
  { "pattern": "expense-group-{id}", "members_fn": "split_expenses_expense_group_members" }
]
```

- `{id}` = uuid. `pattern` es único en la instancia.
- `members_fn(topic text) returns setof uuid` — **una sola función para dos usos**: la RLS de `realtime.messages` (¿puede entrar?) y la resolución de **destinatarios de push** (¿a quién notifico?). Una única fuente de verdad.
- **Persistencia**: el Core la guarda en **`module_channels`** (task-01) al instalar el módulo y la borra al desinstalarlo (task-03 §4.3). La **política RLS la crea el Core una sola vez**; los módulos nunca tocan `realtime.*` (decisión C de task-03).
- **Endurecimiento obligatorio de `members_fn`**: `SECURITY DEFINER`, `SET search_path = ''`, `STABLE`, `REVOKE EXECUTE FROM PUBLIC` (nadie puede invocarla por RPC para enumerar miembros), nombre validado por `^[a-z][a-z0-9_]{0,62}$`. **Fallo cerrado**: si lanza, la suscripción se deniega y se loguea.
- **Módulo `disabled`/desinstalado**: sus canales no aceptan suscripciones ni publican; una suscripción abierta deja de recibir (la autorización se re-evalúa con la conexión y `JWT_EXPIRY = 900 s`).

### 2.3 `target` de un evento

| `target` | Se publica en | Destinatarios de push |
|---|---|---|
| `admins` | `admins` | todos los `core_is_admin()` |
| `all` | `all` | todos los `profiles` |
| `user` | `user-<subject>` | el usuario **sujeto** del evento |
| `channel:<pattern>` (con `{id}` resuelto) | topic del módulo | resultado de `members_fn(topic)` |

**Resolución del sujeto para `target: user`**: el evento declara **de dónde sale el uuid** (`"subject": "resource.user_id"` en el manifest, ruta **obligatoria** cuando el target es `user`), validado por el esquema zod del evento al instalar. Sin sujeto resoluble → el evento se rechaza en `publish()` (`validation_failed`), nunca se publica "a nadie".

## 3. Envelope del evento

- **Interno (servidor)**: `{ type, target, subject?, resource, payload }` — `target`/`subject` son **metadato de enrutado**.
- **Wire (lo que recibe el cliente)**: `{ type, resource, payload }` — **`target` no viaja** (api-v1 §3.9 se mantiene).
- **`resource`** = la **misma representación** que devuelve el endpoint REST del recurso (ADR 0004 §7).
- **`payload`** = solo datos no sensibles y no duplicados de `resource`.
- **Nunca** secrets, tokens, contraseñas ni datos internos (ADR 0007 §5).

> **Delta a api-v1 §3.9/§7/F (2026-10-26):** el envelope del **wire** no cambia (`{ type, resource, payload }`); el servidor añade `target`/`subject` como metadato interno para enrutar a los canales del ADR 0009. Registrada aquí y en el ADR 0009.

## 4. Catálogo de eventos del Core (v1)

| Evento | `target` | `resource` | `payload` | `notify` |
|---|---|---|---|---|
| `user.deactivated` | `admins` (el panel ve la baja) + **hooks** de módulos | `User` (sin email) | `{ reason? }` | — |
| `module.installed` | `admins` | `Module` | `{ version }` | — |
| `module.activated` | `admins` | `Module` | — | — |
| `module.deactivated` | `admins` | `Module` | — | — |
| `module.uninstalled` | `admins` | `{ key }` | — | — |
| `invitation.created` | `admins` | `Invitation` (sin `token`) | — | — |
| `invitation.redeemed` | `admins` | `Invitation` | `{ user_id }` | — |
| `settings.updated` | `admins` | — | `{ category_key, key }` (**nunca el valor**) | — |

**Reglas**:
- `user.deactivated` se dirige a `admins` (no a `user`): la desactivación **revoca las sesiones del afectado al instante**, así que su canal sería inalcanzable; los **hooks** de los módulos son server-side y no necesitan realtime.
- Los eventos de **negocio** los declara cada módulo en su manifest (tipo, target, subject, notify) — el Core no los conoce.
- Un evento cuyo consumidor no exista en v1 no entra en el catálogo.

## 5. Publicación: outbox transaccional (at-least-once)

**Decisión del usuario (C2):** la entrega es **at-least-once** con **outbox transaccional** — no "publicar y esperar que salga".

1. El caso de uso, **dentro de su transacción**, inserta el evento en **`event_outbox`** (task-01): `event_id` (uuid, idempotencia), `type`, `target`, `subject`, `resource`, `payload`, `state = pending`, `attempts = 0`, `next_attempt_at`. Es una **fila de BD**, no un efecto externo (ADR 0004 §6 se respeta: el efecto externo ocurre después).
2. **Tras el commit**, el despachador (`publish()`) toma los `pending` y:
   - **valida el `target`** contra la lista cerrada y los `channels`/`eventos` **declarados por el módulo emisor** (la clave `sb_secret_*` **se salta la RLS**, así que este es el único gate);
   - publica al topic con **Broadcast privado**;
   - **despacha los `hooks`** de los módulos suscritos (§5bis);
   - envía **push** si el evento declara `notify` (§6.3);
   - marca `state = published`.
3. **Fallo**: `state = pending` con `attempts++` y `next_attempt_at` con **backoff exponencial** (tope configurable); tras N intentos → `state = failed` (visible en el panel y en `admin_actions`). **Nunca** se pierde en silencio ni se revierte el dato.
4. **Reintento y purga**: job programado (task-07) reintenta los `pending`/`failed` y purga los `published` antiguos (retención configurable).

**Mecanismo Supabase**: Broadcast sobre canales privados. La publicación servidor→canal se hace con **claves nuevas `sb_secret_*`** (Supabase depreca `service_role`/`anon` a finales de 2026 — ADR 0006 §3) mediante el endpoint REST de broadcast o `realtime.send()`, **validado contra la doc vigente antes de implementar** (la decisión de mecanismo exacto queda al sprint de implementación; aquí se fija el requisito y la clave).

**`JWT_EXPIRY = 900 s`**: se configura en el **proyecto Supabase** (dashboard/Management API) desde el wizard de `/setup` (task-06). En `settings` queda solo como **valor informativo/verificable** de instalación — **no** es un setting editable en el panel (es parámetro de seguridad que acota el lag de revocación de conexiones abiertas).

### 5.1 RLS de `realtime.messages` — una sola política

**Corrección crítica (revisión 2026-10-26):** las políticas **permisivas** de Postgres se combinan con **OR**; una política por canal ("`all` → `auth.uid() IS NOT NULL`") autorizaría **todos** los topics. Por eso hay **una única política**:

```
SELECT sobre realtime.messages: core_can_subscribe(realtime.topic())
```

`core_can_subscribe(topic text)` — `SECURITY DEFINER`, `STABLE`, `SET search_path = ''`, `EXECUTE` revocado de `PUBLIC`, **fallo cerrado** — despacha:

| Topic | Condición |
|---|---|
| `admins` | `core_is_admin()` |
| `all` | `auth.uid() IS NOT NULL` |
| `user-<uuid>` | `auth.uid()::text = substring(topic from 6)` |
| resto | `module_channels.pattern` casa (con `{id}`=uuid) **y** el módulo está `active` **y** `auth.uid() = ANY(members_fn(topic))` |

- La crea **el Core** (rol `postgres`), una vez; los módulos no tocan `realtime.*`.
- **Nunca** se emite ni se acepta un topic sin política explícita (`all` **es** un topic con destinatario declarado, no un comodín).
- Las políticas de realtime se escriben **junto a** las RLS de datos (task-10), con su test de aislamiento.

### 5bis. Despacho de `hooks` (reacciones de módulos)

- **Quién**: el despachador de `publish()`, **en proceso, tras el commit**.
- **Cuándo/orden**: después de publicar el evento realtime; los hooks no bloquean la respuesta al cliente.
- **Aislamiento**: cada hook corre aislado (un módulo que falla no afecta a otros ni al evento).
- **Idempotencia**: clave `(event_id, module_key)`; un reintento del outbox **no** re-ejecuta un hook ya aplicado (tabla de aplicación de hooks, o marca en el mismo `event_outbox` por módulo).
- **Fallo**: se reintenta con el backoff del outbox; agotados los intentos → `failed` + alerta en el panel (la conversión de participantes a ficticios de Split Expenses no puede perderse en silencio).

## 6. Notificaciones push (FCM)

### 6.1 Registro del dispositivo

- La app registra su token: **`POST /api/v1/devices`** (`platform`, `push_token`), **idempotente por `push_token`** — si el mismo token se registra para otro usuario (móvil reasignado), se reasigna `user_id`. Escribe `last_seen_at`.
- **Al cerrar sesión**, la app llama **`DELETE /api/v1/devices/{id}`**; si la sesión se revoca desde el panel, el `device` se marca `revoked_at` y deja de recibir push (task-01 §3.6).
- Varios dispositivos por usuario **permitidos** (delta a task-01: `devices.push_token` UNIQUE; no UNIQUE por `(user_id, platform)`).

### 6.2 Configuración por instancia

- **FCM opcional en el wizard, pero nunca silencioso**: paso **"Notificaciones (Firebase)"** junto a Supabase y SMTP (task-06, 4 pasos); se puede omitir con **aviso explícito** (*"sin Firebase no recibirás notificaciones con la app cerrada"*), y mientras no esté configurado el panel muestra un **banner persistente** con enlace al paso.
- **Un APK único**: la configuración de Firebase **no se hornea**; la app inicializa Firebase **en runtime** con los valores públicos de la instancia.
- Settings (`notifications.push.*`, task-06): `fcm_project_id`, `fcm_app_id`, `fcm_api_key`, `fcm_sender_id` (**públicos**, `is_public: true`) + **service account JSON** (`is_secret: true`, cifrado).
- **La app obtiene esos valores públicos por `GET /api/v1/instance`**, que incluye un bloque **`settings_public`** (delta a task-02 §3.8: solo claves `is_public` del Core, nunca secretos, nunca settings de módulo).
- **Instancia del autor**: se configura en el **sprint de infra** (`sprint-infra` task-08).

### 6.3 Envío

- Disparo: evento con `notify: ["push"]` (manifest, task-03).
- **Destinatarios**: los de la tabla §2.3, filtrando `push_token IS NOT NULL AND revoked_at IS NULL` y usuarios activos; **deduplicados por token**.
- **Envío**: FCM HTTP v1, **batches ≤500 tokens**; resultado **por token**:
  - `UNREGISTERED` / `INVALID_ARGUMENT` → `device.revoked_at` (deja de enviarse).
  - `UNAVAILABLE` / `INTERNAL` / `429` → reintento con el backoff del outbox (el push forma parte del mismo despacho).
- **Texto: data-only, sin composición en servidor.** El servidor **no localiza** (ADR 0007 §1) y el i18n usa el inglés como clave (task-01 §3.3): el push lleva `{ "key": "push.expense_created", "args": { "group": "Familia" } }` y **la app construye la notificación** con su locale. **Sin datos sensibles** (nada de importes): el detalle se pide a la API al abrir.
- **Sin push a la web**; el panel recibe realtime (ADR 0009 §5), no push.
- **Sin email de notificación de negocio en v1** (los de auth los manda Supabase Auth, auth §5bis).
- **Fallo de push**: no revierte ni bloquea; se reintenta por el outbox y se loguea con `request_id` (ADR 0007 §7).

## 7. Contratos testables

- **Aislamiento de canales** (crítico): un usuario normal **no** puede suscribirse a `admins` ni a `user-<otro>`; un miembro del grupo A **no** recibe el canal del grupo B; un topic sin política → rechazado. (Test negativo obligatorio: la política única no autoriza de más.)
- **`members_fn`**: no invocable por RPC desde un cliente (`EXECUTE` revocado); fallo → suscripción denegada (fallo cerrado).
- **Outbox**: el evento se inserta en la transacción del caso de uso; si la transacción aborta, **no** queda evento; si la publicación falla, el evento queda `pending` con `attempts` y se reintenta; el dato **nunca** se revierte por un fallo de entrega.
- **Idempotencia de hooks**: reprocesar el mismo `event_id` no aplica el hook dos veces.
- **Representación compartida**: el `resource` del evento coincide con la respuesta REST del recurso.
- **Push**: evento con `notify` → envío a los dispositivos de los destinatarios del canal; sin FCM configurado la operación **no falla** (degradación); token `UNREGISTERED` → `revoked_at`.
- **`publish()` valida**: rechaza `target` no declarado por el emisor, topic fuera de patrón y emisión desde un módulo no `active`.

## 8. Decisiones tomadas (conversación de diseño, 2026-10-26)

| # | Decisión |
|---|---|
| A | **Canales con destinatario explícito** (ADR 0009): fijos (`admins`, `all`, `user-<uuid>`) + canales de módulo persistidos en `module_channels` con `members_fn` (una función para RLS **y** push) |
| B | **El módulo decide su canal**: `user`, `admins`/`all` (si lo declara) o canal propio por entidad |
| C | **El panel web sí se suscribe a `admins`** (revisa ADR 0006 §6; el ADR 0005 sigue siendo el mecanismo de lectura, realtime es señal de invalidación). Canal `panel` separado descartado: misma RLS, sin ganancia |
| D | **Catálogo Core v1** con `resource`/`payload` cerrados; `user.deactivated` → `admins` + hooks (su canal de usuario sería inalcanzable) |
| E | **Entrega at-least-once con outbox transaccional** (`event_outbox`), reintentos con backoff, purga por job (task-07); consumidores idempotentes por `event_id` |
| F | **`publish()` valida el `target`** (la clave de servidor se salta la RLS): lista cerrada + canales declarados por el emisor + módulo `active` |
| G | **Una sola política RLS** (`core_can_subscribe`), nunca una por canal (las permisivas se combinan con OR) |
| H | **Hooks**: despacho en proceso tras el commit, aislado, idempotente por `(event_id, module_key)` |
| I | **Push = FCM**, opcional en el wizard pero **nunca silencioso** (paso recomendado + aviso al omitir + banner); runtime config; **data-only con clave i18n** (el servidor no localiza); batches ≤500; sin datos sensibles. Instancia del autor → `sprint-infra` task-08 |
| J | **Sin email de negocio en v1** |
| K | **`JWT_EXPIRY = 900 s`** se escribe en el **proyecto Supabase** desde el wizard; en `settings` solo informativo, no editable en el panel |

## 9. Fuera de alcance

- **Eventos de negocio de cada módulo** (tipo, target, subject, payload) → manifest y spec de cada módulo.
- **`members_fn` concreto de Split Expenses** → spec del módulo.
- **Catálogo de settings y pasos del wizard** → task-06.
- **Job de reintento/purga del outbox** → task-07.
- **Mecanismo exacto de publicación (REST broadcast vs `realtime.send()`)** → sprint de implementación del Core, validado contra doc vigente.
- **Presence / chat / typing** → fuera de alcance.
- **Bandeja de novedades in-app** (lista de eventos al abrir sin push) → futuro; si se implementa, tendrá su propio contrato (no se promete aquí).
- **Email propio de negocio** → futuro (auth §5bis reserva el sitio).

## 10. Criterios de aceptación

- Canales definidos con **una única política RLS** (`core_can_subscribe`), probada con tests negativos: no se entra en `admins`, `user-<otro>` ni canal de otro módulo.
- Canales de módulo **persistidos** (`module_channels`) con `members_fn` endurecida; desinstalación limpia filas y rechaza suscripciones.
- Envelope interno con `target`/`subject`; **wire sin `target`** (delta a api-v1 registrada).
- Catálogo Core cerrado con `resource`/`payload`; `user.deactivated` → `admins` + hooks.
- **Outbox transaccional** con reintentos, idempotencia y purga; el dato nunca se revierte por fallo de entrega.
- `publish()` valida `target`, patrón y estado del módulo emisor.
- Push FCM data-only con clave i18n, batches, limpieza de tokens inválidos, degradación sin FCM, `POST`/`DELETE /devices` en el ciclo del dispositivo.
- Coherente con ADR 0009/0006 (parcialmente sustituido), ADR 0004/0007, auth §4/§7, api-v1 §3.9 (delta), task-01/02/03.
- Aprobada por el usuario y revisada por segundo agente (DoD de Docs).

## 11. Referencias

- ADRs: `docs/adr/0009-topologia-de-canales-realtime.md`, `0006-realtime.md` (vigente salvo topología), `0004-bordes-y-capa-de-aplicacion.md`, `0007-manejo-de-errores.md`
- Spec de auth: `docs/superpowers/specs/2026-10-25-auth.md` §4/§5bis/§7
- Spec de API v1: `docs/superpowers/specs/2026-10-25-api-v1.md` §3.9 (eventos) — con delta 2026-10-26
- Spec de datos: `docs/superpowers/specs/2026-10-26-core-data-model.md` (task-01)
- Spec de API del Core: `docs/superpowers/specs/2026-10-26-core-api.md` (task-02)
- Spec de módulos: `docs/superpowers/specs/2026-10-26-modulo-system.md` (task-03)
- Testing: `docs/conventions/testing-strategy.md` §5
- Plan del sprint: `docs/superpowers/plans/2026-10-26-sprint-core-design.md`
- Task: `docs/tasks/sprint-core-design/task-04.md`