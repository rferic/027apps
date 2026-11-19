# Invitaciones

Ciclo completo de una invitación: cómo se crea, qué ve quien la recibe, cómo se canjea desde la
web y desde la app, y qué pasa cuando caduca o se agotan las plazas. Contratos en la spec
[`2026-11-18-invitation-club-design.md`](../superpowers/specs/2026-11-18-invitation-club-design.md)
(niveles, cuota, QR, solicitudes) y
[`2026-11-16-invitation-session-migration-design.md`](../superpowers/specs/2026-11-16-invitation-session-migration-design.md)
(contrato del canje); tareas en `docs/tasks/sprint-18-invitation-club/`.

## Qué resuelve

Un administrador invita a cualquiera, sin límite; **cada miembro** invita a un número limitado de
personas según su **nivel**. El acceso se entrega de dos formas: un **QR rotativo** para quien está
delante (código de 90 s que acuña una invitación de 15 min) y un **enlace compartible** de 48 h para
quien no lo está. La invitación de miembro nace **sin email ni nombre**: los rellena quien se
registra. Cuando a alguien se le acaban las plazas, **pide al administrador** que le amplíe la cuota
(una suma permanente y revocable), y el administrador lo gestiona desde el panel con aviso push.

La app es el camino preferido para invitar y aceptar; la web es siempre un camino completo, no un
consuelo para quien no tiene Android.

## Niveles y cuota

- El administrador define una lista de **niveles** `(nivel, cuota)` desde Ajustes →
  Invitaciones (clave `invitations.levels`, tipo JSON). Por defecto `5/2/1`; máximo 20 niveles;
  `quota` entre 0 y 100; contiguos desde 1. Un **array vacío** significa «solo invitan los
  administradores».
- El nivel se **graba en el perfil al canjear** (`invite_level`) y **no se recalcula**: un amigo
  invitado por el propietario es nivel 1, sus invitados nivel 2, etc. El administrador puede
  **ascender o descender** a una persona desde el panel sin tocar a sus invitados.
- **Administradores y superadministradores**: `unlimited`, sin nivel y sin cuota.
- La **cuota es viva** y se calcula en el servicio (no es una columna que pueda desviarse):

  ```
  remaining = max(0, base(nivel) + concedidas − usadas − reservadas)
  ```

  - **usadas**: perfiles con `role = 'user'` e `invited_by = uid` (una cuenta desactivada ocupa).
  - **reservadas**: invitaciones pendientes vigentes del invitador (`source in ('member','qr')`,
    sin usar, sin revocar, `expires_at` en el futuro).
  - **concedidas**: suma de las concesiones activas (`invitation_quota_grants`).
- Toda creación de invitación y todo intercambio de QR comprueban la cuota y escriben en la **misma
  transacción**, bajo `pg_advisory_xact_lock(hashtext('invite:' || uid))`: dos invitaciones en
  paralelo con una sola plaza dejan exactamente una.

## Estados

### Invitación

| Estado | Cuándo | Qué permite |
|---|---|---|
| `pending` | no canjeada, `expires_at` en el futuro | canjear, revocar |
| `expired` | pasó `expires_at` sin canjearse | revocar (una de miembro no se renueva: se revoca y se crea otra) |
| `used` | canjeada | solo consultar |
| `revoked` | revocada a mano | nada; queda como histórico |

`GET /api/v1/invitations?status=pending|used|expired|revoked|all&source=admin|member|qr` filtra el
listado del panel.

### Código de QR

| Estado | Cuándo | UI |
|---|---|---|
| `pending` | sin usar, TTL vivo (90 s) | escaneable |
| `used` | ya acuñó una invitación | «este QR ya se usó; pide otro» |
| `expired` | TTL pasado sin usar | «el QR caducó; genera otro» |
| `invalid` | desconocido | 404 genérico |

### Solicitud

```
pending ──approve──> approved      (crea una concesión)
   ├────reject────> rejected
   └────cancel────> cancelled      (el solicitante retira)
```

