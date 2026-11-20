# Spec — Invitaciones de club: niveles, cuota y QR

**Fecha:** 2026-11-18 · **Estado:** aprobada por el propietario (2026-11-18) · plan en
[`2026-11-18-invitation-club.md`](../plans/2026-11-18-invitation-club.md)
**Sprint:** 18 (el 17 sigue pendiente y no se sustituye) · **Rama prevista:** `sprint/18-invitation-club`
**Base:** [diseño 027Apps](2026-10-24-027apps-design.md) · [auth](2026-10-25-auth.md) ·
[API v1](2026-10-25-api-v1.md) · [modelo de datos del Core](2026-10-26-core-data-model.md) ·
[invitaciones del sprint 16](2026-11-16-invitation-session-migration-design.md) ·
[canje web](2026-11-07-invitation-redemption-design.md) ·
[realtime y notificaciones](2026-10-26-realtime-notificaciones.md) ·
[instancia y ajustes](2026-10-26-instance-config.md) ·
[flujo de invitaciones](../../flows/invitations.md) ·
[ADR 0004](../../adr/0004-bordes-y-capa-de-aplicacion.md) · [ADR 0007](../../adr/0007-manejo-de-errores.md) ·
[ADR 0009](../../adr/0009-realtime.md)

## 1. Objetivo

Que la instancia funcione como un club privado: el administrador sigue pudiendo invitar a
cualquiera, pero **cada miembro puede traer a un número limitado de personas** según su nivel de
profundidad. Un amigo invitado por el propietario puede invitar a su pareja, a su familia reducida y
a un par de amigos; sus invitados pueden traer a los suyos, hasta donde la configuración lo permita.
Cuando a alguien se le acaban las plazas, **pide al administrador** que le amplíe la cuota, y el
administrador lo gestiona desde el panel (con aviso push en la app).

El acceso se entrega con un **QR rotativo** para quien está delante y con un **enlace compartible**
para quien no lo está. La invitación nace sin email ni nombre: los rellena quien se registra.

La conversación con el propietario (2026-11-18) cerró el «qué». Esta spec fija el contrato técnico.
**No se escribe código de producto hasta que la spec y el plan estén aprobados.**

## 2. Alcance

### 2.1 Dentro

- **Niveles configurables**: el administrador define una lista de niveles `(nivel, cuota)` desde
  ajustes. Por defecto 5/2/1. Tantos niveles como quiera (máximo 20).
- **Nivel grabado al canjear**: el perfil guarda `invite_level` y `invited_by` en el momento del
  canje y no se recalcula. El administrador puede ascender o descender a una persona desde el panel.
- **Cuota viva**: `base del nivel + concedidas − (cuentas traídas + invitaciones pendientes
  vigentes)`. Una cuenta desactivada ocupa; una purgada libera; una invitación pendiente reserva
  hasta que caduca o se revoca.
- **Invitación de miembro** (enlace, 48 h por defecto, ajustable en Ajustes) y **QR rotativo**
  (código de 90 s que acuña una invitación de 15 min). El rol de toda invitación de miembro es
  siempre `user`.
- **Herencia limitada**: el invitado recibe los módulos públicos del invitador, los privados que el
  administrador haya marcado como delegables y sus categorías. Nunca recibe un privilegio que el
  invitador no tenga.
- **Solicitud y concesión**: una solicitud pendiente por persona; el administrador aprueba con una
  cantidad (suma permanente y revocable a esa persona) o rechaza. Push a los administradores y aviso
  al solicitante al resolverse.
- **Panel**: ajustes de niveles, interruptor `delegable` por módulo, listado de invitaciones con
  origen e invitador, ficha del miembro con nivel, concedidas y personas traídas, y una sección
  **Solicitudes** con contador que se refresca solo.
- **App**: pantalla de invitación con barra de cuota, QR, enlace, lista de invitados directos y
  solicitud; notificaciones push de administrador y una lista de solicitudes de solo lectura.
- i18n en los 9 idiomas, OpenAPI al día, pruebas y auditoría de seguridad.

### 2.2 Fuera

- Que un miembro pueda invitar como `admin`, cambiar el rol, la categoría o los módulos de su
  invitado, o elegir su nivel. Todo lo deriva el servidor.
- Registro abierto, login social, MFA y verificación de email del invitado (se acepta el riesgo: el
  email es de recuperación, no una prueba de identidad).
- Un centro de notificaciones genérico. La sección es **Solicitudes**; si mañana hay más avisos de
  administrador, se generaliza.
- Aprobar solicitudes desde la app (solo listarlas y abrir el panel). Se puede añadir después con el
  mismo endpoint.
- Expulsión en cascada: desactivar a alguien **no** saca a sus invitados. El administrador decide uno
  a uno.
- Recomponer el nivel de los invitados cuando cambia el de su invitador, o recalcular la cuota de
  nadie al cambiar los ajustes.
- Notificar por email las invitaciones de miembro (el enlace se comparte como se quiera).
- Liberar plazas sin borrar la cuenta. La válvula es la concesión del administrador.
- Cambiar el contrato del manifest de módulos más allá de la columna `delegable` del registro.

## 3. Hechos verificados (2026-11-18)

