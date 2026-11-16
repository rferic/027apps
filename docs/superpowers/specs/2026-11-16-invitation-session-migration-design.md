# Spec — Aceptación de invitaciones, sesión duradera y migración de teléfono

**Fecha:** 2026-11-16 · **Estado:** Pendiente de aprobación del propietario
**Sprint:** 16 · **Rama:** `sprint/16-invitation-session-and-migration`
**Base:** [diseño 027Apps](2026-10-24-027apps-design.md) · [auth](2026-10-25-auth.md) ·
[API v1](2026-10-25-api-v1.md) · [canje web](2026-11-07-invitation-redemption-design.md) ·
[shell Android](2026-11-12-android-access-shell.md) · [i18n](../../flows/i18n.md) ·
[ADR 0004](../../adr/0004-bordes-y-capa-de-aplicacion.md) ·
[ADR 0007](../../adr/0007-manejo-de-errores.md) ·
[ADR 0008](../../adr/0008-fechas-y-moneda.md) ·
[ADR 0010](../../adr/0010-entornos-y-ramas.md)

## 1. Objetivo

Que una persona invitada pueda entrar **por la app si la tiene**, con todos sus datos ya rellenos, o
**por la web si no la tiene**, sin bucles y sin perder la sesión después. El sprint cierra además los
huecos que hoy dejan a un miembro atrapado o expulsado a medias: el logout web que revoca la sesión
del móvil, el bucle del panel para un perfil desactivado, el error de red que se confunde con una
sesión revocada, la recuperación de contraseña inexistente y la migración de teléfono.

El propietario ya cerró el alcance en la conversación (requisitos 1–6 y A1–A7). Esta spec fija el
contrato técnico y las decisiones que faltan; **no se escribe código de producto hasta que la spec y
el plan estén aprobados** y los mockups de la tarea 02 estén aceptados.

## 2. Alcance

### 2.1 Dentro

- **Aceptación app-first**: el enlace del email abre la app si el App Link está verificado; la app
  pide solo contraseña y confirmación, con email, nombre, instancia, quién invita, caducidad y rol
  rellenos y bloqueados; al enviar crea la cuenta e inicia sesión.
- **Wizard web**: aviso de que por ahora solo hay app Android (8+), descarga del APK, reintento de
  apertura en la app sin bucle y canje completo en el navegador; QR e instrucciones en escritorio.
- **Sesión duradera**: logout local en panel y app; clasificación de refresh (red vs revocado);
  expulsión limpia por desactivación, borrado o revocación; fin del bucle del panel; errores
  reintentables del proxy sin borrar cookies.
- **Recuperación de contraseña**: enlace desde el login, formulario de solicitud, email propio en los
  9 idiomas, confirmación por `token_hash`, página de nueva contraseña y revocación de las otras
  sesiones.
- **Migración de teléfono**: QR de 60 s, un solo uso y guardado como hash; el móvil nuevo entra sin
  escribir contraseña; el viejo queda fuera y su dispositivo FCM revocado.
- **A2**: vista previa pública de la invitación por token.
- **A3**: renovar invitaciones caducadas con su duración original, rotando token y reenviando email.
- **A4**: coherencia de marca e instancia entre email, web y app (nombre + wordmark; no hay logo
  configurable).
- **A5**: paridad web/app: nombre bloqueado, confirmación de contraseña, mismos estados.
- **A6**: rol en la invitación (`user`/`admin`) con guardrails; nunca `super_admin`.
- **A7**: flujo para un email que ya tiene cuenta (contraseña existente, sin cambiar la contraseña).
- **A1 (propuesto)**: auto-login web tras canjear para roles de panel; página de bienvenida para
  `user`.
- i18n de todo lo nuevo en los 9 idiomas, OpenAPI al día, pruebas y auditoría de seguridad.

### 2.2 Fuera

- Registro abierto, login social, MFA, passkeys y cambio de email.
- App iOS, Play Store, actualización automática del APK y push en iOS.
- Migración de teléfono por iOS o por web; el QR es solo Android y hay que advertirlo.
- Un selector de logo de instancia (se retiró en la migración `0017`); se usa el wordmark/icono de
  la app + `instance.name`.
- Reescritura del modelo de módulos o del contrato del manifest.
- Sustituir el runtime de sesión de Supabase por otro; se usan sus sesiones y refresh tokens.
- Un panel de sesiones por dispositivo; la expulsión se hace por la ficha del miembro (dispositivos)
  y por desactivación/borrado.
- Notificaciones de la app cuando expulsan al usuario (se descubre al siguiente refresco).

## 3. Hechos verificados (2026-11-16)

Estos hechos están comprobados contra el repo y el entorno real; la implementación no los
re-descubre, solo los usa.

| Hecho | Evidencia | Consecuencia |
|---|---|---|
| `https://027apps.ericrf.com/.well-known/assetlinks.json` responde `[]`. | `curl` del propietario | Sin fingerprint, Android abre el navegador, no la app. |
| El APK estable v0.18.1 descargable desde `/download/android` lleva el App Link de `https://027apps.ericrf.com/invite/` y el esquema `027apps://invite`; `minSdkVersion=26`. | `aapt2` sobre el APK | Android 8+; el enlace https abre la app solo con `assetlinks.json`. |
| SHA-256 del certificado de firma del APK v0.18.1: `00:6A:22:FA:7A:A4:76:A5:5D:B7:C4:62:2E:FF:19:3F:76:4F:66:10:A3:6D:9C:D1:DF:CE:C8:03:AE:A1:39:C6`. | `apksigner verify --print-certs` | Es el valor que va en `ANDROID_APP_SHA256` (formato con dos puntos). |
| `apps/android/app/src/release/AndroidManifest.xml` declara el App Link; el debug usa `027apps-dev://invite`. | Repo | El build de debug no verifica el host https; las pruebas de App Link son con el APK de release. |
| `apps/admin/src/app/.well-known/assetlinks.json/route.ts` lee `ANDROID_APP_SHA256` separado por comas y lo publica tal cual. | Repo | Poner la variable en Vercel y redesplegar es toda la configuración. |
| `apps/admin/src/lib/android-release.ts` prefiere una release estable sobre una pre-release. | Repo | El botón de descarga sirve v0.18.1. |
| Core: `packages/core/src/invitations/service.ts` y `api.ts`; token `027_inv_` + base64url, solo SHA-256 en BD, single-use con `for update`, caducidad. `createInvitation` rechaza un email ya registrado (`email_registered`). `redeemInvitation` reutiliza una cuenta existente y conserva su contraseña. No hay endpoint público de vista previa. `rotateInvitationToken` rechaza caducadas. | Repo | A2/A3/A6/A7 exigen cambios de contrato y de modelo. |
| Web: `/invite/[token]` y `invite-form.tsx`; éxito → `/login?notice=invitation-redeemed`. `/login` sigue en inglés. | Repo | El wizard y el auto-login cambian el flujo de éxito. |
| App: `auth/InvitationLink.kt`, `ui/screens/InviteScreen.kt`, `ui/AppViewModel.kt` (`acceptInvite`), `ui/screens/SettingsScreen.kt` (logout), sesión cifrada con Keystore. | Repo | La app pide email, nombre y contraseña; hay que precargar y bloquear. |
| Web: `(auth)/actions.ts` hace `supabase.auth.signOut()` sin scope; en JS el default es `global`, así que el logout del panel revoca también la sesión del móvil. | Repo + comportamiento del SDK | El logout del panel debe ser `{ scope: "local" }`. |
| App: `AppViewModel.signOut()` llama `FcmRegistrar.revoke()` → `DELETE /devices/{id}`; `revokeDevice` llama `revokeSessions`, que hace `delete from auth.sessions where user_id = $1`. Por tanto el logout del móvil también cierra la web y los demás móviles. | `devices/service.ts`, `devices-route-deps.ts`, `FcmRegistrar.kt`, `AppViewModel.kt` | Hay que distinguir la baja del propio dispositivo (solo push) de la revocación por expulsión (todas las sesiones). |
| `panel-guard.ts` devuelve `null` para un perfil desactivado y redirige a `/login`; `instance-gate.ts` ve la sesión de Supabase y redirige a `/panel`: bucle para un usuario expulsado. | Repo | Hace falta una salida que limpie la sesión antes de volver al login. |
| `apps/android/.../data/ApiClient.kt` reintenta una vez tras 401 con `refresh`; el callback devuelve `false` tanto por red como por refresh inválido, y `AppViewModel.boot()` acaba en `Failure(UNKNOWN)` conservando la sesión. | Repo | Hay que separar red de revocación y no borrar la sesión por red. |
| No existe flujo de recuperación de contraseña: ni «¿Olvidaste tu contraseña?», ni página de reset, ni `/auth/confirm`. Solo `setup/test-email` llama `resetPasswordForEmail` como prueba de SMTP. El SMTP de Supabase Auth (Resend) está configurado; límite 30 emails/hora. | Repo | La recuperación se implementa en este sprint. |
| `supabase-kt` 3.9.0 tiene `OtpType.Email.MAGIC_LINK` y `SignOutScope.LOCAL/GLOBAL/OTHERS`. Supabase Admin `generateLink({ type: "magiclink", email })` devuelve `email_otp` y `hashed_token`. | Librería + documentación | La migración usa un magic link canjeado por la app; el logout explícito usa `LOCAL`. |
| No hay setting de logo; `BrandLogo` solo acepta `variant`/`name`. | `0017` + `components/brand-logo.tsx` | A4 usa wordmark/icono + `instance.name`. |