Una sola `pending` por persona (índice único parcial); aprobada o rechazada, puede volver a pedir.

## Invitar de administrador

- Duración: `expires_in_days` entre 1 y 365, por defecto 7. La columna recuerda la duración con la
  que se creó para que una renovación no la resetee.
- Rol: `user` o `admin`. Nunca `super_admin`: lo valida el servicio y la columna solo acepta los
  dos valores. `depth = 1` (el administrador es la raíz).
- El token viaja solo en la URL del enlace; la base guarda su hash. Si se pierde el enlace, se
  **rota** (`/invitations/{id}/link`) en vez de reutilizarlo.
- El email sale en el idioma de la invitación (`locale`) con el nombre de la instancia y del grupo.

## Invitar de miembro (enlace, 48 h)

`POST /api/v1/me/invitations` (10/min) reserva una plaza y devuelve **una vez** el enlace
(`/invite/<token>`). La invitación es anónima: `source = 'member'`, rol `user`,
`depth = nivel del invitador + 1`, TTL 48 h, sin email ni nombre. El invitado hereda:

- **categorías**: todas las del invitador;
- **módulos**: los `user_modules` activos del invitador que sean `is_public = true` o
  `module_registry.delegable = true`.

El invitador no elige ni ve una lista editable; el panel sí muestra el paquete resultante. Un
privado solo se hereda si el administrador lo marcó **delegable**. Si se pierde el enlace, se
revoca y se crea otro (no hay «renovar» de miembro). La app no envía correo: el enlace se comparte
como se quiera.

## Invitar de cerca (QR, 90 s / 15 min)

1. En la app, **Mostrar QR** llama a `POST /api/v1/me/join-codes` (6/min) y pinta
   `https://<instancia>/join/<code>` con `FLAG_SECURE` y una cuenta atrás de 90 s; a los ~75 s pide
   otro código. El anterior sigue válido hasta su TTL.
2. El invitado escanea y abre `/join/<code>`, que pinta el nombre del invitador y la instancia y un
   botón **Continuar**. El `GET` **no canjea** (un prefetch de WhatsApp no acuña nada).
3. **Continuar** hace `POST /api/v1/join-codes/{code}/exchange` (10/min por IP): comprueba TTL y que
   el invitador siga activo, comprueba la cuota bajo bloqueo y acuña la invitación
   (`source = 'qr'`, TTL 15 min). Es de **un solo uso**: el segundo intento responde `join_code_used`
   (el token no se guarda en claro, no se puede reproducir). Si no queda plaza, la página dice «el
   club está lleno; pide al administrador» y no acuña nada.
4. Redirige a `/invite/<token>`; el App Link abre la app si está instalada.

## Aceptar (canje)

### Preview (público, sin sesión)

`GET /api/v1/invitations/{id}/preview` devuelve lo que necesita la pantalla: `state`, `email`,
`name`, `role`, `role_applies`, `account_exists`, `requires_identity`, `locale`, `expires_at`,
`inviter_name`, `instance_name` y `timezone`. Una invitación **anónima** devuelve
`requires_identity: true` y `email`/`name` en NULL.

### Canje anónimo

1. El formulario pide **nombre, email y contraseña** (la invitación no los trae). El idioma sale
   del perfil del invitador o del de la instancia.
2. `POST /api/v1/invitations/{token}/redeem` con `{ email, name?, password? }`:
   - email nuevo → crea el usuario de Auth y el perfil con el nombre escrito, `invited_by` e
     `invite_level` de la invitación;
   - email existente → `existing_account_signin_required`, el cliente firma con Supabase y reintenta
     con el Bearer; la cuenta conserva nombre, rol, nivel y `invited_by`.
3. Se materializan categorías y módulos de la invitación (solo estos dan acceso), se marca
   `used_at` y `redeemed_by`, y se emite `invitation.redeemed`.

### Cuenta nueva (con email y nombre)