| Hecho | Evidencia | Consecuencia |
|---|---|---|
| `public.invitations` exige `email` y `name` NOT NULL y ata el canje a ese email. | `supabase/migrations/0008_invitations.sql`, `packages/core/src/invitations/service.ts` (`assertRedeemable`) | Una invitación anónima exige relajar ambas columnas y el `assertRedeemable`. |
| La RLS de `invitations` es solo de administradores (`invitations_admin`). | `0008_invitations.sql` | Los endpoints de miembro van por el pool de servicio y el caso de uso impone la cuota; la RLS no se abre a `authenticated`. |
| `expires_in_days` es NOT NULL, 1..365. | `0035_invitation_role_ttl.sql` | Un TTL de 15 min no cabe: `expires_in_days` pasa a nullable y solo lo usan las invitaciones de administrador (que son las que se renuevan). |
| `profiles` no tiene `invited_by` ni `invite_level`; el rol es `super_admin|admin|user`. | `0001_profiles.sql` | Hay que añadir las dos columnas y migrar a los usuarios existentes. |
| `user_modules` es la concesión efectiva (la categoría materializa módulos al asignarse); el canje inserta `invitation_modules`, no los módulos de la categoría. | `0007_user_categories.sql`, `service.ts` (`redeemInvitation`) | Heredar módulos es copiar el conjunto efectivo filtrado; heredar la categoría es una etiqueta, no una vía de acceso. |
| `module_registry` tiene `is_public` y no tiene `delegable`. | `0010_modules.sql` | Los públicos se heredan siempre; los privados necesitan la columna nueva. |
| El catálogo de settings admite `json` y ya hay 18 claves en 5 categorías; el seed se compara con el catálogo en `db-tests`. | `packages/core/src/settings/catalog.ts`, `0002_settings.sql` | Los niveles son un ajuste `json` más una categoría nueva; hay que tocar catálogo, seed y la prueba de sincronía. |
| `enqueueEvent` acepta `notify: ["push"]` y el despachador compone `key: push.<tipo>` con un mapa fijo de campos (`actor_name`, `amount_minor`, `description`…). | `packages/core/src/realtime/service.ts` | Los eventos nuevos pueden llevar push; el argumento `amount` y `state` hay que añadirlos al mapa. |
| No existe tabla `admin_actions`/`audit`. La trazabilidad hoy son las columnas de actor (`granted_by`, `updated_by`) y los eventos del outbox. | `supabase/migrations/`, `packages/core/src` | La auditoría de niveles y concesiones se apoya en esas columnas; no se inventa una tabla de auditoría en este sprint. |
| El panel tiene `/panel/invitations`, `/panel/members/[id]` y `/panel/settings`; la app solo **canjea** invitaciones (`InviteScreen.kt`, `InvitationLink.kt`), no las emite. | Repo | El emisor es trabajo nuevo en app; el panel reutiliza páginas existentes. |
| La desactivación (`deactivated_at`) y la purga física existen; la purga pone a NULL `invitations.created_by`. | `0014_user_purge.sql`, `users/api.ts` | Al desactivar/purgar hay que revocar las invitaciones pendientes del afectado para no dejar enlaces huérfanos. |
| `device_transfers` es el patrón de credencial bearer corta: tabla sin grants a `authenticated`, hash, TTL y un solo uso. | `0036_device_transfers.sql` | El código del QR sigue el mismo patrón. |

## 4. Decisiones

### 4.1 Cerradas por el propietario (conversación 2026-11-18)

| # | Decisión |
|---|---|
| C1 | El administrador invita sin límite. Todo miembro tiene un nivel y una cuota; los números son configurables desde el panel (por defecto 5/2/1, tantos niveles como se quiera). |
| C2 | El nivel se graba en el perfil al canjear y no se recalcula. El administrador puede ascender o descender manualmente. |
| C3 | El invitado hereda la categoría y los módulos del invitador, con el límite de que un privado solo se hereda si el administrador lo marca como delegable. |
| C4 | El QR es rotativo; al escanearlo se crea la invitación, sin email ni nombre, que se rellenan al registrarse. |
| C5 | La cuota es viva: una cuenta desactivada ocupa, una purgada libera, y una invitación pendiente vigente reserva. |
| C6 | Sin plazas, el miembro pide al administrador; al aprobar se le **sube la cuota a esa persona**, no se cambia su nivel. |
| C7 | Los administradores reciben un aviso push y ven las solicitudes en una sección; la gestión se hace en el panel. |
| C8 | Expulsar a alguien no expulsa a sus invitados. |
| C9 | Los usuarios que ya existen quedan en nivel 1; administradores y superadministradores quedan fuera del reparto. |

### 4.2 Propuestas (pendientes de aprobación con esta spec)