## 4. Decisiones

### 4.1 Cerradas por el propietario (conversación 2026-11-16)

| # | Decisión |
|---|---|
| C1 | La web sigue siendo una vía completa de canje; el wizard es app-first, no una puerta. |
| C2 | La app muestra email, nombre, instancia, invitador y caducidad bloqueados; solo pide contraseña y confirmación. |
| C3 | La sesión solo termina por logout del usuario o por expulsión (desactivación, borrado, revocación). No por reinicio, actualización, modo avión, error de red ni logout en otro dispositivo. |
| C4 | La recuperación de contraseña entra en este sprint. |
| C5 | La migración de teléfono es solo Android y se advierte; el QR es de un solo uso y caduca. |
| C6 | A2–A7 entran en este sprint. |
| C7 | A6: solo `super_admin` puede invitar como `admin`; `admin` invita como `user`; nunca se invita como `super_admin`. |
| C8 | A7: si el email ya tiene cuenta, se pide la contraseña **existente**, no una nueva. |
| C9 | A5: nombre bloqueado, confirmación de contraseña en app y web, mismos estados. |
| C10 | A3: renovar desde ahora con la duración original (7 días por defecto), rotando token y reenviando email. |
| C11 | A4: nombre de instancia en email, web y app; sin logo configurable; wordmark/icono + nombre. |
| C12 | A1 se mantiene solo si el propietario lo aprueba en esta spec (D2). |

### 4.2 Propuestas que requieren confirmación

Cada fila es una propuesta, no una decisión tomada. La aprobación de la spec equivale a aceptar la
columna «Propuesta» salvo que el propietario diga otra cosa.

| # | Decisión | Opciones | Propuesta |
|---|---|---|---|
| D1 | Mapa de tareas | 10 bloques del brief · 11 con una tarea de mockups | **11 tareas**: se añade la 02 (mockups) porque el DoD de Diseño exige mockup aprobado antes de UI; A2/A6/A7 se implementan en la 04 para no construir los formularios dos veces. |
| D2 | A1 auto-login web | Sí para todos · sí solo roles de panel + bienvenida para `user` · no | **Sí solo roles de panel**; un `user` no tiene páginas de panel, así que se le muestra `/welcome` con la descarga de la app y un enlace a login. Si se rechaza, se mantiene `/login?notice=invitation-redeemed`. |
| D3 | Recuperación | Email propio Resend 9 idiomas con `generateLink` + `token_hash` · plantilla integrada de Supabase (1 idioma) | **Email propio**; `generateLink` no envía correo, solo acuña el token; la web verifica con `verifyOtp`. No exige configurar redirect URLs de Supabase. |
| D4 | Escáner del QR | Cámara del sistema · escáner dentro de la app con ZXing | **Escáner dentro de la app** (ZXing + CameraX, sin Google Play Services); la cámara del sistema sigue funcionando porque el QR contiene una URL App Link. |
| D5 | Contenido del QR | URL `https://<instancia>/migrate/<token>` · solo el token opaco | **URL App Link**, para que la cámara del sistema también abra la app; el token caduca en 60 s y es de un solo uso. El escáner propio evita que la URL pase por un servicio de terceros. |
| D6 | Rol de una cuenta existente | No cambiar el rol al canjear · aplicar el rol de la invitación si es mayor | **No cambiar**: una invitación crea el perfil con su rol; una cuenta existente conserva el suyo y el panel lo cambia si hace falta. El preview devuelve `role_applies: false`. |
| D7 | Localizar `/login` | Incluirlo en este sprint · dejarlo en inglés y anotarlo en backlog | **Incluirlo**: el flujo de recuperación y los avisos (`password-reset`, `access-revoked`) nacen ahí; tener media pantalla en inglés rompe A4. Es un cambio contenido (un componente + claves). |
| D8 | Sesión tras reset de contraseña | Cerrar sesión y volver al login con aviso · auto-login al panel | **Cerrar sesión y login con aviso**; es el contrato que el propietario puede verificar y no deja una sesión de recuperación abierta. |
| D9 | Confirmación en el móvil viejo | Automática (recomendada) · pedir confirmación | **Automática**: el nuevo entra y el viejo se entera por el estado del QR o por el 401 del siguiente refresco. |
| D10 | Duración de la renovación | Guardar la duración original en la invitación · volver siempre a 7 días | **Guardar `expires_in_days`** en la fila y reusarla; las filas existentes se rellenan con la diferencia `expires_at - created_at`. |
| D11 | TTL del QR | 60 s · 2 min · 5 min | **60 s**, un solo uso; el móvil viejo puede generar otro. |
| D12 | Orden del wizard | Aviso → descarga → reintento → formulario · formulario primero | **Aviso → descarga → reintento → formulario**, con «Continuar en el navegador» visible desde el primer paso. |
| D13 | Expulsión por desactivación | Revocar sesiones y dispositivos · solo bloquear por perfil | **Revocar sesiones y dispositivos**; el bloqueo por perfil ya es inmediato, la revocación es la limpieza y la señal para la app. |
| D14 | API de recuperación | Solo server action de la web · endpoint público `/api/v1` | **Solo server action**: la app abre la web; no hay cliente móvil que pida el reset por API. Menos superficie pública y sin OpenAPI nuevo. |
| D15 | Ruta del preview | `GET /invitations/{token}/preview` · `GET /invitations/{token}` | **`/preview`**: evita sobrecargar `GET /invitations/{id}` (uuid, admin) con un token público y permite declarar scopes y rate limit distintos en OpenAPI. |
| D16 | Email para cuenta existente | Segunda variante de copy · mismo email | **Segunda variante**: el email dice que ya hay cuenta y que se use la contraseña existente; el mismo email confundiría. |
| D17 | Caducidad del enlace de reset | La de Supabase OTP (por defecto 1 h) · fijar 30 min | **La de Supabase (1 h)**; se documenta. Si el propietario quiere 30 min, se cambia en Auth y se refleja en el email. |
| D18 | Registro de la migración | Solo el estado del QR · auditoría en `events` | **Solo el estado** (`device_transfers`), sin evento de realtime ni push; el usuario ya está en el móvil nuevo. |
| D19 | Orden de merge | Sprint 16 primero, sprint 17 (panel/notificaciones) después · al revés | **16 primero**; el 17 es independiente y se renumera, no se pierde. |
| D20 | APK de prueba | Release firmada del sprint · debug por LAN | **Release firmada** para App Links y QR; el debug sigue usando `027apps-dev://` y no verifica el host. |

