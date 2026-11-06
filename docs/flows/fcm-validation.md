# Validación end-to-end de FCM

Runbook de la **puerta de aceptación de despliegue** de sprint-09-core-data (task-06):
comprobar que un evento del outbox llega como notificación a un dispositivo real
con la app cerrada, y que un token inválido queda revocado.

No es una tarea de implementación: el código está terminado. Esto es la prueba
manual que exige credenciales reales de Firebase y un dispositivo.

## Qué se valida

1. El servidor firma un JWT OAuth2 con la service account y llama a FCM HTTP v1.
2. El token del dispositivo se registra en `POST /api/v1/devices`.
3. Un evento con `notify = '{push}'` produce una notificación **data-only**.
4. Un token inválido (`UNREGISTERED`/`INVALID_ARGUMENT`) queda con `revoked_at`
   y deja de reintentarse.

## Entorno recomendado

Local, porque el preview de Vercel está protegido por Vercel Authentication y el
móvil no puede atravesarlo. El servidor local habla con FCM por HTTPS; solo el
tráfico app → servidor local va por HTTP.

- `supabase start` (Postgres, Auth y Mailpit).
- `pnpm --filter admin dev` en `http://localhost:3000`.
- Emulador Android con **Google Play Services** (imagen *Google APIs* o *Google
  Play*), o un móvil por USB con `adb reverse`.
- Proyecto Firebase con una app Android registrada para el paquete
  `com.rferic.zero27apps`.

> El APK debug permite HTTP en claro (`app/src/debug/AndroidManifest.xml`) para
> llegar al dev server con `adb reverse`. El build release lo mantiene prohibido.

## Paso 1 — Firebase

1. Crea un proyecto en <https://console.firebase.google.com>.
2. Añade una app **Android** con el paquete `com.rferic.zero27apps`.
3. De **Project settings → General → Your apps** anota:
   - `project_id`
   - `mobilesdk_app_id` (`1:...:android:...`)
   - `current_key` del API key (no una legacy server key)
   - `project_number` (sender id)
4. De **Project settings → Service accounts → Generate new private key** descarga
   el JSON. Es un **secreto**: no lo commitees, no lo pegues en tickets.
5. Comprueba que la API *Firebase Cloud Messaging API* está habilitada en Google
   Cloud. La service account por defecto de un proyecto nuevo ya puede enviar.

## Paso 2 — Levantar el stack local

```bash
cd /Users/ericrf/orca/workspaces/027apps/027Apps
supabase start
pnpm --filter admin dev
```

Comprueba `curl -s http://localhost:3000/api/v1/health` → `{"status":"ok"}`.

> Si el puerto 3000 está ocupado (en esta máquina lo está por OrbStack), arranca
> con `PORT=3003 pnpm --filter admin dev` y sustituye `3000` por `3003` en todos
> los comandos, incluido `adb reverse tcp:3003 tcp:3003`.

## Paso 3 — Super admin y settings FCM

### 3a. Si la instancia local no tiene super_admin (recomendado)

Abre `http://localhost:3000/setup`:

1. **Environment** → comprueba los checks.
2. **Super admin** → email, contraseña (≥12) y nombre. El wizard inicia sesión.
3. **SMTP** → “Send test email”; el correo cae en Mailpit
   (<http://127.0.0.1:54324>). Pulsa “I received it”.
4. **Preferences** → rellena los cuatro valores públicos FCM, pega el JSON de la
   service account y deja **Push provider = fcm**. El wizard escribe el provider
   al final, que es el orden correcto.

### 3b. Si ya existe super_admin

Los settings se escriben **solo con sesión** (no con API key), en este orden:
primero los cuatro públicos y la service account, y `provider` al final.

```bash
BASE=http://localhost:3000
JWT=<access_token de sesión>   # ver Paso 5
patch() {
  curl -s -X PATCH "$BASE/api/v1/settings/notifications/push.$1" \
    -H "Authorization: Bearer $JWT" -H "content-type: application/json" \
    -d "$(python3 -c 'import json,sys; print(json.dumps({"value": sys.stdin.read().strip()}))' <<<"$2")"
}
patch fcm_project_id  "<project_id>"
patch fcm_app_id      "<mobilesdk_app_id>"
patch fcm_api_key     "<current_key>"
patch fcm_sender_id   "<project_number>"
patch fcm_service_account "$(cat /ruta/private/service-account.json)"
patch provider        "fcm"
```

La ruta es `/api/v1/settings/notifications/push.<clave>` (la categoría es
`notifications` y la clave es `push.fcm_*`).

Verifica que `/api/v1/instance` publica los cuatro valores:

```bash
curl -s "$BASE/api/v1/instance" | python3 -m json.tool | grep notifications
```

`provider` y la service account **no** aparecen en `/instance` (no son públicos).

## Paso 4 — Instalar y preparar el dispositivo

```bash
cd apps/android
ANDROID_HOME="$HOME/Library/Android/sdk" ./gradlew :app:assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb reverse tcp:3000 tcp:3000
```

`adb reverse` hace que `localhost:3000` del dispositivo sea el dev server del
host. En emulador también funciona `http://10.0.2.2:3000`.

## Paso 5 — Obtener un JWT de sesión

El navegador guarda la sesión en cookies `HttpOnly`; para la pantalla Android es
más simple pedir el token a Supabase Auth con el email y contraseña del
super_admin:

```bash
# Desde la raíz del repo: BASE para el resto de pasos y la anon key local.
BASE=http://localhost:3000
ANON_KEY=$(grep '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' apps/admin/.env.local | cut -d= -f2-)

read -r -p "Email: " EMAIL
read -r -s -p "Password: " PASSWORD; echo
BODY=$(python3 -c 'import json,sys; print(json.dumps({"email": sys.argv[1], "password": sys.argv[2]}))' "$EMAIL" "$PASSWORD")
JWT=$(curl -s "http://127.0.0.1:54321/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" \
  -H "content-type: application/json" \
  -d "$BODY" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')
echo "$JWT" | cut -c1-20   # sanity check, no lo pegues en logs
```

La anon key local está en `apps/admin/.env.local`
(`NEXT_PUBLIC_SUPABASE_ANON_KEY`). El token dura 900 s: si caduca, repite.

## Paso 6 — Registrar el dispositivo

1. Abre la app **027Apps**.
2. Concede el permiso de notificaciones (Android 13+).
3. En la pantalla **027Apps FCM** introduce:
   - Instance URL: `http://localhost:3000`
   - Session JWT: el token del Paso 5
4. Pulsa **Configure FCM and register**.

Debe aparecer `Device registered. Token: ...`. Eso significa que la app leyó
`/api/v1/instance`, inicializó Firebase, obtuvo el token y llamó a
`POST /api/v1/devices`.

> Esta pantalla es un arnés de aceptación temporal, no el login definitivo:
> guarda la URL y el JWT en las preferencias privadas de la app. No la uses con
> una cuenta real fuera de esta prueba.

Comprueba en la BD:

```bash
DB=$(docker ps --format '{{.Names}}' | grep '^supabase_db_' | head -1)
docker exec -i "$DB" psql -U postgres -d postgres -c \
  "select user_id, platform, left(push_token, 12) as token, revoked_at from public.devices order by created_at desc limit 3;"
```

## Paso 7 — Crear la API key de mantenimiento

`maintenance:run` es **service-key only** (una sesión no lo tiene). Créala con el
JWT de sesión:

```bash
SERVICE_KEY=$(curl -s -X POST "$BASE/api/v1/api-keys" \
  -H "Authorization: Bearer $JWT" -H "content-type: application/json" \
  -d '{"kind":"service","name":"fcm-acceptance","scopes":["maintenance:run"],"role_cap":"super_admin"}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["secret"])')
echo "${SERVICE_KEY:0:8}…"   # solo prefijo
```

El secreto se muestra **una sola vez**. Guárdalo solo para esta prueba.

## Paso 8 — Encolar el evento de prueba

`subject_id` es el usuario dueño del dispositivo: el claim `sub` del JWT.

```bash
USER_ID=$(python3 - "$JWT" <<'PY'
import base64, json, sys
p = sys.argv[1].split(".")[1]
p += "=" * (-len(p) % 4)
print(json.loads(base64.urlsafe_b64decode(p))["sub"])
PY
)

DB=$(docker ps --format '{{.Names}}' | grep '^supabase_db_' | head -1)
docker exec -i "$DB" psql -U postgres -d postgres -c "
insert into public.event_outbox (type, target, subject_id, resource, payload, notify)
values ('test.push', 'user', '$USER_ID', '{}'::jsonb, '{}'::jsonb, '{push}');"
```

También puedes hacerlo desde Supabase Studio (<http://127.0.0.1:54323>) →
SQL Editor.

## Paso 9 — Despachar el outbox

```bash
curl -s -X POST "$BASE/api/v1/maintenance/run" \
  -H "Authorization: Bearer $SERVICE_KEY" -H "content-type: application/json" \
  -d '{"jobs":["outbox.publish"]}'
```

Esperado:

```json
{"runs":[{"job":"outbox.publish","status":"ok","summary":{"processed":1,"published":1,"failed":0}}]}
```

Si `status` es `skipped` con `reason: "cooldown"`, espera 60 s y repite (el job
tiene un cooldown de un minuto).

## Paso 10 — Comprobar la notificación con la app cerrada

1. Cierra la app (swipe desde recientes). **No** la fuerces desde Ajustes: un
   force-stop bloquea la entrega hasta que la vuelvas a abrir.
2. Repite el Paso 9 si hace falta.
3. Debe aparecer una notificación con título `push.test_push` y el JSON del
   evento como texto.

El servidor envía **data-only** (`{key, payload}`); la app compone el texto. Es
por diseño: el servidor no compone mensajes localizados.

Si no llega:

```bash
docker exec -i "$DB" psql -U postgres -d postgres -c \
  "select state, attempts, published_at from public.event_outbox where type = 'test.push' order by created_at desc limit 1;"
```

- `published` y `attempts = 1` → el servidor envió; revisa el dispositivo
  (permiso, Google Play Services, token).
- `pending` con `next_attempt_at` → FCM pidió reintento; mira los logs del dev
  server.
- `failed` → se agotaron los 8 intentos; el log dice el motivo.

## Paso 11 — Probar la revocación de un token inválido

Inserta un dispositivo extra con un token falso para el mismo usuario, encola
otro evento y despacha:

```bash
docker exec -i "$DB" psql -U postgres -d postgres -c "
insert into public.devices (user_id, platform, push_token)
values ('$USER_ID', 'android', 'fake-token-0000000000000000');"

docker exec -i "$DB" psql -U postgres -d postgres -c "
insert into public.event_outbox (type, target, subject_id, resource, payload, notify)
values ('test.push.revoke', 'user', '$USER_ID', '{}'::jsonb, '{}'::jsonb, '{push}');"
```

Espera 60 s (cooldown) y repite el Paso 9. Después:

```bash
docker exec -i "$DB" psql -U postgres -d postgres -c \
  "select left(push_token, 16) as token, revoked_at from public.devices where user_id = '$USER_ID' order by created_at;"
```

El token falso debe tener `revoked_at` no nulo. El token real debe seguir vivo y
recibir la notificación.

## Paso 12 — Cerrar la puerta

Marca la puerta como verificada en `docs/tasks/sprint-09-core-data/task-06.md`
con:

- fecha y entorno (local/emulador o móvil),
- resultado del Paso 9 (`published: 1`),
- evidencia de la notificación con la app cerrada,
- evidencia de `revoked_at` en el Paso 11.

No se afirma “FCM verificado” hasta tener esas tres evidencias.

## Problemas frecuentes

| Síntoma | Causa / solución |
|---|---|
| `FCM public configuration is missing` | Faltan claves públicas; mira `/api/v1/instance` y el Paso 3. |
| `CLEARTEXT communication ... not permitted` | Instala el APK **debug** y usa `adb reverse`; el release bloquea HTTP. |
| `HTTP 401` al registrar | JWT caducado (900 s) o email/contraseña incorrectos. Repite el Paso 5. |
| `HTTP 302` / HTML de login | Estás apuntando a un preview protegido de Vercel. Usa local. |
| `provider=fcm requires all FCM keys` | Escribe las cuatro claves públicas y la service account antes del provider. |
| `outbox.publish` falla con `realtime transport is not configured` | Faltan `NEXT_PUBLIC_SUPABASE_URL` o `SUPABASE_SERVICE_ROLE_KEY` en el admin. |
| La service account no descifra | `SETTINGS_ENCRYPTION_KEY` distinta de la usada al guardarla. |
| No llega la notificación | Permiso `POST_NOTIFICATIONS`, imagen del emulador sin Google Play Services, o app force-stopped. |
| `403 insufficient_scope` en `maintenance/run` | La key no tiene `maintenance:run` o `role_cap != super_admin`. |
| El wizard falla al crear el super admin con `Database error finding users` | El Auth local tiene filas antiguas con `confirmation_token`/`created_at` NULL. `supabase db reset` recrea el esquema y lo arregla (borra los datos locales de prueba). |