| # | Decisión | Alternativas | Propuesta |
|---|---|---|---|
| D1 | Forma del modelo | dominio paralelo · ledger de plazas · extender lo existente | **Extender** `invitations`, `profiles` y el canje; solo cuatro tablas nuevas (`join_codes`, `invitation_categories`, `invitation_requests`, `invitation_quota_grants`). |
| D2 | TTL de cada puerta | 15 min para todo · 48 h para todo · dos relojes | **Dos relojes**: el código del QR vive 90 s; la invitación que acuña, 15 min; el enlace que se comparte, 48 h por defecto **y configurable** en Ajustes → Invitaciones (`invitations.member_ttl_hours`, 1..720 h). |
| D3 | Intercambio del QR | canjear al abrir la página · botón «Continuar» que canjea · acuñar y redirigir idempotente | **Botón «Continuar» que canjea una sola vez**: el GET solo pinta el preview, así un prefetch de WhatsApp no acuña nada; el segundo canje responde `join_code_used`. No se guarda el token en claro para reproducirlo. |
| D4 | Alcance del árbol | cada miembro ve todo el árbol · solo sus invitados directos | **Directos para el miembro; subárbol completo para el administrador.** |
| D5 | La barra de cuota | invitaciones históricas · ocupación viva | **Ocupación viva** (`usadas + reservadas / base + concedidas`), con las concedidas separadas. |
| D6 | Concesión | ampliar el nivel · cupón de un solo uso · suma permanente a esa persona | **Suma permanente y revocable** en `invitation_quota_grants`; no toca el nivel. |
| D7 | Solicitud | sin límite · una pendiente por persona | **Una pendiente por persona**; rechazada, puede volver a pedir. |
| D8 | Nivel de los invitados de un administrador | 0 · 1 | **1**: el administrador es la raíz y sus invitados son el primer nivel. |
| D9 | Nivel por encima de la lista | recortar al último · guardarlo y dar cuota 0 | **Guardarlo** (p. ej. nivel 4 con tres niveles configurados); su cuota es 0 hasta que el administrador añada ese nivel. |
| D10 | Desactivar o purgar a un invitador | dejar sus enlaces vivos · revocarlos | **Revocar sus invitaciones pendientes y códigos** en la misma operación. Sus invitados se quedan con su nivel y dejan de contar contra nadie si se purga. |
| D11 | Cuenta existente con email anónimo | comprobar el email en el preview · resolverlo en el canje | **En el canje**: `existing_account_signin_required` y el formulario cambia a «entra con tu contraseña». No se añade un oráculo de existencia de cuentas. |
| D12 | Dónde viven los niveles | columnas fijas · ajuste `json` | **Ajuste `json`** `invitations.levels` con la forma `[{level,quota}]`, contiguo desde 1. |
| D13 | Push de la solicitud | solo panel · push a todos los administradores | **Push a todos los administradores con dispositivo activo**; el panel refresca el contador por polling (no hay cliente Supabase de navegador hoy). Sin push a la web (spec de realtime §6). |
| D14 | Auditoría | tabla nueva · columnas y eventos | **Columnas de actor** (`resolved_by`, `granted_by`) y eventos del outbox; no se crea `admin_actions` en este sprint. |

### 4.3 Resueltas en la revisión del builder (2026-11-18)

| # | Pregunta | Resolución |
|---|---|---|
| R1 | Reproducir el token de un QR reabierto es incompatible con guardar solo el hash. | **No se reproduce**: el canje es de un solo uso y el segundo intento es `join_code_used`. El GET de `/join/<code>` no muta; canjea el botón «Continuar». |
| R2 | No había endpoint para listar las concesiones y poder retirarlas. | `GET /users/{id}/invitation-grants`, con activas e histórico. |
| R3 | `cancelled` existía en el diagrama sin operación, y una pendiente bloquea para siempre. | `POST /me/invitation-requests/{id}/cancel`; el índice único se libera al cancelar. |
| R4 | El miembro no podía leer el resultado de su solicitud. | `GET /me/invitations` devuelve `requests[]` (últimas 10) con estado e importe concedido. |
| R5 | En Android `amount` se pinta como dinero y `key` no se renderiza. | El push nuevo **no envía `amount`**: envía `key` y `state`. La app añade dos textos fijos localizados (9 idiomas), sin importes ni nombres; el detalle está al abrir. |
| R6 | Una invitación con rol `admin` no puede tener nivel. | `invite_level = null` cuando el rol es `admin`; `invited_by` se guarda igual. La cuota cuenta solo perfiles con rol `user`. |
| R7 | Renovar, rotar y reenviar no tienen sentido en una invitación anónima. | Se rechazan con `invitation_not_renewable` y el panel las oculta; solo se revocan. La unicidad por email pendiente no aplica a las anónimas. |

## 5. Modelo de datos

Migración aditiva `0037_invitation_club.sql` (el número es orientativo; lo fija la implementación).
No hay `down`: el rollback es una migración hacia delante.

### 5.1 `profiles`

```sql
alter table public.profiles
  add column invited_by uuid references public.profiles (id) on delete set null,
  add column invite_level integer check (invite_level between 1 and 100);

update public.profiles
   set invite_level = 1
 where role = 'user' and invite_level is null;
```

- `invited_by` es quien lo trajo; `invite_level` es su profundidad (1 = invitado por un
  administrador). Ambos se escriben **solo al crear el perfil**; un canje sobre una cuenta existente
  no los toca.
- `invite_level` queda NULL para `admin` y `super_admin`: no tienen cuota ni nivel.
- El check admite hasta 100 para no romper un nivel heredado por encima de la lista configurada;
  el panel solo asigna 1..20 (el máximo de niveles configurable).
- Un `user` con `invite_level` NULL (p. ej. un administrador degradado) tiene cuota 0 hasta que el
  panel le asigne un nivel; la ficha lo advierte.
- Las dos columnas quedan **fuera** del grant de columnas de `authenticated`: el propietario no se
  asigna nivel ni invitador.

### 5.2 `invitations`

```sql
alter table public.invitations
  alter column email drop not null,
  alter column name drop not null,
  alter column expires_in_days drop not null,
  add column depth integer check (depth between 1 and 100),
  add column source text not null default 'admin'
    check (source in ('admin', 'member', 'qr')),
  add column redeemed_by uuid references public.profiles (id) on delete set null;

update public.invitations set depth = 1, source = 'admin' where depth is null;
```

- `email`/`name` NULL = invitación anónima: los rellena el canje. Si vienen, se mantiene la regla
  actual (el email debe coincidir; el nombre manda).
- `depth` es el nivel que tendrá el perfil creado. Se fija al acuñar: `1` si la crea un
  administrador o una clave de servicio, `invitador.invite_level + 1` si la crea un miembro.
- `source` distingue el origen para el panel y las métricas; no cambia el canje.
- `redeemed_by` deja el rastro de quién la usó (perfil nuevo o cuenta existente).
- `expires_in_days` solo se rellena en las invitaciones de administrador; son las únicas que se
  renuevan. Una invitación de miembro se revoca y se crea otra.

### 5.3 `invitation_categories`

```sql
create table public.invitation_categories (
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  user_category_id uuid not null references public.user_categories (id) on delete cascade,
  primary key (invitation_id, user_category_id)
);
```