## 5. Modelo de datos

### 5.1 `public.invitations` (migración `0035_invitation_role_ttl.sql`)

Se añaden dos columnas; no se toca el token, el hash ni las políticas RLS existentes.

```sql
alter table public.invitations
  add column role text not null default 'user'
    check (role in ('user', 'admin'));

alter table public.invitations
  add column expires_in_days integer;

update public.invitations
   set expires_in_days = greatest(
     1,
     least(365, ceil(extract(epoch from (expires_at - created_at)) / 86400.0)::int)
   )
 where expires_in_days is null;

alter table public.invitations
  alter column expires_in_days set not null,
  alter column expires_in_days set default 7,
  add constraint invitations_expires_in_days_check
    check (expires_in_days between 1 and 365);
```

- `role` es el rol **del perfil que se crea** al canjear. Nunca `super_admin`.
- `expires_in_days` es la duración con la que se creó; la renovación la reutiliza.
- Las filas existentes reciben la diferencia real entre `expires_at` y `created_at`, no un 7 fijo.
- La vista (`InvitationView`) expone `role` y `expires_in_days`.
- `createInvitation` guarda `expires_in_days` y valida el rol en el servicio, no solo en el borde.
- `redeemInvitation` inserta el perfil con el rol de la invitación **solo si el perfil es nuevo**;
  un perfil existente conserva su rol.

### 5.2 `public.device_transfers` (migración `0036_device_transfers.sql`)

```sql
create table public.device_transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

alter table public.device_transfers enable row level security;

-- Solo el pool de servicio escribe y lee: es una credencial bearer.
revoke all on public.device_transfers from anon, authenticated;

create index device_transfers_user_recent_idx
  on public.device_transfers (user_id, created_at desc);
```

- No hay `grant` a `authenticated`: la tabla no se expone por PostgREST. El servicio usa el pool de
  servicio, igual que `rate_limit_counters`.
- `code_hash` es SHA-256 de `027_mig_` + 32 bytes base64url; el token solo se devuelve al crearlo.
- No se guarda email, refresh token, contraseña ni push token en la fila.
- Limpieza oportunista al crear: `delete from public.device_transfers where user_id = $1 and
  (used_at is not null or expires_at < now() - interval '1 day')`. No se añade cron.

### 5.3 Migraciones y rollback

- Las migraciones son aditivas y compatibles hacia atrás (expand): el admin anterior sigue leyendo
  `invitations` sin las columnas nuevas; el nuevo escribe con ellas.
- No hay `down`; el rollback es una migración nueva hacia delante (flujo de CI/CD).
- `pnpm --filter db-tests test` sobre Supabase local antes del PR; `supabase db reset` limpio.

## 6. Contrato de API

### 6.1 Convenciones

- Todas las rutas cuelgan de `/api/v1`; el sobre de error es el de ADR 0007
  (`{ error: { code, message, request_id, details? } }`).
- Los endpoints públicos no llevan sesión; el rate limit es por IP. Los de sesión usan el door con
  los scopes indicados.
- Los tokens (`027_inv_`, `027_mig_`) viajan solo en el path; nunca en query, body, logs ni
  `Referer`. El logger ya redacta el path (`routeOf`); se añade una prueba para las rutas nuevas.
- `Cache-Control: no-store`, `X-Robots-Tag: noindex` y `Referrer-Policy: no-referrer` en todas las
  respuestas con token o PII.

### 6.2 Vista previa pública (A2)

**`GET /api/v1/invitations/{token}/preview`** · pública · rate limit 60/min por IP.

Respuesta 200:

```json
{
  "invitation": {
    "state": "pending",
    "email": "ana@example.com",
    "name": "Ana",
    "role": "user",
    "role_applies": true,
    "account_exists": false,
    "locale": "es",
    "expires_at": "2026-11-23T18:00:00.000Z",
    "inviter_name": "Eric",
    "instance_name": "Familia Pérez",
    "timezone": "Europe/Madrid"
  }
}
```

- `state`: `pending` | `expired` | `used`. `revoked` y desconocido son `404 not_found`, iguales
  entre sí (no se enumera).
- `role_applies`: `false` cuando `account_exists` es `true` (D6).
- No devuelve `id`, hash, módulos, categorías ni el rol actual de una cuenta existente.
- Si el token no empieza por `027_inv_` o supera 200 caracteres: `404 not_found`.
- `state = used` y `expired` se devuelven con 200 porque el portador del token ya conoce la
  invitación y la UI necesita explicar qué pasó; no se revela nada de otra persona.
- La web usa el mismo servicio en el servidor (sin salto HTTP); el endpoint existe para la app y
  terceros. La página aplica su propio límite de 60/min por IP (`invite-page:<ip>`) antes de leer
  el preview, para que el render público no sea una vía sin límite.
- `inviter_name` es `null` si la invitación la creó una clave de servicio; la UI usa el nombre de la
  instancia.
- `instance_name` cae a `027Apps` y `timezone` a `UTC` si faltan ajustes.

Errores: `404 not_found` (desconocida, revocada o token mal formado), `429 rate_limited`.

### 6.3 Crear invitación (modifica el contrato existente)

**`POST /api/v1/invitations`** · sesión · `invitations:write`.

Body (añade `role`; `expires_in_days` ya existía):

```json
{
  "email": "ana@example.com",
  "name": "Ana",
  "role": "user",
  "expires_in_days": 7,
  "user_category_id": null,
  "modules": [],
  "locale": "es",
  "delivery": "email"
}
```

- `role` por defecto `user`; solo una **sesión** `super_admin` o una **clave de servicio** con
  `roleCap: "super_admin"` puede enviar `admin`. Una clave **delegada** nunca crea invitaciones de
  admin (representa a un usuario y no debe escalar), aunque su `roleCap` sea `super_admin`. Un
  `admin` que envíe `admin` recibe `403 insufficient_scope`. `super_admin` como valor es
  `400 validation_failed`.
- **Ya no se rechaza un email registrado**: se permite invitar a una cuenta existente. Sigue
  prohibido duplicar una invitación pendiente para el mismo email (`409 pending_invitation`).
- La respuesta 201 añade `account_exists` (calculado con el puerto de Auth) y `invitation.role` /
  `invitation.expires_in_days`, para que el panel explique el caso.
- `expires_in_days` se guarda en la fila y se usa en la renovación.

### 6.4 Canjear (modifica el contrato existente)

**`POST /api/v1/invitations/{token}/redeem`** · pública · 30/min por IP.

Body:

```json
{ "email": "ana@example.com", "password": "…" }
```

- `display_name` queda **ignorado** y obsoleto: el nombre sale siempre de la invitación (A5). Se
  mantiene en el esquema por compatibilidad, pero el servicio no lo usa.
- Cuenta nueva: `password` 12–200; se crea el perfil con `role` de la invitación y el nombre de la
  invitación.
- Cuenta existente: `password` 1–200 y **se verifica contra Supabase Auth** antes de consumir la
  invitación. Si no coincide: `409 invitation_password_invalid`; la invitación no se marca usada.
- Cuenta existente: se conserva su contraseña, su nombre y su rol; solo se materializan categoría y
  módulos.
- Cuenta desactivada: `409 conflict` (no se canjea).
- Respuesta 201: `{ user: { id, email, display_name, role }, invitation_id }`. `role` es el rol
  efectivo del perfil, que la web usa para decidir A1.