El contrato del sprint 16 no cambia: `POST /api/v1/invitations/{id}/redeem` crea el usuario, el
perfil con el rol de la invitación y la sesión; el idioma se escribe en el `locale` del perfil y en
la cookie `027_locale`; redirige a `/welcome` (o al panel si es administrador).

### Cuenta existente (session-first, D21)

El formulario pide **solo la contraseña** de la cuenta que ya existe; el Core no la verifica. Con la
sesión abierta, el canje asocia la invitación a ese perfil y el rol **no** se aplica
(`role_applies: false`): quien ya era `admin` o `super_admin` conserva el suyo.

### Desde la app y desde la web

- El enlace es un **App Link** (`https://<instancia>/invite/<token>` y `https://<instancia>/join/<code>`)
  en el build firmado; en debug el esquema propio (`zero27apps-dev://invite/…`, `…/join/…`).
- La instancia sale del enlace, nunca de la que tuviera la app abierta.
- `/invite/[token]` y `/join/[code]` son las páginas públicas. El botón de la app no es obligatorio
  para aceptar; un enlace `http://` local no puede abrir la app (App Link necesita https verificado).

## Solicitud y aprobación

1. Con `remaining = 0`, la app y el panel muestran **Solicitar al administrador** en vez de las
   acciones de invitar.
2. `POST /api/v1/me/invitation-requests` (3/h) con cantidad (1..20) y motivo opcional. Una sola
   pendiente por persona; se rechaza con `request_pending` si ya hay una y con
   `invitation_quota_available` si aún quedan plazas.
3. El outbox emite `invitation.requested` a **`admins`** con push; el panel refresca el contador de
   **Solicitudes** por polling (60 s con la pestaña visible y al recuperar el foco).
4. El administrador aprueba con una cantidad (por defecto la pedida) o rechaza con motivo. La
   aprobación es un `update … where state = 'pending'` (dos administradores a la vez no crean dos
   concesiones; el segundo recibe `request_resolved`).
5. Aprobar crea una concesión en `invitation_quota_grants` y emite `invitation.request_resolved` al
   solicitante con push. La app muestra el resultado en `requests[]` de `GET /me/invitations`.

## Ascender, conceder, retirar

- **Ascender/descender**: `PATCH /api/v1/users/{id}` con `invitation_level` (1..20 | null). No toca
  a los invitados ni a las invitaciones pendientes de esa persona.
- **Conceder**: desde la solicitud o desde la ficha del miembro (`POST
  /users/{id}/invitation-grants`). Es una suma **permanente y revocable**, no un cambio de nivel.
- **Retirar**: `DELETE /users/{id}/invitation-grants/{grantId}` marca `revoked_at`. Si la persona ya
  gastó esas plazas, su contador queda por encima del tope y se bloquean invitaciones nuevas; no se
  expulsa a nadie.

## Desactivar (expulsión) y purgar

- **Desactivar**: en la misma transacción revoca las invitaciones pendientes y los códigos del
  afectado. Sus invitados **siguen dentro**, con su nivel, y siguen contando contra él (la cuenta
  existe). El afectado no puede invitar ni canjear.
- **Purgar**: además la fila desaparece; sus invitados quedan con `invited_by = null` y **dejan de
  contar contra nadie** (huérfanos). No hay cascada: expulsar a alguien no expulsa a sus invitados.

## Renovar, revocar, reenviar

- **Renovar** (`POST /api/v1/invitations/{id}/renew`): solo para invitaciones de administrador
  `expired`. Reusa `expires_in_days` y devuelve el enlace renovado.
- **Revocar** (`DELETE /api/v1/invitations/{id}` o `DELETE /api/v1/me/invitations/{id}`): pasa a
  `revoked`; el enlace deja de canjearse y se libera la reserva.
- **Reenviar email** y **rotar el enlace**: limitados por rate limit; no cambian el token ni la
  caducidad (reenviar) o generan un enlace nuevo (rotar).