- Un perfil puede estar en varias categorías; la invitación las copia todas. El canje inserta una
  fila por categoría en `user_category_members`.
- No se materializan los `user_category_modules`: el acceso del invitado son los
  `invitation_modules`, igual que hoy.

### 5.4 `join_codes`

```sql
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

create index join_codes_inviter_recent_idx on public.join_codes (inviter_id, created_at desc);
```

- Token `027_join_` + 32 bytes base64url; solo el SHA-256 en base. TTL 90 s.
- `invitation_id` deja el rastro de la invitación acuñada, pero **no** permite reproducir su token
  (solo se guarda el hash). El intercambio es de un solo uso: el segundo intento responde
  `join_code_used` y la UI pide otro QR.
- Limpieza oportunista al crear: borra los códigos del invitador usados o caducados hace más de un
  día. Sin cron nuevo.

### 5.5 `invitation_requests` y `invitation_quota_grants`

```sql
create table public.invitation_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null check (amount between 1 and 20),
  reason text check (reason is null or length(btrim(reason)) between 1 and 280),
  state text not null default 'pending'
    check (state in ('pending', 'approved', 'rejected', 'cancelled')),
  granted_amount integer check (granted_amount between 1 and 100),
  resolution_reason text check (resolution_reason is null or length(btrim(resolution_reason)) between 1 and 280),
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
```

- Una solicitud aprobada crea **una** concesión con el importe aprobado; rechazarla no crea nada.
- `revoked_at` retira la concesión sin borrar la historia. Si la persona ya gastó esas plazas, su
  contador puede quedar por encima del tope: se bloquean invitaciones nuevas, no se expulsa a nadie.
- `granted_by_key` existe para que una clave de servicio pueda conceder, con el mismo patrón que el
  resto del Core.

### 5.6 `module_registry`

```sql
alter table public.module_registry
  add column delegable boolean not null default false;
```

- Los módulos con `is_public = true` se heredan siempre, sin mirar `delegable`.
- Un módulo privado con `delegable = false` no se hereda aunque el invitador lo tenga.

### 5.7 Ajustes de invitaciones

Categoría nueva `invitations` y clave `invitations.levels` (tipo `json`):

```json
[{ "level": 1, "quota": 5 }, { "level": 2, "quota": 2 }, { "level": 3, "quota": 1 }]
```

- Validación: array de 0 a 20 objetos estrictos `{level, quota}`; `level` contiguo desde 1 sin
  huecos ni repetidos; `quota` entero 0..100.
- Un array vacío significa «solo invitan los administradores».
- Cambiar los ajustes **no** reescribe niveles ni revoca nada; solo cambia la cuota base de las
  personas cuyo nivel coincide.
- La semilla, el catálogo de `packages/core/src/settings/catalog.ts` y la prueba de sincronía
  `db-tests` se actualizan a la vez.

Clave `invitations.member_ttl_hours` (tipo `int`, por defecto `48`): cuántas horas vive el enlace de
una invitación de miembro.

- Rango 1..720; un valor ausente o fuera de rango cae al defecto de 48 h, nunca a un TTL de cero.
- Se lee al **acuñar**: `expires_at` se calcula una vez y no se recalcula. Cambiar el ajuste no
  alarga ni mata un enlace ya entregado, solo afecta a los siguientes.
- No toca el QR: el código sigue viviendo 90 s y la invitación que acuña, 15 min (D2).
- La migración `0038_invitation_ttl_setting.sql` siembra la fila con `48`.

### 5.8 RLS y privilegios

- `join_codes`, `invitation_categories`, `invitation_requests` e `invitation_quota_grants`: RLS
  activada, **sin grants** a `anon` ni `authenticated`; se usan solo desde el pool de servicio, como
  `device_transfers`.
- `invitations` mantiene su política de administradores; los endpoints de miembro no abren la tabla a
  `authenticated`.
- `profiles`: `invited_by` e `invite_level` no entran en el grant de columnas editables por el
  propietario.

### 5.9 Cálculo de la cuota

La fuente de verdad es una consulta única, ejecutada en el servicio (no una columna que pueda
desviarse):

```sql
-- base: la cuota del nivel del perfil, o 0 si su nivel no está en la lista
-- concedidas: sum(amount) de concesiones activas
-- usadas: profiles where invited_by = uid and role = 'user'
--         (una cuenta desactivada sigue existiendo; un administrador no ocupa plaza)
-- reservadas: invitations where created_by = uid and source in ('member','qr')
--             and used_at is null and revoked_at is null and expires_at > now()
-- restantes: greatest(0, base + concedidas - usadas - reservadas)
```

- Administradores y superadministradores: `unlimited = true`, sin comprobación.
- La creación de una invitación y la comprobación de cuota van en **la misma transacción**, con
  `pg_advisory_xact_lock(hashtext('invite:' || uid))`, igual que la creación por email de hoy.
- El intercambio de un código QR también reserva: comprueba y acuña bajo el mismo bloqueo.
- La purga de un perfil elimina su fila; sus invitados quedan con `invited_by = null` y dejan de
  contar contra nadie. No hay que tocar contadores.

## 6. Contrato de API

### 6.1 Convenciones

- Todo cuelga de `/api/v1`; sobre de error de ADR 0007.
- Endpoints de miembro: sesión activa, cualquier rol; la cuota y la propiedad las impone el caso de
  uso. Un `admin`/`super_admin` no tiene cuota.
- Endpoints de administrador: scopes `invitations:read` / `invitations:write`; el nivel de un
  miembro va con `users:write`.
- Respuestas con token: `no-store`, `noindex`, `no-referrer`. El token viaja solo en el path.
- Rate limits por identidad e IP; los valores concretos se afinan en el plan.