- Sigue siendo single-use con `for update` y sigue borrando el usuario de Auth creado si la
  transacción falla.
- El email debe coincidir con el de la invitación (`validation_failed`), como hoy.

### 6.5 Renovar una invitación caducada (A3)

**`POST /api/v1/invitations/{id}/renew`** · sesión · `invitations:write` · uuid.

- Solo si `used_at is null`, `revoked_at is null` y `expires_at <= now()`; si no,
  `409 invitation_not_expired` (nuevo código) o `invitation_used`.
- Rota el token (el anterior deja de valer), pone `expires_at = now + expires_in_days`, limpia
  `email_sent_at`/`email_failed_at`/`email_error` y envía el email.
- Comparte el cooldown de 60 s de `resendCooldownSeconds`: si se intenta antes,
  `429 rate_limited` con `retry_after`.
- Respuesta 200: `{ invitation, token, email }`; el token se muestra una vez para copiar si el
  email falla.
- El panel solo ofrece «Renovar» en invitaciones caducadas, con confirmación porque invalida el
  enlace anterior.

### 6.6 Migración de teléfono (QR)

**`POST /api/v1/me/device-transfers`** · sesión · 5/min por usuario.

- Crea un código `027_mig_` + 32 bytes base64url, TTL 60 s, guarda solo el SHA-256.
- Respuesta 201: `{ transfer: { id, expires_at }, token, path: "/migrate/<token>" }`. El token se
  devuelve una sola vez.
- Solo sesiones de usuario (no claves de servicio).

**`GET /api/v1/me/device-transfers/{id}`** · sesión · 60/min.

- Estado para el móvil viejo: `{ transfer: { id, state: "pending"|"used"|"expired", expires_at,
  used_at } }`.
- Solo el dueño; otro id → `404 not_found`.

**`POST /api/v1/device-transfers/{token}/exchange`** · pública · 10/min por IP y 5 intentos por
token.

- Valida el token, el `for update`, el TTL, el single-use y que el perfil esté activo.
- Acuña un magic link con `auth.admin.generateLink({ type: "magiclink", email })` y devuelve solo:
  `{ transfer_id, email, token_hash, expires_at }`.
- **No devuelve** el `action_link`, ni un refresh token, ni una sesión; la app canjea el
  `token_hash` contra Supabase Auth con `verifyOtp`.
- Marca `used_at = now()` en la misma transacción. Si `generateLink` falla, no se marca usada y se
  puede reintentar mientras el QR viva.
- Token inválido, caducado, usado o perfil inactivo → `404 not_found` (el cliente pide otro QR).
- Respuesta con `Cache-Control: no-store` y sin logs del token ni del hash.

**`POST /api/v1/me/devices/revoke-others`** · sesión · `devices:revoke`.

- Body `{ keep_device_id: "uuid" }`; marca `revoked_at` en los demás dispositivos del usuario.
- **No borra `auth.sessions`**: el cliente llama `signOut({ scope: "OTHERS" })` para expulsar al
  móvil viejo. Separar las dos cosas evita que el servidor revoque también la sesión nueva.
- Respuesta `{ revoked: 2 }`; un `keep_device_id` que no es del usuario → `404 not_found`.

**`DELETE /api/v1/devices/{id}?sessions=all|local`** · sesión · `devices:revoke` (cambio).

- `all` (por defecto, compatible): marca el dispositivo revocado y borra `auth.sessions` del
  usuario; es la expulsión que usa el panel.
- `local`: solo marca el dispositivo revocado; **no** toca `auth.sessions`. Es el logout del propio
  móvil, que cierra su sesión con `signOut(LOCAL)` sin cerrar la web ni los demás móviles.
- `sessions=local` solo se acepta cuando el llamante es el dueño del dispositivo; un admin que
  revoca el dispositivo de otra persona recibe siempre `all` (no puede degradar la expulsión).
- OpenAPI documenta el query; el panel no cambia su llamada (sin query = `all`).

### 6.7 Errores nuevos

| Código | HTTP | Cuándo |
|---|---|---|
| `invitation_password_invalid` | 409 | Cuenta existente y la contraseña no verifica. |
| `invitation_not_expired` | 409 | `renew` sobre una invitación aún vigente. |

No se añaden códigos para el QR: un token inválido, usado o caducado es `not_found` y la UI dice
«caducado o ya usado, genera otro».

### 6.8 OpenAPI

- Nuevas operaciones: preview, renew, device-transfer create/status/exchange, revoke-others.
- Se actualizan: `POST /invitations` (role, response con `account_exists`), `POST
  /invitations/{id}/redeem` (role, error nuevo) y `DELETE /devices/{id}` (query `sessions`).
- `pnpm --filter core openapi:generate` regenera `docs/api/openapi.json`; `pnpm check:openapi`
  exige paridad ruta ↔ operación. La recuperación no añade operación (D14).
- Los schemas nuevos viven en `packages/core/src/openapi/schemas.ts` y el registro en
  `registry.ts`; los tests de `generate.test.ts` cubren las rutas nuevas.

## 7. Flujos

### 7.1 Aceptación app-first

1. El administrador crea la invitación; el email lleva `https://<instancia>/invite/<token>`.
2. Android con el App Link verificado abre la app directamente. Si no, se abre la web (7.2).
3. La app parsea el enlace, llama a `GET /invitations/{token}/preview` y muestra:
   - wordmark + `instance_name`; email, nombre, instancia, `inviter_name`, caducidad y rol
     bloqueados;
   - contraseña + confirmación (cuenta nueva) o solo contraseña existente (cuenta existente);
   - estado de la invitación si está caducada, usada o inválida, sin formulario.
4. Al enviar: `POST /invitations/{token}/redeem`; si 201, la app hace
   `signInWithPassword(email, password)` y entra al shell. Si el canje fue bien y el login falla,
   muestra «cuenta creada, inicia sesión» y lleva al login; **no** reintenta el canje (la
   invitación ya está usada).
5. La app recuerda la instancia del enlace y registra el push como hoy.
6. El token no se pinta, no se guarda y no se registra.

### 7.2 Wizard web

Ruta `/invite/[token]`, pública, `instant = false`, `noindex`, `no-referrer`. La página resuelve el
preview en el servidor (mismo servicio que el endpoint) y renderiza según el estado.

| Paso | Android sin app | iPhone | Escritorio |
|---|---|---|---|
| 1. Aviso | «La app es solo para Android 8+. Puedes aceptar aquí.» + descarga + abrir en app + continuar | «La app es solo para Android; acepta aquí.» + continuar | «Abre la invitación en tu móvil» + QR + continuar |
| 2. Descarga | Botón `/download/android`, versión, instrucciones de orígenes desconocidos, «Ya la he instalado» | — | — |
| 3. Reintento | «Abrir en la app» (esquema `027apps://invite/<token>?instance=…`) con timeout de 1,5 s; si no abre, reintentar / volver a descargar / continuar | — | — |
| 4. Formulario | Campos bloqueados + contraseña/confirmación, o contraseña existente | igual | igual |

- El aviso del propietario se muestra literal en español y se traduce a los 9 idiomas: «Por ahora
  solo existe la app Android (8+). En iPhone u ordenador puedes aceptar la invitación en el
  navegador.»
- «Continuar en el navegador» está siempre visible; el wizard nunca bloquea el canje.
- El QR de escritorio codifica la misma URL de invitación y se genera en el servidor con `qrcode`
  (sin servicios externos).
- El clic en «Abrir en la app» no redirige solo al cargar la página; solo tras una acción del
  usuario y con timeout, para no crear un bucle.
- Si el preview es `used`: «Ya se aceptó; inicia sesión». Si `expired`: «Caducó; pide una nueva».
  Si es inválida/revocada: tarjeta genérica, igual que hoy.
