# Spec — Modelo de tokens (sprint 03, task 01)

**Fecha:** 2026-10-25
**Estado:** Borrador para aprobación del usuario
**Base:** spec de diseño `2026-10-24-027apps-design.md` (§8 modelo de datos, §11 backlog) · token "con una sola vez de login"
**Decide el usuario:** modelo de tokens (2026-10-25)

## 1. Objetivo

Definir cómo se autentica cada consumidor de la API de 027Apps y qué puede tocar, partiendo de la necesidad y no de una forma de token predeterminada. Tres necesidades reales:

1. **App móvil:** el usuario entra **una sola vez** y el dispositivo queda autenticado indefinidamente sin que nadie vuelva a hacer nada. Recuperación si se pierde el móvil.
2. **Herramientas propias del admin conectadas a la API** mediante clave que **no actúa como un usuario concreto** (es de la instancia), con control fino de acceso.
3. **Accesos a herramientas de terceros generados por cualquier usuario**, que actúan **como ese usuario** y que el propio usuario puede revocar.

## 2. Principio rector

**Ningún token "nunca caduca" sin revocación.** Todo token es una fila en la BD: opaco, con prefijo identificador, guardado **solo hasheado**, mostrado **una única vez** al crearse. La revocación es instantánea (borrar/desactivar la fila). Los permisos se miran **en vivo en la BD** en cada petición (con caché), de modo que los cambios de acceso aplican al instante sin re-emparejar.

**Decisiones clave (usuario, 2026-10-25):**
- Mecanismo de autorización: **tokens opacos + lookup en BD** (no JWT). Revocación instantánea, control fino natural por endpoint, sin gestión de firma.
- **Contraseña obligatoria** en el primer emparejamiento (wizard de invitación) como credencial de recuperación.
- Acceso **fino por endpoint** desde el día uno (no solo módulo + lectura/escritura).

## 3. Taxonomía de tokens

| Tipo | Para qué | Vinculado a | Revocación | Prefijo |
|---|---|---|---|---|
| **Dispositivo** | App móvil, "login una vez" | dispositivo (no usuario) | por dispositivo, desde admin | `027_dev_…` |
| **Instancia** (service) | Herramientas del admin conectadas a la API, **sin** actuar como usuario | instancia | al instante, por admin | `027_svc_…` |
| **Delegado** | Herramientas de terceros que actúan **como un usuario** | usuario + scopes concedidos | al instante, por el propio usuario | `027_usr_…` |

### 3.1 Token de dispositivo (app móvil)

- **Emparejamiento por invitación** (ver §4): al completarla se crea la cuenta (si no existe), la afiliación al grupo/módulos, y el token de dispositivo de larga vida.
- **Acceso:** *refresh token* de larga vida **que rota en cada uso** (el antiguo queda inválido) + *access tokens* cortos (15–60 min) pedidos en segundo plano por la app. El usuario no vuelve a interactuar.
- **Qué es el access token:** también **opaco, fila en BD** (coherente con el principio rector: sin JWT ni firma). Una tabla de access cortos que se crea en cada refresh y muere al expirar. A escala familiar el volumen de escritura es irrelevante; el lookup se cachea.
- **Rotación con concurrencia y detección de robo:** si se presenta un *refresh ya rotado* (señal de robo/replay), se **revoca toda la familia** del dispositivo (patrón RFC 6819) — no solo el token presentado. Esto evita que un atacante con un refresh robado bloquee al legítimo o se quede con el acceso.
- **Almacenamiento:** solo en el almacén seguro del dispositivo (Android Keystore / EncryptedSharedPreferences). Nunca en logs, backups sin cifrar ni en git.
- **Revocación:** por dispositivo desde el panel del admin (móvil perdido, miembro que sale del grupo). Es instantánea.
- **El token de dispositivo está ligado al usuario, no al grupo:** los grupos/módulos a los que accede se resuelven por petición (vivo en BD). Si un usuario ya emparejado recibe una invitación a otro grupo, **no re-empareja**: su token existente gana el acceso nuevo al activarse la invitación. Esto evita fricción y mantiene "login una vez".
- **Transferencia móvil → móvil:** el diseño lo deja **posible** (código emitido por el original; al completarse, el original pierde la sesión). **Implementación aplazada** tras auth v1 — se registra como requisito de diseño, no se implementa en este corte.
- **Recuperación (móvil perdido):** el admin revoca el dispositivo y el usuario entra con **email + contraseña** en el dispositivo nuevo (login de recuperación) → se crea un token de dispositivo nuevo. Alternativamente, re-invitación. Detalle de flujos en la spec de auth.