### 6.2 Invitaciones de miembro

**`GET /api/v1/me/invitations`** · sesión · lectura.

```json
{
  "quota": {
    "level": 2, "base": 2, "granted": 1, "used": 1, "reserved": 1,
    "remaining": 1, "unlimited": false,
    "pending_request": { "id": "…", "amount": 2, "created_at": "…" }
  },
  "invitations": [
    { "id": "…", "state": "pending", "source": "qr", "expires_at": "…",
      "path": null, "redeemed_by": null, "created_at": "…" }
  ],
  "invitees": [
    { "id": "…", "display_name": "Ana", "level": 3, "state": "active",
      "joined_at": "…" }
  ],
  "requests": [
    { "id": "…", "amount": 2, "state": "approved", "granted_amount": 2,
      "resolved_at": "…", "created_at": "…" }
  ]
}
```

- No devuelve tokens: un enlace ya emitido no se puede recuperar; si se perdió, se revoca y se crea
  otro.
- `invitees` son solo los directos (`invited_by = caller`). El subárbol es del panel.
- `requests` son las últimas 10 del solicitante, resueltas o no, para que la app pueda enseñar el
  resultado sin depender del push.

**`POST /api/v1/me/invitations`** · sesión · 10/min · body `{}`.

- Crea una invitación anónima `source = 'member'`, TTL `invitations.member_ttl_hours` (48 h por
  defecto), `depth = nivel + 1`, rol `user`, módulos y categorías heredados.
- 201: `{ invitation, token, path: "/invite/<token>" }`. El token se devuelve **una vez**.
- `409 invitation_quota_exhausted` si no quedan plazas.

**`POST /api/v1/me/join-codes`** · sesión · 6/min.

- 201: `{ code: "027_join_…", expires_at, path: "/join/<code>" }`. El código se devuelve una vez y
  solo se guarda su hash. TTL 90 s.
- `409 invitation_quota_exhausted` si ya no queda ninguna plaza (no se enseña un QR que no puede
  acuñar).

**`DELETE /api/v1/me/invitations/{id}`** · sesión.

- Revoca una invitación propia pendiente; libera la reserva. De otro usuario → `404`.

**`POST /api/v1/me/invitation-requests`** · sesión · 3/h · body `{ "amount": 2, "reason": "…" }`.

- `amount` 1..20; `reason` opcional, 280 caracteres.
- `409 request_pending` si ya hay una pendiente; `409 invitation_quota_available` si aún le quedan
  plazas (la solicitud es para cuando no queda ninguna).
- Emite `invitation.requested` a `admins` con push.

**`POST /api/v1/me/invitation-requests/{id}/cancel`** · sesión.

- Retira una solicitud pendiente propia; de otro usuario → `404`; resuelta → `409 request_resolved`.
- Libera el índice único y permite volver a pedir.

### 6.3 Público: código y canje

**`GET /api/v1/join-codes/{code}/preview`** · público · 60/min por IP.

```json
{ "join": { "state": "pending", "inviter_name": "Eric", "instance_name": "Familia" } }
```

- `state`: `pending | expired | used | invalid`. `invalid` y desconocido son 404 entre sí.
- No revela ids, niveles, cuota ni módulos.

**`POST /api/v1/join-codes/{code}/exchange`** · público · 10/min por IP.

- Valida TTL y que el invitador siga activo. Comprueba la cuota bajo bloqueo y acuña la invitación
  (`source = 'qr'`, TTL 15 min), marca `used_at` e `invitation_id`. **Un solo uso**: el segundo
  intento no puede devolver el token (no se guarda en claro) y responde `join_code_used`.
- 201: `{ token, path: "/invite/<token>" }`. El token se devuelve una vez.
- `409 invitation_quota_exhausted`, `410 join_code_used`, `404` si caducó o no existe.
- La página `/join/[code]` **no canjea en el GET** (un prefetch de WhatsApp la abriría): pinta el
  preview y un botón «Continuar» que hace el POST. Si el canje ya ocurrió, la página dice «este QR ya
  se usó; pide otro».

**`GET /api/v1/invitations/{token}/preview`** · público (contrato existente, ampliado).

- Añade `requires_identity: boolean` (true cuando `email` y `name` son NULL) y devuelve
  `email: null`, `name: null`, `account_exists: false` en ese caso.
- Para invitaciones con email, el contrato del sprint 16 no cambia.

**`POST /api/v1/invitations/{token}/redeem`** · público (contrato existente, ampliado).

- Body: `{ email, name?, password?, display_name? }`.
- Invitación anónima: `email` y `name` son obligatorios; se normalizan y se usan para el perfil.
  Invitación con email/nombre: se mantiene la regla actual (el email debe coincidir; `name` y
  `display_name` se ignoran).
- Si el email ya tiene cuenta: `409 existing_account_signin_required` (D11); el cliente firma primero
  con Supabase y reintenta con el Bearer, como hoy.
- Al crear el perfil: `invited_by = invitation.created_by`, `invite_level = invitation.depth`
  **salvo que el rol de la invitación sea `admin`**, que deja `invite_level` NULL (R6). Una cuenta
  existente conserva su nivel y su `invited_by`.
- Hereda `invitation_categories` y `invitation_modules` (solo estos dan acceso).
- Escribe `redeemed_by = userId` y `used_at`.
- Los eventos `invitation.redeemed` llevan el perfil resultante, también en las anónimas.

### 6.4 Administración

**`GET /api/v1/invitations`** · `invitations:read` (contrato existente, ampliado).

- Cada fila añade `source`, `depth`, `anonymous`, `created_by` y `redeemed_by` (id + nombre).
- Filtros nuevos: `source=admin|member|qr` y `status` como hoy.