- El formulario bloquea email y nombre; muestra instancia, invitador, caducidad y rol. Para cuenta
  existente pide la contraseña actual y no muestra confirmación.
- El submit usa el endpoint público de canje (mismo rate limit y CSRF que hoy) y, si A1 está
  aprobado, llama a la server action `signInAfterRedeem` (7.4).

### 7.3 Cuenta existente (A7)

- El preview devuelve `account_exists: true` y `role_applies: false`.
- El formulario cambia a «Contraseña actual»; sin confirmación; `autocomplete="current-password"`.
- El Core verifica la contraseña existente contra Supabase Auth antes de consumir la invitación. Si
  falla, error inline y la invitación sigue pendiente.
- La cuenta conserva contraseña, nombre y rol; se añaden categoría/módulos de la invitación.
- El email de invitación usa la variante «ya tienes cuenta» (D16): CTA «Entra y acepta», nota
  «tu contraseña no cambia».
- El panel puede invitar a un email existente; la respuesta 201 incluye `account_exists` y el panel
  lo explica.

### 7.4 A1 — Auto-login web (propuesto)

- Solo para el rol efectivo `admin`/`super_admin` (D2).
- La server action `signInAfterRedeem({ token, email, password })`:
  1. valida zod y origen (Next server action);
  2. comprueba que la invitación del token está `used` y que su email coincide (no es un login
     genérico);
  3. `signInWithPassword` con el cliente SSR (cookies HttpOnly);
  4. devuelve `{ role }`; el cliente va a `/panel`.
- Para `user`: la action no inicia sesión; el cliente va a `/welcome`, una página pública con
  «Cuenta creada» + descarga de la app + enlace a login.
- Si el login posterior falla: `/welcome?notice=signin_failed`; el canje no se repite.
- Si A1 se rechaza: el flujo actual (`/login?notice=invitation-redeemed`) se mantiene y
  `/welcome` no se usa.

### 7.5 Renovación (A3)

- El detalle de la invitación caducada muestra «Renovar» con confirmación.
- `POST /invitations/{id}/renew` rota el token, reusa `expires_in_days`, reenvía el email y
  devuelve el token una vez.
- Si el email falla, el panel muestra el token y el error; el enlace anterior ya no vale.
- La lista sigue arrancando en `pending`; una invitación renovada vuelve a `pending`.
- No se renueva una usada ni una revocada.

### 7.6 Recuperación de contraseña

Rutas nuevas: `/forgot-password` y `/auth/confirm` (route handler) son públicas; `/reset-password`
exige la sesión de recuperación y **no** se añade a `isPublicPath` (el proxy refresca su cookie).

1. `/login` muestra «¿Olvidaste tu contraseña?» → `/forgot-password` (localizado, D7).
2. La persona escribe su email; la server action llama al servicio de Core
   `requestPasswordReset`.
3. El servicio:
   - normaliza el email y aplica `recovery:ip:<ip>` (5/h) y `recovery:email:<sha256>` (3/h);
   - busca la cuenta y su perfil; si no existe o está desactivado, **no envía** y responde igual;
   - acuña un token de recuperación con Supabase Admin `generateLink({ type: "recovery", email })`;
   - renderiza el email propio (9 idiomas) con el enlace
     `https://<public_url>/auth/confirm?token_hash=…&type=recovery&next=%2Freset-password`;
   - nunca revela si el email existe; el UI dice siempre «Si ese email tiene cuenta, recibirás un
     enlace».
4. `/auth/confirm` valida `type === "recovery"` y que `next` sea exactamente `/reset-password`
   (allowlist); `verifyOtp({ type: "recovery", token_hash })` con el cliente SSR, que fija cookies;
   redirige a `/reset-password`. Un token inválido/caducado muestra un enlace a
   `/forgot-password`.
5. `/reset-password` exige una sesión de recuperación (`getUser`); formulario de contraseña +
   confirmación (12–200); `updateUser({ password })`; `signOut({ scope: "others" })` para revocar
   las demás sesiones; `signOut({ scope: "local" })` y `/login?notice=password-reset` (D8).
6. La app añade «¿Olvidaste tu contraseña?» en el login; abre
   `https://<instancia>/forgot-password` en el navegador. No hay reset dentro de la app.
7. Rate limit del submit de reset: `reset:<userId>` 5/5 min, además del enlace de un solo uso.

No se usan las plantillas de email de Supabase (una sola plantilla, un solo idioma); se usa
`generateLink` solo para acuñar el token. No hace falta configurar redirect URLs de Supabase.

### 7.7 Migración de teléfono (solo Android)

1. Móvil viejo, con sesión: Ajustes → «Mover a otro teléfono». La app pide
   `POST /me/device-transfers`, compone la URL `https://<instancia>/migrate/<token>` y muestra el
   QR (ZXing), la instancia, la cuenta y una cuenta atrás de 60 s. La pantalla lleva `FLAG_SECURE`
   (sin capturas ni miniatura en recientes).
2. Móvil nuevo, app instalada y **sin sesión**: Ajustes/login → «Mover desde otro teléfono» abre el
   escáner de la app (cámara). También vale la cámara del sistema: el QR es un App Link
   `/migrate/`, y la app lo abre.
3. La app parsea el token, llama a `POST /device-transfers/{token}/exchange`, recibe
   `token_hash` y hace `verifyOtp(OtpType.Email.MAGIC_LINK, token_hash)`, que crea la sesión.
4. La app carga `/me`, registra su push (nuevo `device_id`) y llama a
   `POST /me/devices/revoke-others` con su `keep_device_id`; después
   `signOut({ scope: "OTHERS" })` para revocar las sesiones del viejo.
5. El móvil viejo, que está haciendo polling de `GET /me/device-transfers/{id}`, ve `used` y borra
   su sesión local; si está cerrado, el siguiente arranque fuerza un refresco, recibe 401 y lo
   clasifica como revocado. En ambos casos termina en login con «este teléfono ya no tiene sesión».
   Mientras no arranque, su access JWT puede seguir válido hasta 15 min, como en toda revocación de
   dispositivo; no puede renovarlo.
6. Si el QR caduca: «Genera otro»; el viejo puede crear uno nuevo. Si se usa dos veces: 404
   genérico. Si el móvil nuevo ya tiene sesión: «Cierra sesión primero» (no se cambia de cuenta en
   silencio).
7. El QR no lleva refresh token, contraseña ni email; el token es bearer con TTL 60 s y un solo uso.
   El `token_hash` del magic link es de un solo uso y caduca según Supabase OTP (1 h).
8. Solo Android: el panel y la web no ofrecen migración; la app lo advierte.

### 7.8 Ciclo de sesión

#### Web

- `signOutAction` → `signOut({ scope: "local" })`. El logout del panel ya no revoca el móvil.
- `/logout` (route handler GET, solo mismo origen) limpia la sesión local y redirige a
  `/login?reason=…`. Es la salida cuando el perfil no es usable.
- `requirePanel` distingue tres casos: sin sesión → `/login`; sesión sin perfil activo →
  `/logout?reason=access_revoked`; perfil sin rol suficiente → 403. El bucle `/panel ↔ /login`
  desaparece.
- El proxy, ante un fallo de red de Supabase, devuelve 503 reintentable y **no borra cookies**; solo
  trata como cierre una respuesta de refresh inválida (`invalid_grant`, `session_not_found`).
  `/login`, `/setup`, `/panel` siguen pasando por el gate; las páginas públicas no tocan Supabase.
- La desactivación borra `auth.sessions` (mejor esfuerzo) además de revocar claves y dispositivos;
  el bloqueo inmediato ya lo hace `profiles.deactivated_at is null` en el door y el guard.

#### App