### 3.2 Token de instancia (service)

- Para conectar herramientas del admin (scripts, integraciones, **MCP/IA** con scopes por módulo) que actúan **sin identidad de usuario**, con permisos propios de la instancia.
- **Alcance:** de **instancia completa** (no scoped a un grupo): la necesidad del usuario es conectar herramientas a *su* API, no a un grupo. Lo crea/revoca **solo `super_admin`** (el propietario de la instancia), desde el panel.
- **Scopes:** módulo + lectura/escritura + **endpoints concretos**.
- Expiración **opcional**, rate limiting por clave, auditoría de uso (`last_used_at`, qué endpoints toca).
- Creado y revocado por el admin (super_admin).

### 3.3 Token delegado (terceros, "como el usuario")

- Para herramientas de terceros que actúan **como un usuario concreto**: ven lo mismo que vería ese usuario, recortado además por el scope que el usuario les conceda.
- Mismo modelo de scopes que instancia (fino por endpoint), pero el límite efectivo es `min(scopes concedidos, permisos del usuario)`.
- Creado y revocado **por el propio usuario** (desde la app o panel), sin tocar los del resto.

## 4. Emparejamiento del móvil por invitación

La **invitación (URL)** es el único vehículo de entrada. Lleva: a quién (email), a qué módulos/grupo da acceso, y es **de un solo uso**. Cómo se distribuye (WhatsApp, email…) se decide en la spec de auth.

Al abrir la URL sale un **wizard**:

1. **QR para descargar el APK** (si la app no está instalada).
2. **Emparejar con la app ya instalada**: camino principal **deep link** ("Abrir en la aplicación"); **QR + código** como alternativa (emparejamiento cruzado desde otra pantalla, o si el deep link no abre).
3. **Confirmar email + fijar contraseña (obligatorio).** El email mostrado es el de la invitación (se confirma); la contraseña es la credencial de recuperación (ver §3.1).

Al completar el wizard: se crea/verifica la cuenta, se activa la afiliación (grupo + módulos de la invitación) y se emite el token de dispositivo. Los flujos exactos del wizard (pantallas, qué pasa si el email no coincide, reenvío) son de la spec de auth; esta spec fija el resultado: **cuenta con email + contraseña + token de dispositivo**.

## 5. Acceso por endpoint (scopes)

- Cada ruta de la API declara los **scopes que exige** (ej. `expenses:read`, `expenses:write`, `groups:admin`).
- El middleware autentica el token (lookup en BD, con caché), resuelve su scope y su usuario (si aplica), y comprueba la ruta.
- Para tokens delegados el acceso efectivo es `min(scopes del token, permisos del usuario)`; para instancia, los scopes del token; para dispositivo, los permisos del usuario.
- **Permisos en vivo, no cacheados con TTL de permisos:** el lookup del *token* en sí se cachea (la fila del token apenas cambia), pero la **resolución de permisos del usuario** (grupos, roles, módulos activos) se lee de la BD **por petición**, o con una caché invalidada explícitamente al cambiar la membresía/rol. Así un miembro removido o degradado pierde el acceso **de inmediato** (criterio de aceptación 1), sin depender de un TTL que la contradiga.
- RLS en BD como segunda barrera (el nivel de fila no depende solo del middleware).

## 6. Transversal (todos los tipos)