- **Renovar, rotar y reenviar** responden `invitation_not_renewable` cuando
  `source in ('member','qr')`: esas invitaciones solo se revocan. El panel oculta esas acciones en
  esas filas.

## Errores nuevos

| Código | HTTP | Cuándo |
|---|---|---|
| `invitation_quota_exhausted` | 409 | Sin plazas al crear una invitación o al intercambiar un QR. |
| `request_pending` | 409 | Ya hay una solicitud pendiente. |
| `invitation_quota_available` | 409 | Se pide ampliación teniendo plazas. |
| `request_resolved` | 409 | Se aprueba/rechaza/cancela una solicitud ya resuelta. |
| `invitation_inviter_inactive` | 409 | El invitador fue desactivado (defensa; sus códigos ya se revocan). |
| `join_code_used` | 410 | Se intenta canjear un QR ya usado. |
| `invitation_not_renewable` | 409 | Renovar, rotar o reenviar una invitación de miembro o QR. |

## Invariantes de seguridad

- Token y código bearer: hash en base, un solo uso, TTL, `no-store`/`noindex`/`no-referrer` en las
  respuestas públicas. Nada de tokens ni códigos en logs, ni en el servidor ni en la app.
- El canje es público **a propósito** (una cuenta nueva no tiene sesión), pero usa el resolvedor real
  de sesión: si el email ya existe y la sesión no es de ese perfil, responde
  `existing_account_signin_required` y no crea ni cambia nada.
- Los endpoints de miembro exigen sesión y propiedad; el servidor deriva rol, nivel, categorías y
  módulos (nunca los elige el invitador). La cuota se comprueba bajo advisory lock.
- La RLS de `invitations` sigue cerrada a administradores; `join_codes`, `invitation_categories`,
  `invitation_requests` e `invitation_quota_grants` no tienen grants a `anon`/`authenticated`.
- Rate limits por IP en el canje y el intercambio del QR, y por usuario en las acciones del panel.
- Un rol pedido fuera de `user|admin` es un 400, no un `super_admin` silencioso. Un email ajeno al
  de una invitación con nombre no puede canjearla. El QR se pinta con `FLAG_SECURE` y el código no
  se guarda en disco.

## Probar en local

1. Crea la invitación desde el panel con una cuenta de prueba y copia el enlace.
2. Web: abre `http://192.168.x.x:3003/invite/<token>` en el navegador y recorre los caminos de
   cuenta nueva y cuenta existente.
3. Miembro: en la app, pulsa **Mostrar QR**, escanea el código en otra pantalla y recorre
   `/join/<code>`; comprueba que el segundo intercambio del mismo código da `join_code_used`.
4. Enlace de miembro: **Crear enlace**, cópialo y ábrelo; comprueba el formulario anónimo.
5. Solicitud: con la cuota agotada, pide plazas; aprueba desde el panel y comprueba la concesión y
   el push.
6. Desactiva un invitador y comprueba que sus enlaces vivos dejan de canjearse; purga otro y
   comprueba que sus invitados quedan huérfanos.

La prueba con sesión real y el recorrido por los dos caminos es parte de
[`pre-delivery-verification.md`](pre-delivery-verification.md).

## Errores frecuentes

| Síntoma | Causa probable |
|---|---|
| El enlace de la app abre la web | build sin App Link verificado (`assetlinks.json`/`ANDROID_APP_SHA256`) o APK de debug |
| «Este enlace ya no es válido» en la app | token caducado, usado o revocado; se revoca y crea otro |
| La web pide contraseña a quien ya tiene cuenta | preview con `account_exists: true` mal cacheado; recarga el preview |
| El rol no cambia al aceptar | es intencionado: una cuenta existente conserva su rol (D6) |
| «Este QR ya se usó» | el intercambio es de un solo uso; pide otro QR |
| Un miembro no puede invitar aunque le quedaban plazas | cuota viva: una invitación pendiente reserva y una cuenta desactivada ocupa |