- `ApiClient` distingue tres resultados de refresh: `Refreshed`, `NoSession` (refresh inválido o
  revocado) y `Network` (IO/timeout/5xx). En 401:
  - `Refreshed` → reintenta una vez;
  - `NoSession` → error `unauthorized` con `revoked = true`;
  - `Network` → error de red, sin borrar nada.
- `boot()`:
  - sin sesión guardada → login;
  - con sesión guardada, intenta `refreshCurrentSession()` antes de `me()`: cierra la ventana de
    15 min de un access token ya revocado (migración/revocación) en el siguiente arranque;
  - `me()` ok → shell;
  - 401 tras refrescar o refresh inválido → borra la sesión y login con aviso «sesión revocada»;
  - red/5xx → pantalla de reintento, **conserva la sesión**; al reintentar entra si vuelve la red;
  - un `awaitInitialization` que falla por red no borra la sesión; uno que falla por token inválido
    sí.
- `signOut()` y `changeInstance()` usan `SignOutScope.LOCAL` explícito y `FcmRegistrar.revoke()`
  llama `DELETE /devices/{id}?sessions=local`: la baja del push no borra las sesiones de otros
  dispositivos.
- Un logout en la web (local) no toca la sesión del móvil; un logout en el móvil no toca la web ni
  los demás móviles.
- La única pérdida documentada de sesión es perder la clave del Keystore (reinstalar/restaurar) o
  una expulsión.

## 8. Estados

### 8.1 Estados de la invitación (web y app)

| Estado | Preview | Web | App |
|---|---|---|---|
| `pending`, cuenta nueva | `account_exists=false` | wizard → formulario con confirmación | formulario con confirmación |
| `pending`, cuenta existente | `account_exists=true` | wizard → formulario con contraseña actual | formulario con contraseña actual |
| `expired` | `state=expired` | tarjeta «caducó»; el panel puede renovar | tarjeta «caducó» |
| `used` | `state=used` | tarjeta «ya aceptada» + login | tarjeta «ya aceptada» + login |
| inválida/revocada | `404` | tarjeta genérica | tarjeta genérica |
| contraseña existente incorrecta | — | error inline, sin consumir | error inline, sin consumir |
| canje ok, login falla | — | `/welcome?notice=signin_failed` | login con aviso |
| red | — | alerta y reintento manual | reintento, sesión conservada |
| rate limit | — | espera y reintento | espera y reintento |

Textos y códigos idénticos en web y app; el copy se traduce, el `code` no.

### 8.2 Máquina de sesión de la app

```
Loading
  ├─ sin sesión guardada → NeedsLogin(null)
  ├─ sesión guardada
  │    ├─ me() ok → SignedIn
  │    ├─ 401 tras refresh / refresh inválido → limpiar → NeedsLogin(revoked)
  │    ├─ red/timeout/5xx → Offline(session=true) [Retry]
  │    └─ perfil desactivado/borrado → limpiar → NeedsLogin(revoked)
  └─ error de instancia/auth → Failure(retry)
Offline --Retry--> Loading
SignedIn --logout local--> NeedsLogin(null)
SignedIn --401 revocado--> NeedsLogin(revoked)
```

`NeedsLogin` lleva un `reason` opcional (`revoked`, `invitation_accepted`, `password_reset`) para el
aviso de la pantalla de login. `Offline` nunca borra la sesión.

### 8.3 Sesión web

```
sin cookie → /login
cookie válida + perfil activo + rol → /panel
cookie válida + perfil inactivo/ausente → /logout?reason=access_revoked → /login
cookie inválida → /login (el proxy no borra por red)
Supabase caído → 503 reintentable (sin borrar cookie)
```

## 9. Seguridad

### 9.1 Controles por punto OWASP (checklist `docs/conventions/security-checklist.md`)

| Punto | Control |
|---|---|
| A01 acceso | Preview y canje son públicos solo por token; el resto exige sesión y scope. `role` se valida en el servicio. `renew` y `revoke-others` comprueban propiedad/rol. `device_transfers` sin grants a `authenticated`. |
| A02 cripto/exposición | Tokens solo SHA-256 en BD; `token_hash` de Supabase nunca se registra; respuestas sin ids internos ni módulos; `no-store`; errores sin detalles internos. |
| A03 inyección | Zod en todos los bordes (API y server actions); SQL parametrizado; sin HTML/URL sin sanear; `next` de reset en allowlist. |
| A04 diseño/abuso | Rate limits por IP, usuario, email y token; cooldown de reenvío; single-use con `for update`; QR de 60 s; sin enumeración en recuperación; el wizard no redirige solo. |
| A05 configuración | `SUPABASE_SERVICE_ROLE_KEY` solo servidor; `ANDROID_APP_SHA256` es pública; `RESEND_API_KEY` solo servidor; CSP intacta; cookies HttpOnly/Secure/SameSite. |
| A06 componentes | Dependencias nuevas justificadas (ZXing, `qrcode`), con licencia y versión fijada; CI de terceros por SHA; sin paquetes abandonados. |
| A07 auth/sesión | Logout local explícito; refresh clasificado; expulsión por desactivación/borrado/revocación; reset revoca otras sesiones; magic link de un solo uso; sesión cifrada con Keystore; `allowBackup=false`. |
| A08 integridad | Migraciones aditivas; token rotado en renovación; QR hash; sin reutilización; OpenAPI al día; `pnpm check:openapi`. |
| A09 logs | Tokens, emails, contraseñas y `token_hash` fuera de logs; `request_id` sí; alertas de fallos de email/reset sin PII. |
| A10 SSRF | El reset usa `instance.public_url`, no el `Host` de la petición; el APK se sirve del release publicado, no de una URL del cliente. |
| A11 Android | Keystore, sin tokens en logs, `FLAG_SECURE` en el QR, permiso de cámara solo en el escáner, sin backup, HTTPS en release, App Links verificados. |

### 9.2 Tokens y PII

- `027_inv_` y `027_mig_` solo en el path; `Referrer-Policy: no-referrer`; el historial del
  navegador se reemplaza tras el canje (`router.replace`).
- El email del preview es PII; el endpoint exige el token, no se cachea y no se indexa. El token se
  envió a ese email; el portador se presume legítimo.
- El QR no lleva email, contraseña, refresh token ni push token.
- El magic link se acuña en el servidor y se entrega a la app sobre HTTPS; no se pinta ni se guarda.
- La pantalla del QR del móvil viejo usa `FLAG_SECURE`; el bitmap no se guarda en disco.

### 9.3 Superficies públicas nuevas

| Ruta | Cache | Index | Referrer | Rate limit |
|---|---|---|---|---|
| `GET /invitations/{token}/preview` | no-store | noindex | no-referrer | 60/min IP |
| `POST /invitations/{token}/redeem` | no-store | — | — | 30/min IP |
| `POST /device-transfers/{token}/exchange` | no-store | noindex | no-referrer | 10/min IP + 5/token |
| `/forgot-password` | no-store | noindex | no-referrer | server action 5/h IP + 3/h email |
| `/auth/confirm` | no-store | noindex | no-referrer | token de un solo uso |
| `/reset-password` | no-store | noindex | no-referrer | 5/5 min por usuario (sesión de recuperación) |
| `/migrate/[token]` | no-store | noindex | no-referrer | no canjea en web |
| `/welcome` | público | noindex | — | — |

`/welcome` es una página de éxito sin token; puede ser `noindex` por prudencia. `/reset-password`
no es pública: queda fuera de `isPublicPath` para que el proxy refresque la cookie de la sesión de
recuperación; sin sesión, la propia página redirige a `/forgot-password`.

### 9.4 CSRF y redirects

- Las mutaciones de `/api/v1` siguen pasando por `isSameOriginMutation`.
- Las server actions de Next validan origen; además, `signInAfterRedeem` exige que la invitación
  esté usada por ese email y `resetPassword` exige sesión de recuperación.