**`GET /api/v1/invitation-requests`** · `invitations:read` · `?state=pending|approved|rejected|cancelled|all`.

- Fila: `{ id, requester: { id, display_name, level }, amount, reason, state, granted_amount,
  resolved_by, resolved_at, created_at }` más la cuota viva del solicitante.
- Orden por `created_at` y `pending` primero.

**`POST /api/v1/invitation-requests/{id}/approve`** · `invitations:write` · body `{ "amount": 3 }`.

- Aprobación condicional (`update … where state = 'pending'`): dos administradores a la vez no crean
  dos concesiones; el segundo recibe `409 request_resolved`.
- Crea la concesión y emite `invitation.request_resolved` a `user` (el solicitante) con push.
- `amount` 1..100.

**`POST /api/v1/invitation-requests/{id}/reject`** · `invitations:write` · body `{ "reason": "…" }`.

- Pasa a `rejected`; emite el mismo evento con `state: "rejected"`.

**`GET /api/v1/users/{id}/invitation-grants`** · `users:write`.

- Lista las concesiones del miembro, activas y revocadas, con `granted_by`, `request_id`,
  `revoked_at` y `created_at`. Es lo que permite pintar y retirar cada concesión en la ficha.

**`POST /api/v1/users/{id}/invitation-grants`** · `users:write` · body `{ "amount": 2, "reason": "…" }`.

- Concesión directa sin solicitud (la misma operación que aprobar). 201 con la concesión.

**`DELETE /api/v1/users/{id}/invitation-grants/{grantId}`** · `users:write`.

- Marca `revoked_at`. Si el usuario queda por encima del tope, el contador lo refleja y se bloquean
  invitaciones nuevas.

**`PATCH /api/v1/users/{id}`** · `users:write` (contrato existente, ampliado).

- Acepta `invitation_level: 1..20 | null`. `null` solo para `admin`/`super_admin`; un `user` con
  `null` queda con cuota 0 y el panel lo advierte.
- Ascender o descender no toca a los invitados de esa persona.

**Renovar, rotar y reenviar** (contratos existentes, acotados).

- `POST /invitations/{id}/renew`, `POST /invitations/{id}/link` y `POST
  /invitations/{id}/resend-email` responden `409 invitation_not_renewable` cuando
  `source in ('member','qr')`; el panel oculta esas acciones en esas filas. Solo se revocan.
- La unicidad de invitación pendiente por email no se aplica a las anónimas (`email` NULL): dos
  invitaciones anónimas del mismo invitador son válidas si la cuota lo permite.

### 6.5 Errores nuevos

| Código | HTTP | Cuándo |
|---|---|---|
| `invitation_quota_exhausted` | 409 | Sin plazas al crear una invitación o al intercambiar un QR. |
| `request_pending` | 409 | Ya hay una solicitud pendiente. |
| `invitation_quota_available` | 409 | Se pide ampliación teniendo plazas. |
| `request_resolved` | 409 | Se aprueba/rechaza/cancela una solicitud ya resuelta. |
| `invitation_inviter_inactive` | 409 | El invitador fue desactivado (defensa; sus códigos ya se revocan). |
| `join_code_used` | 410 | Se intenta canjear un QR ya usado. |
| `invitation_not_renewable` | 409 | Renovar, rotar o reenviar una invitación de miembro o QR. |

### 6.6 OpenAPI

- Operaciones nuevas: `GET/POST /me/invitations`, `POST /me/join-codes`, `DELETE
  /me/invitations/{id}`, `POST /me/invitation-requests`, `POST
  /me/invitation-requests/{id}/cancel`, `GET /join-codes/{code}/preview`, `POST
  /join-codes/{code}/exchange`, `GET /invitation-requests`, `POST
  /invitation-requests/{id}/approve`, `POST /invitation-requests/{id}/reject`, `GET/POST
  /users/{id}/invitation-grants`, `DELETE /users/{id}/invitation-grants/{grantId}`.
- Se actualizan: `GET /invitations`, `GET /invitations/{token}/preview`, `POST
  /invitations/{token}/redeem`, `PATCH /users/{id}` y los tres endpoints de renovación/rotación/envío
  con su error nuevo.
- `pnpm --filter core openapi:generate` y `pnpm check:openapi`.

## 7. Flujos

### 7.1 Invitar a alguien que está delante (QR)

1. En la app, el miembro abre **Invitaciones**: barra «2 de 5 (4 + 1)», lista de invitados y dos
   acciones.
2. Pulsa **Mostrar QR**. La app pide `POST /me/join-codes`, pinta el QR de
   `https://<instancia>/join/<code>` con `FLAG_SECURE` y una cuenta atrás de 90 s; a los ~75 s pide
   otro. El código anterior sigue válido hasta su TTL.
3. El invitado escanea con la cámara. Abre `/join/<code>`:
   - la página pinta el nombre del invitador y la instancia, y un botón **Continuar**;
   - al pulsarlo, `POST /join-codes/{code}/exchange` acuña la invitación de 15 min y redirige a
     `/invite/<token>`; el App Link abre la app si está instalada;
   - si no queda plaza, la página dice «el club está lleno; pide al administrador» y no acuña nada.
4. El invitado rellena **nombre, email y contraseña** en `/invite/<token>` (web o app) y canjea.
5. El perfil nace con `invited_by` y `invite_level = nivel del invitador + 1`.

- El GET no canjea: un prefetch de WhatsApp solo pinta la página. El segundo canje del mismo código
  recibe `join_code_used` y la página pide otro QR.
- Un QR fotografiado dentro de sus 90 s puede usarse una vez; es una frontera social, no de
  seguridad (ver §9).

### 7.2 Invitar a alguien que no está (enlace)