- **Hashing:** solo SHA-256 del token en BD. El prefijo (`027_dev_…`) permite identificarlo sin revelar el secreto; el secreto completo solo se muestra una vez al crear.
- **Nunca en logs**, ni en respuestas, ni en git. `guard-secrets` del CI ya rechaza valores con forma de JWT/secreto.
- **Rate limiting** por token y por IP en superficies públicas.
- **Expiración opcional** para instancia/delegado; los refresh de dispositivo no expiran en uso normal (la rotación y la revocación cubren el riesgo).
- **Auditoría de uso:** `last_used_at` en el token + **contadores agregados por token y por endpoint** (no un log por petición: evita volumen de escritura en free tier; la agregación da la traza de uso sin el ruido). Sin guardar el token.

## 7. Modelo de datos (evolución del borrador §8)

Sobre el esquema de `2026-10-24-027apps-design.md` §8, la taxonomía requiere:

- `device_tokens` → añade el token de dispositivo real: hash del refresh, `family_id` (para detección de robo: revocar toda la familia), `refresh_rotated_at`, `revoked_at`, `device_platform`, además de `expo_push_token`.
- `access_tokens` (nueva) → filas opacas de corta vida, con `expires_at` y `user_id`; expiración por TTL/limpieza.
- `api_keys` → generalizar a los tres tipos (o tabla `tokens` con `kind: device|service|delegated`), con `scopes text[]`, `created_by`, `expires_at nullable`, `revoked_at`, `last_used_at`, y para delegado el `user_id` al que actúa.
- `audit` (nueva) → **contadores agregados** por token × endpoint (`token_id`, `endpoint`, `count`, `window_start`), sin guardar el token.
- `invitations` → token de un solo uso + email + módulos (ya existe el esqueleto).
- El login de recuperación (email + contraseña) y el reset de contraseña usan el esquema de auth (spec de auth).

> El esquema SQL exacto lo define el plan de implementación; esta spec fija las entidades y sus invariantes.

## 8. Decisiones tomadas (usuario, 2026-10-25)

1. Tokens **opacos + lookup en BD** (no JWT), revocación instantánea.
2. **Contraseña obligatoria** al emparejar (wizard de invitación) como credencial de recuperación.
3. Acceso **fino por endpoint** desde el día uno.
4. Accesos de terceros (delegado) actúan **como el usuario**, limitados por `min(scopes, permisos del usuario)`.
5. Tokens de instancia: **de instancia completa**, creados/revocados solo por `super_admin`.
6. Detección de robo en rotación de refresh (RFC 6819): presentar un refresh ya rotado revoca **toda la familia** del dispositivo.
7. Permisos resueltos **en vivo por petición** (o caché invalidada por cambio de membresía), nunca con TTL que contradiga la revocación instantánea.
8. Auditoría por **contadores agregados** por token × endpoint (no log por petición).
9. Dispositivo ligado al usuario, no al grupo: nueva invitación a otro grupo **no re-empareja**.
10. Transferencia móvil → móvil: **posible por diseño, implementación aplazada**.

## 9. Fuera de alcance

- **Flujos de login en sí** (magic link vs QR, registro, reset de contraseña, reenvío de invitación) → spec de **auth** (siguiente tarea). Aquí solo se fijan: invitación como vehículo, email + contraseña obligatorios al emparejar, y recuperación por email + contraseña.
- **API pública v1** (OpenAPI, versionado, rate limiting de terceros, formato de errores) → spec de **API v1** (siguiente tarea). Aquí se define el modelo de credenciales, no el contrato HTTP.
- **i18n** de los textos del wizard → flujo i18n.
- **Implementación de la transferencia móvil → móvil** → aplazada (diseño la permite, ver §3.1).

## 10. Criterios de aceptación

- Un dispositivo se empareja una sola vez y no vuelve a pedir credenciales en uso normal; la revocación de ese dispositivo es instantánea y efectiva.
- Una clave de instancia no puede actuar como usuario y solo llega a los scopes concedidos (módulo + E/S + endpoint).
- Una clave delegada actúa como su usuario y está limitada por `min(scopes, permisos del usuario)`; el usuario puede revocarla al instante.
- Ningún token aparece en claro en la BD, en logs ni en respuestas; el CI `guard-secrets` sigue en verde.
- La recuperación tras perder el móvil funciona con email + contraseña en un dispositivo nuevo (o re-invitación).
- El modelo de datos implementa la taxonomía de §7 sin romper el esquema RLS existente.