- `/logout` solo acepta navegación de mismo origen (`Sec-Fetch-Site: same-origin`/`none`).
- `next` en `/auth/confirm` es exactamente `/reset-password`; cualquier otro valor se ignora.
- No se acepta `redirect_to` ni `returnTo` del usuario en ningún flujo.

### 9.5 App Links

- `ANDROID_APP_SHA256` con el fingerprint del certificado de release (el del APK v0.18.1 o el del
  nuevo APK si se rota la firma); nunca el keystore.
- El intent-filter de release cubre `https://027apps.ericrf.com/invite/` y `/migrate/`; el debug
  usa `027apps-dev://invite` y `027apps-dev://migrate`.
- Verificación real: `adb shell pm get-app-links com.rferic.zero27apps` debe mostrar `verified`
  para el host; `pm verify-app-links --re-verify` si Android cacheó el `[]`.
- Las instancias autoalojadas usan el esquema propio; el App Link https solo se garantiza en el
  host canónico.

## 10. i18n, marca y accesibilidad

- **Web**: todo texto visible pasa por `t("…")`; `pnpm i18n:scan` actualiza el catálogo y los 8
  locales no ingleses se rellenan; `pnpm i18n:check` exige claves y placeholders idénticos.
- **Android**: nuevos campos en `ui/i18n/Strings.kt` para los 9 idiomas; el compilador obliga a
  rellenarlos.
- **Email**: `RECOVERY_COPY` y la variante de invitación existente en los 9 idiomas de
  `packages/core/src/email/`.
- **Marca (A4)**: wordmark/icono + `instance.name` en email, web y app; sin `logo_url`. La
  instancia se lee de `instance.name` (web/email) y del preview (app); fallback `027Apps`.
- **Login (D7)**: se localiza; los avisos `invitation-redeemed`, `password-reset`,
  `access-revoked` y `session-expired` se traducen.
- **Accesibilidad**: campos bloqueados con `readOnly`/`aria-readonly` (no `disabled` para que se
  puedan leer y copiar); errores con `aria-describedby`/`aria-invalid`; foco visible; botones
  ≥ 44 px en web y 48 dp en app; contraste AA en claro y oscuro; el QR tiene texto alternativo y
  la cuenta atrás no depende solo del color.
- **Fechas**: caducidad con el locale y la zona de la instancia (`timezone` del preview), no con la
  del navegador por defecto (ADR 0008).

## 11. Pruebas

### 11.1 Core (vitest, `packages/core`)

- `revokeDevice`: `sessions=all` llama al puerto de sesiones; `sessions=local` no; un admin que
  revoca a otro fuerza `all`; el dueño puede `local`.
- `previewInvitation`: pending nueva/existente, expired, used, revocada/desconocida, token mal
  formado, settings ausentes, `role_applies`.
- `createInvitation`: rol `user` por defecto; `admin` solo super_admin (sesión, service y
  delegated); `admin` que intenta `admin` → `insufficient_scope`; `super_admin` → 400; email
  existente permitido; pendiente duplicada; `expires_in_days` guardado; `account_exists` en la
  respuesta y en el mailer.
- `redeemInvitation`: cuenta nueva con rol; cuenta existente con contraseña válida/incorrecta;
  rol/nombre/contraseña conservados; `display_name` ignorado; desactivada; single-use; borrado del
  usuario de Auth si falla la transacción.
- `renewInvitation`: solo caducada; usada/revocada; TTL original; rotación; cooldown.
- `device-transfers`: crear, TTL, hash, estado, exchange válido/caducado/usado/perfil inactivo,
  `revoke-others`, aislamiento por usuario.
- `password-recovery`: sin cuenta no envía; desactivada no envía; límites; locale; fallo del mailer
  no filtra; URL con `public_url`.
- Errores nuevos en `errors.test.ts`; rutas nuevas en `openapi/generate.test.ts`.

### 11.2 Base de datos (`packages/db-tests`)

- Migración `0035` aplica y rellena `expires_in_days` con la diferencia real.
- Migración `0036` crea la tabla; `anon`/`authenticated` no pueden leerla ni escribirla; el pool de
  servicio sí.
- Canje con rol: perfil nuevo `admin`; perfil existente conserva el rol.
- Transfer exchange con `for update`: dos intentos concurrentes, uno gana.
- Desactivación: el perfil queda inactivo y el puerto de revocación se llama (test de unidad del
  servicio con spy); la integración de `auth.sessions` se prueba en el adaptador.

### 11.3 Web (`apps/admin`)

- Página `/invite/[token]`: preview pending/expired/used/inválida; wizard Android/iPhone/escritorio;
  formulario con campos bloqueados; cuenta nueva vs existente; confirmación solo en nueva.
- `submitInvite` + `signInAfterRedeem` (mock): panel → `/panel`; `user` → `/welcome`; fallo de
  login → aviso; A1 apagado → login actual.
- `/forgot-password`, `/auth/confirm` (mock `verifyOtp`), `/reset-password` (mock `updateUser` y
  `signOut`), `next` no permitido.
- `/logout` mismo origen; `/panel` con perfil inactivo va a `/logout`; `entryGate` no hace bucle.
- `signOutAction` usa `scope: "local"`; `signOutAfterReset` usa `others` y luego `local`.
- `DELETE /devices/{id}?sessions=local` no borra `auth.sessions`; sin query (`all`) sí; un admin
  forzando `local` sobre otro usuario recibe `all`.
- Proxy: fallo de red → 503 sin borrar cookies; `invalid_grant` → limpia.
- OpenAPI: `pnpm check:openapi` en verde.

### 11.4 Android (`apps/android`)

- `MigrationLink.parse`: https, esquema propio, debug, token inválido, http rechazado en release.
- `InvitationPreview` DTO y mapeo de estados.
- `ApiClient`: 401 → `Refreshed` reintenta; `NoSession` lanza `unauthorized` con `revoked`;
  `Network` lanza red sin borrar.
- `AppViewModel.boot`: sin sesión; sesión válida; 401; red (conserva); 5xx (conserva); perfil
  desactivado.
- `acceptInvite`: precarga, nombre bloqueado, confirmación, cuenta existente, fallo posterior al
  canje, sin reintento de canje.
- `signOut` y `changeInstance` con `LOCAL`; el `FcmRegistrar.revoke()` usa `sessions=local`;
  migración con `OTHERS`.
- `QrPayload`: URL y esquema; `FcmRegistrar.deviceId`.
- `./gradlew :app:testDebugUnitTest :app:assembleDebug`.

### 11.5 Verificación real (no solo tests)

- `scripts/verify-local.sh` con sesión real; rutas nuevas 200/201 y sin errores.
- `pnpm lint && pnpm tsc && pnpm test && pnpm i18n:check && pnpm --filter admin build`.
- `pnpm --filter db-tests test` sobre Supabase local limpio.
- Android: instalar la release firmada en un dispositivo real; `pm get-app-links`; abrir el enlace
  del email; formulario precargado; cuenta creada; sesión iniciada.
- Sesión: reinicio, modo avión, actualización, logout web (móvil sigue), logout móvil (web sigue),
  desactivación, borrado, revocación.
- Recuperación: email real, enlace, nueva contraseña, login; sin enumeración.
- QR: dos dispositivos reales; el nuevo entra; el viejo queda fuera; el código caduca y no se
  reutiliza; el dispositivo viejo deja de recibir push.
- `assetlinks.json` con el fingerprint; `/download/android` sirve el APK.
- `lerd diag browser_toggle` + `request lenses` en las páginas nuevas (web) sin incidencias.

### 11.6 Evidencia

La salida de los comandos, los `adb`, los `curl` (tokens redactados) y las capturas se pegan en la
tarea/PR. Un fallo encontrado se convierte en test de regresión o comprobación de
`scripts/verify-local.sh`, no en una nota mental.