1. El miembro pulsa **Crear enlace**. `POST /me/invitations` reserva una plaza y devuelve el enlace,
   que vive las horas de `invitations.member_ttl_hours` (48 por defecto).
2. Lo comparte por WhatsApp, email o como quiera. La app no envía correo.
3. El invitado abre `/invite/<token>` y sigue el mismo formulario. Si caduca, el invitador revoca y
   crea otro (no hay «renovar» de miembro). Caducar libera la reserva: la plaza vuelve a estar
   disponible sin contar como usada.

### 7.3 Canje anónimo

1. `GET /invitations/{token}/preview` devuelve `requires_identity: true`, `inviter_name`,
   `instance_name`, `expires_at` y el estado.
2. El formulario pide nombre, email y contraseña + confirmación. El idioma sale del perfil del
   invitador (`locale`) o del de la instancia.
3. `POST /invitations/{token}/redeem`:
   - email nuevo → crea el usuario de Auth y el perfil con el nombre escrito, `invited_by` y
     `invite_level` de la invitación;
   - email existente → `existing_account_signin_required`, el cliente firma y reintenta con Bearer;
     la cuenta conserva nombre, rol, nivel y `invited_by`.
4. Se materializan categorías y módulos de la invitación, se marca `used_at` y `redeemed_by`, y se
   emite `invitation.redeemed`.

### 7.4 Sin plazas: solicitud y aprobación

1. Con `remaining = 0`, la app y el panel muestran **Solicitar al administrador** en vez de las
   acciones de invitar.
2. `POST /me/invitation-requests` con cantidad y motivo opcional.
3. El outbox emite `invitation.requested` a `admins` con `notify: ["push"]`: push a cada
   administrador con dispositivo activo; el panel refresca el contador de **Solicitudes** por
   polling (60 s con la pestaña visible y al recuperar el foco) y al cargar la página.
4. El administrador abre **Solicitudes** (panel), ve quién pide, cuánto, por qué y su cuota actual.
   Aprueba con una cantidad (por defecto la pedida) o rechaza con motivo.
5. Aprobar crea `invitation_quota_grants` y emite `invitation.request_resolved` al solicitante con
   push; el contador sube en la siguiente lectura.
6. La app muestra la solicitud en `requests[]` (resuelta o pendiente) y, si se aprobó, la cuota
   nueva. Una pendiente se puede cancelar desde la app.

### 7.5 Ascender, conceder, retirar

- **Ascender/descender**: `PATCH /users/{id}` con `invitation_level`. No toca a los invitados de esa
  persona ni sus invitaciones pendientes.
- **Conceder**: desde la solicitud o desde la ficha del miembro. Suma permanente y revocable.
- **Retirar**: `DELETE …/invitation-grants/{grantId}`. Si la persona ya gastó esas plazas, su
  contador queda por encima del tope y se bloquean invitaciones nuevas; no se expulsa a nadie.

### 7.6 Desactivar y purgar

- **Desactivar** (expulsión normal): en la misma transacción, revoca las invitaciones pendientes y
  los códigos del afectado. Sus invitados siguen dentro, con su nivel, y **siguen contando** contra
  el invitador del afectado (la cuenta existe). El afectado no puede invitar ni canjear.
- **Purgar**: además, la fila desaparece; sus invitados quedan con `invited_by = null` y dejan de
  contar contra nadie. No hay cascada (C8).

### 7.7 Herencia de categorías y módulos

Al acuñar una invitación de miembro, el servidor copia:

- **categorías**: todas las del invitador (`user_category_members`), en `invitation_categories`;
- **módulos**: los `user_modules` activos del invitador que sean `is_public = true` o
  `module_registry.delegable = true`, en `invitation_modules`.

El invitador no elige ni ve una lista editable; el panel sí muestra el paquete resultante. Si el
administrador cambia `delegable` después de acuñar, la invitación ya emitida conserva su paquete
(es un snapshot); las siguientes lo respetan.

## 8. Estados

### 8.1 Invitación

| Estado | Condición | Panel | App/web |
|---|---|---|---|
| `pending` | `used_at` NULL, `revoked_at` NULL, `expires_at` futuro | revocar | canjear / esperando |
| `used` | `used_at` no NULL | consultar | «ya aceptada» |
| `expired` | `expires_at` pasado | revocar | «caducó; pide otra» |
| `revoked` | `revoked_at` no NULL | histórico | 404 |

### 8.2 Código de QR

| Estado | Condición | UI |
|---|---|---|
| `pending` | sin usar, TTL vivo | escaneable |
| `used` | ya acuñó una invitación | «ya se usó; pide otro QR» |
| `expired` | TTL pasado sin usar | «el QR caducó; genera otro» |
| `invalid` | desconocido | 404 genérico |

### 8.3 Solicitud

```
pending ──approve──> approved
   ├────reject────> rejected
   └────cancel────> cancelled   (el solicitante retira)
```

Una sola `pending` por persona (índice único parcial). Aprobada o rechazada, puede volver a pedir.

### 8.4 Cuota

| Situación | `used` | `reserved` | Efecto |
|---|---|---|---|
| Perfil creado por invitación | +1 | — | consume |
| Cuenta desactivada | sigue contando | — | ocupa |
| Cuenta purgada | −1 | — | libera |
| Invitación pendiente vigente | — | +1 | reserva |
| Invitación caducada o revocada | — | −1 | libera |
| Canje sobre cuenta existente | sin cambio | −1 | la reserva se libera |
| Concesión activa | — | — | +1 al tope |

## 9. Seguridad

### 9.1 Controles

