# Invitaciones

Ciclo completo de una invitación: cómo se crea, qué ve quien la recibe, cómo se canjea desde la
web y desde la app, y qué pasa cuando caduca. Contrato en la spec
[`2026-11-16-invitation-session-migration-design.md`](../superpowers/specs/2026-11-16-invitation-session-migration-design.md)
(§5 y §7.6); tareas en `docs/tasks/sprint-16-invitation-session-and-migration/`.

## Qué resuelve

Un administrador invita a una persona a la instancia con un enlace de un solo uso. El enlace lleva
el grupo y el rol, caduca, y se puede renovar sin pedir otro. Quien lo recibe puede aceptarlo en la
web o en la app: la app es el camino preferido, la web es siempre un camino completo, no un
consuelo para quien no tiene Android.

## Estados

| Estado | Cuándo | Qué permite |
|---|---|---|
| `pending` | creada, no canjeada, `expires_at` en el futuro | canjear, reenviar email, revocar |
| `expired` | pasó `expires_at` sin canjearse | renovar (reusa la duración original), revocar |
| `used` | canjeada | solo consultar; **no** se renueva |
| `revoked` | revocada a mano | nada; queda como histórico |

`GET /api/v1/invitations?status=pending|used|expired|revoked|all` filtra el listado del panel.

## Crear

- Duración: `expires_in_days` entre 1 y 365, por defecto 7. La columna recuerda la duración con la
  que se creó para que una renovación no la resetee.
- Rol: `user` o `admin`. Nunca `super_admin`: lo valida el servicio y la columna solo acepta los
  dos valores.
- El token viaja solo en la URL del enlace; la base guarda su hash. Si se pierde el enlace, se
  **rota** (`/invitations/{id}/link`) en vez de reutilizarlo.
- El email sale en el idioma de la invitación (`locale`) con el nombre de la instancia y del grupo.

## Aceptar

### Preview (público, sin sesión)

`GET /api/v1/invitations/{id}/preview` devuelve lo mismo que necesita cualquier pantalla para
pintar el formulario: `state`, `email`, `name`, `role`, `role_applies`, `account_exists`, `locale`,
`expires_at`, `inviter_name`, `instance_name` y `timezone`. No revela si la cuenta existe más allá
de `account_exists`, que el formulario necesita para no pedir una contraseña que no toca.

### Cuenta nueva

1. La app (o la web) muestra el formulario con nombre, email y contraseña.
2. `POST /api/v1/invitations/{id}/redeem` crea el usuario de Auth, el perfil con el rol de la
   invitación y la sesión.
3. El idioma de la invitación se escribe en el `locale` del perfil nuevo y en la cookie
   `027_locale`, para que `/welcome` y el panel sigan en ese idioma y no vuelvan al del navegador.
4. Se redirige a `/welcome` (o al panel si es administrador).

### Cuenta existente (session-first, D21)

1. El formulario pide **solo la contraseña** de la cuenta que ya existe: el Core no la verifica ni
   la recibe, la sesión la abre Supabase.
2. Con la sesión abierta, el canje asocia la invitación a ese perfil.
3. El rol **no** se aplica (`role_applies: false`, D6): quien ya era `admin` o `super_admin`
   conserva el suyo, y quien era `user` sigue siendo `user`.
4. La app detecta `account_exists` en el preview y muestra el mismo camino que la web.

### Desde la app

- El enlace es un **App Link** (`https://<instancia>/invite/<token>`) en el build firmado; en debug
  el esquema propio (`zero27apps-dev://invite/<token>?instance=…`) y `027apps-dev://` para los
  comandos `adb` que ya existían.
- La instancia sale del enlace, nunca de la que tuviera la app abierta.
- Si la app ya tiene sesión y la invitación es para otra persona, no cambia de cuenta en silencio.
- Sign-in y aceptación comparten iconografía; las acciones de descarga usan el glifo y el color de
  Android.

### Desde la web

- `/invite/[token]` es la página pública: preview, aviso de que la app está disponible, y el
  formulario. El botón de la app no es obligatorio para aceptar.
- Un enlace `http://` local no puede abrir la app directamente: el App Link necesita https
  verificado (tarea 05). En local se instala el APK y se abre con el esquema, o se acepta en la web.

## Renovar, revocar, reenviar

- **Renovar** (`POST /api/v1/invitations/{id}/renew`): solo para `expired`. Reusa `expires_in_days`
  y devuelve el enlace renovado; una invitación `used` no se renueva (sería reabrir una cuenta ya
  creada). El panel tiene la acción y el componente de aviso.
- **Revocar** (`DELETE /api/v1/invitations/{id}`): pasa a `revoked`; el enlace deja de canjearse.
- **Reenviar email**: limitado por rate limit, no cambia el token ni la caducidad.

## Invariantes de seguridad

- Token bearer: hash en base, un solo uso, TTL, `no-store` en las respuestas públicas.
- El canje es público **a propósito** (una cuenta nueva no tiene sesión), pero usa el resolvedor real
  de sesión: si el email ya existe y la sesión no es de ese perfil, responde
  `existing_account_signin_required` y no crea ni cambia nada (D21). Renovar, revocar, reenviar y
  rotar el enlace sí exigen `invitations:write`.
- Rate limit por IP en el canje (30 por defecto) y por usuario en las acciones del panel.
- Un rol pedido fuera de `user|admin` es un 400, no un `super_admin` silencioso.
- Un email ajeno al de la invitación no puede canjearla.
- Nada de tokens en logs: ni en el servidor ni en la app.

## Probar en local

1. Crea la invitación desde el panel con una cuenta de prueba y copia el enlace.
2. Web: abre `http://192.168.x.x:3003/invite/<token>` en el navegador y recorre los dos caminos
   (cuenta nueva y cuenta existente).
3. App: instala el APK del sprint y abre el enlace con
   `adb shell am start -a android.intent.action.VIEW -d "zero27apps-dev://invite/<token>?instance=http%3A%2F%2F192.168.x.x%3A3003" [paquete]`.
4. Renueva una caducada desde el panel y comprueba que el enlace viejo da `expired`/`used` y el
   nuevo canjea.
5. Revoca otra y comprueba que el canje responde 404/409 sin filtrar datos.

La prueba con sesión real y el recorrido por los dos caminos es parte de
[`pre-delivery-verification.md`](pre-delivery-verification.md).

## Errores frecuentes

| Síntoma | Causa probable |
|---|---|
| El enlace de la app abre la web | build sin App Link verificado (`assetlinks.json`/`ANDROID_APP_SHA256`) o APK de debug |
| «Este enlace ya no es válido» en la app | token caducado, usado o revocado; se renueva desde el panel |
| La web pide contraseña a quien ya tiene cuenta | preview con `account_exists: true` mal cacheado; recarga el preview |
| El rol no cambia al aceptar | es intencionado: una cuenta existente conserva su rol (D6) |