## 12. Observabilidad y operación

- Logs con `request_id`, ruta redactada y código; nunca token, email, contraseña ni `token_hash`.
- Fallos de email (invitación y reset) se registran con un código corto (`email_timeout`,
  `email_provider_error`, `email_missing_public_url`) y se muestran en el panel como hoy.
- La tabla `device_transfers` se limpia de forma oportunista; no hay cron nuevo.
- Límite de Resend 30/h: los rate limits de invitación (cooldown 60 s) y reset (3/h por email)
  evitan agotarlo en un uso normal.
- La revocación de sesiones por desactivación es mejor esfuerzo; el bloqueo efectivo es el perfil.

## 13. Puertas y entregables

| # | Puerta | Quién | Cuándo |
|---|---|---|---|
| P1 | Aprobar alcance (hecho) y esta spec + el plan | Propietario | Antes de mockups |
| P2 | Aprobar mockups de app, wizard, QR y reset | Propietario | Antes de UI (tarea 02) |
| P3 | Poner `ANDROID_APP_SHA256` en Vercel Production (y Preview si se prueba) y redesplegar | Propietario | Antes de la verificación de App Links |
| P4 | Facilitar un Android real para App Links y dos para el QR | Propietario | Antes de tareas 05/10 |
| P5 | Confirmar la variante de recuperación (D3) y `RESEND_API_KEY`/`EMAIL_FROM` en producción | Propietario | Antes de la tarea 08 |
| P6 | Confirmar D1–D20 (A1, login, rol existente, escáner, etc.) | Propietario | Con esta spec |
| P7 | Orden explícita de merge del sprint 16 y del 17 | Propietario | Al final |
| P8 | Orden explícita de promoción `staging → main` | Propietario | Tras aceptar staging |

**Entregables del sprint**: spec + plan + tareas (este PR), mockups, código y tests de las tareas
03–10, docs/flows, OpenAPI, evidencia de verificación y auditoría de seguridad.

## 14. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| El App Link no verifica en el dispositivo | El enlace abre el navegador y el requisito app-first no se ve | P3 + `pm get-app-links`; el esquema propio y la web siguen funcionando; no se anuncia hasta verificar. |
| El fingerprint no coincide con el APK que se instala | Android no abre la app | Verificar el certificado del APK con `apksigner` antes de poner la variable; usar el APK del mismo origen que se instala. |
| El logout global sigue en algún sitio | El móvil pierde la sesión | Buscar `signOut(` y exigir scope explícito en revisión; tests de las acciones; auditoría. |
| El refresh de red se confunde con revocación | El usuario pierde la sesión en modo avión | Clasificación de tres estados y tests con MockEngine; `Offline` conserva la sesión. |
| El bucle del panel no se cierra | Un expulsado no puede volver a entrar | `/logout` + guard de tres casos + test de `entryGate` y del guard. |
| El reset filtra si un email existe | Enumeración | Respuesta y UI idénticas, límites por IP/email, sin logs. |
| El QR se filtra | Sesión de otro | TTL 60 s, single-use, hash, `FLAG_SECURE`, rate limit, magic link de un solo uso. |
| El QR se escanea con Lens y la URL va a Google | Privacidad | Escáner propio recomendado; el TTL y el single-use limitan el daño; se documenta. |
| El rol `admin` se cuela desde un admin | Escalada | Guard en el servicio + tests de sesión/service/delegated; la UI no es la frontera. |
| Una cuenta existente cambia de rol sin querer | Escalada o degradación | D6: el rol no cambia al canjear; el panel lo cambia explícitamente. |
| La renovación invalida un enlace que alguien está usando | Fricción | Confirmación en el panel; el token nuevo se muestra una vez; la invitación usada no se renueva. |
| El email de reset no llega | El usuario no puede recuperar | Resend ya configurado; fallo visible en logs; el UI dice «si existe, recibirás»; soporte puede reenviar. |
| El sprint se alarga | Se descubre tarde | Tareas independientes, aceptación por tarea, gates P2–P5; el 17 no se pierde. |
| La release firmada no está lista | No hay App Link ni QR real | P3/P4; el APK v0.18.1 ya sirve para App Links de invitación; el QR exige el APK del sprint. |

## 15. Mapa de requisitos

| Requisito | Dónde se implementa | Tarea |
|---|---|---|
| Aceptación app-first, precarga y bloqueo | App + preview | 04, 06 |
| Sin app: wizard, aviso Android 8+, descarga, reintento, sin bucle | Web | 07 |
| Escritorio: QR/instrucciones + canje web | Web | 07 |
| Sesión duradera y expulsión limpia | Web + app + proxy + Core | 03 |
| Recuperación de contraseña | Web + Core + email + app link | 08 |
| Migración de teléfono | App + Core + BD + API | 10 |
| A1 auto-login | Web (decisión D2) | 07 |
| A2 preview público | Core + API + web/app | 04 |
| A3 renovar caducadas | Core + panel | 09 |
| A4 marca/instancia | Email + web + app | 04, 09 |
| A5 paridad | Web + app | 06, 07, 09 |
| A6 rol con guardrails | Core + panel + email | 04, 09 |
| A7 email con cuenta | Core + web + app + email | 04, 06, 07, 09 |

## 16. Ficheros que se tocarán (mapa inicial)

- **Core**: `packages/core/src/invitations/{service,api}.ts`, `packages/core/src/device-transfers/*`,
  `packages/core/src/devices/{service,api}.ts`, `packages/core/src/users/service.ts`,
  `packages/core/src/auth/password-recovery.ts`, `packages/core/src/email/*`,
  `packages/core/src/openapi/*`, `packages/core/src/errors.ts`.
- **BD**: `supabase/migrations/0035_invitation_role_ttl.sql`,
  `supabase/migrations/0036_device_transfers.sql`, `packages/db-tests/src/invitations/*`,
  `packages/db-tests/src/devices/*`, `packages/db-tests/src/rls/*`.
- **Web**: `apps/admin/src/app/invite/[token]/*`, `apps/admin/src/app/(auth)/*`,
  `apps/admin/src/app/forgot-password/*`, `apps/admin/src/app/auth/confirm/route.ts`,
  `apps/admin/src/app/reset-password/*`, `apps/admin/src/app/welcome/*`,
  `apps/admin/src/app/migrate/[token]/*`, `apps/admin/src/app/logout/route.ts`,
  `apps/admin/src/app/api/v1/invitations/*`, `apps/admin/src/app/api/v1/device-transfers/*`,
  `apps/admin/src/app/api/v1/me/device-transfers/*`, `apps/admin/src/app/api/v1/me/devices/revoke-others/*`,
  `apps/admin/src/lib/{invitations,invite-*,panel-guard,instance-gate,public-paths,proxy}*`,
  `apps/admin/src/components/invitation-create-form.tsx`,
  `apps/admin/src/app/(panel)/panel/invitations/*`.
- **Android**: `auth/InvitationLink.kt`, `auth/MigrationLink.kt`, `ui/AppViewModel.kt`,
  `ui/AppState.kt`, `ui/AppRoot.kt`, `ui/screens/{InviteScreen,LoginScreen,SettingsScreen}.kt`,
  `ui/components/*`, `ui/i18n/Strings.kt`, `data/{ApiClient,Dtos}.kt`, `FcmRegistrar.kt`,
  `app/build.gradle.kts`, `app/src/main/AndroidManifest.xml`,
  `app/src/release/AndroidManifest.xml`, `Changelog.kt`.
- **Docs**: esta spec, el plan, `docs/tasks/sprint-16-*`, `docs/tasks/README.md`,
  `docs/tasks/sprint-17-*`, `docs/flows/`, `docs/api/openapi.json`, `docs/ai/landing.md` si cambia
  el copy público.