| Punto | Control |
|---|---|
| A01 acceso | Los endpoints de miembro exigen sesión y comprueban propiedad; la cuota y la derivación de nivel/módulos/categorías son del servidor. La RLS de `invitations` sigue cerrada a administradores; las tablas nuevas no tienen grants. |
| A02 cripto | Códigos y tokens solo SHA-256; el token se devuelve una vez; `no-store`, `noindex`, `no-referrer`; sin tokens en logs ni en la app. |
| A03 inyección | Zod en todos los bordes; SQL parametrizado; el motivo de la solicitud es texto plano sin HTML. |
| A04 abuso | Un código = una invitación; TTL 90 s; cuota bajo advisory lock; rate limits por usuario/IP; una solicitud pendiente por persona; reabrir el código no multiplica. |
| A05 configuración | Los niveles son un ajuste validado; un array vacío cierra las invitaciones de miembro; `delegable` solo lo cambia un administrador. |
| A06 dependencias | Sin dependencias nuevas: el QR de la app usa lo que ya hay (ZXing); la web reutiliza `qrcode`. |
| A07 auth | El canje anónimo mantiene la regla sesión-primero para cuentas existentes; la desactivación revoca invitaciones y códigos. |
| A08 integridad | La aprobación es un `update … where state = 'pending'`; el intercambio de un código es de un solo uso; las migraciones son aditivas. |
| A09 logs | Ni tokens, ni códigos, ni emails del invitado en logs; `request_id` sí. |
| A10 SSRF | Los enlaces se construyen con `instance.public_url`; no se aceptan URLs del cliente. |
| A11 Android | El QR se pinta con `FLAG_SECURE`; el código no se guarda en disco; el bitmap no va a la galería. |

### 9.2 Límites aceptados

- **El QR y el enlace son bearer.** Quien los vea dentro de su ventana puede usarlos. Rotar el QR
  evita la foto de pantalla casual, no la videollamada. La defensa real es cuota, un solo uso,
  caducidad, revocación y el árbol visible para el administrador.
- **El email del invitado no se verifica.** Es recuperación, no identidad. Una errata crea una
  cuenta muerta; el administrador puede desactivarla y el invitador recupera la plaza solo si se
  purga (o con una concesión).
- **El administrador es la raíz.** Puede conceder plazas por encima de cualquier regla; queda en
  `granted_by` y en el evento.

## 10. Documentación, i18n y pruebas

- `docs/flows/invitations.md`: reescribir el ciclo (niveles, cuota, QR, enlace, solicitud, expulsión)
  y dejar el sprint 16 como contrato del canje.
- `docs/superpowers/specs/2026-10-26-realtime-notificaciones.md`: añadir
  `invitation.requested` y `invitation.request_resolved` al catálogo (§4), con su `notify`.
- `docs/ai/module-system.md` y `docs/ai/manifest.schema.json`: documentar `delegable` si se expone
  en el manifest; si es solo estado del registro, basta la ficha del módulo en el panel.
- `docs/ai/landing.md`: revisar la fila de **Miembros**; si la app deja de estar solo «prevista» para
  invitaciones, actualizarla en el mismo PR.
- i18n: 9 idiomas para la pantalla de invitación, el formulario anónimo, la solicitud, los ajustes y
  los dos textos de push. **La app hoy no renderiza `key`** (`PushText.body` compone con
  `description`/`group`/`actor`/`amount` y pinta `amount` como dinero): el sprint añade un mapa
  mínimo `key → texto fijo` para `push.invitation_requested` y, con `state`, para
  `push.invitation_request_resolved`, sin importes ni nombres. El servidor deja de reutilizar
  `amount` y envía `key` + `state`.
- El panel no tiene cliente Supabase de navegador: el contador de Solicitudes se refresca al cargar
  y por polling (60 s con la pestaña visible, y al recuperar el foco). Nada de un cliente realtime
  nuevo en este sprint.
- Pruebas: cuota con desactivación/purga/caducidad; carrera de dos invitaciones con una plaza; dos
  aprobaciones simultáneas; QR reabierto (segundo canje = `join_code_used`); canje anónimo con email
  nuevo y existente; herencia de públicos, privados delegables y no delegables; backfill de niveles;
  RLS de las tablas nuevas; `PushText` con las claves nuevas.
- `pnpm lint`, `pnpm tsc`, `pnpm test`, `pnpm --filter admin build`, `pnpm --filter db-tests test`,
  `pnpm check:openapi` y auditoría de seguridad antes de `finalizada`.

## 11. Trabajo previsto (para el plan, no para esta spec)

| Bloque | Qué |
|---|---|
| 01 | Migración, backfill, RLS, `delegable`, ajuste de niveles y semilla. |
| 02 | Core: cuota viva, niveles, ascenso/descenso y concesiones. |
| 03 | Core: invitaciones de miembro, códigos QR e intercambio de un solo uso. |
| 04 | Core: preview y canje anónimo, herencia de categorías y módulos. |
| 05 | Core: solicitudes, cancelación, aprobación/rechazo, concesiones y eventos push. |
| 06 | Panel: ajustes de niveles, `delegable`, ficha del miembro con concesiones y listado de invitaciones. |
| 07 | Panel: Solicitudes con contador, aprobar/rechazar y árbol. |
| 08 | App: pantalla de invitación, QR, enlace y solicitud. |
| 09 | App: push (mapa `key`), deep links y solicitudes de solo lectura. |
| 10 | Docs, i18n, OpenAPI, pruebas y auditoría. |

El orden definitivo y el reparto en tareas los fija el plan (`docs/superpowers/plans/`).

## 12. Puertas

- **Aprobar esta spec** antes de escribir código (y el plan después).
- **Aprobar los números iniciales** 5/2/1 y la forma del ajuste.
- **Aceptar el copy** de la pantalla de invitación y de la solicitud en el preview.
- **Orden explícita de merge** a `staging` y, más tarde, de `staging` a `main`.
