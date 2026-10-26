# Spec — Core: configuración de instancia y wizard de instalación (sprint 04, task 06)

**Fecha:** 2026-10-26
**Estado:** Borrador para aprobación del usuario
**Base:** [spec de datos](2026-10-26-core-data-model.md) (task-01: `settings_categories`, `settings`, `currencies`, `translations`) · [ADR 0008](../../adr/0008-fechas-y-moneda.md) (config general — **con nota de revisión 2026-10-26**: `instance_settings` → `settings`) · [spec de auth §3bis/§5bis](2026-10-25-auth.md) (**delta 2026-10-26**: orden del wizard) · [spec de API v1 §3.4/§4](2026-10-25-api-v1.md) · [spec de API del Core](2026-10-26-core-api.md) (task-02: `/settings`, `/currencies`, `/instance`) · [spec de realtime](2026-10-26-realtime-notificaciones.md) (task-04: `notifications.push.fcm_*`) · [spec de módulos](2026-10-26-modulo-system.md) (task-03: settings de módulo) · [spec de MCP](2026-10-26-mcp.md) (task-05: `mcp_access`) · [ADR 0007](../../adr/0007-manejo-de-errores.md)
**Decide el usuario:** wizard guiado y verificado, AES-256-GCM, `settings_public` acotado (2026-10-26)
**Correcciones de revisión + auditoría (2026-10-26):** 1 Alta (bootstrap sin actor), 8 Media de seguridad, 14 de coherencia

## 1. Objetivo

Definir **qué es configurable en una instancia** (claves, tipos, validación, secretos, quién lee/escribe) y **cómo se instala una instancia nueva** sin tocar código, con un wizard que **no abre una puerta trasera**.

## 2. Frontera: lo que el wizard puede escribir y lo que no

**Restricción estructural (huevo y gallina):** los settings viven en la **BD de Supabase**; sus credenciales deben estar **antes** del primer arranque en **variables de entorno del hosting**. El wizard no puede escribirlas.

| Dato | Dónde vive | Quién lo escribe | Qué hace el asistente |
|---|---|---|---|
| URL y claves de Supabase | Env del hosting (Vercel) | Quien instala, antes del deploy | **Guía + verifica** (conexión, migraciones) |
| `SETTINGS_ENCRYPTION_KEY` (32 bytes) | Env del hosting | Quien instala | **Guía + verifica** (presente y válida); provisión en `sprint-infra` task-09 |
| SMTP del proyecto Supabase | Dashboard de Supabase | Quien instala | **Guía + verifica** (email de prueba al propio admin) |
| `JWT_EXPIRY = 900 s` | Proyecto Supabase | Quien instala | **Guía + verifica** (decodifica el access token del admin tras el login) |
| Preferencias y FCM | `settings` (nuestra BD) | **Admin ya autenticado** | **Escribe** (con actor real) |
| Primer `super_admin` | Supabase Auth + `profiles` | Wizard (Admin API) | **Escribe** (paso 2) |

Sin env válidas la instancia arranca `degraded` y `/instance` lo refleja (api-v1 §4).

## 3. Corrección estructural: el admin se crea **antes** de configurar

**Problema detectado (revisión, Alta):** con el orden anterior (admin al final), el wizard escribía `settings` **sin que existiera ningún actor** — pero el modelo exige `num_nonnulls(updated_by, updated_by_key) = 1` y la escritura es `is_admin()`. Eso obligaba a un camino privilegiado sin dueño y dejaba la **ventana de setup abierta** durante toda la configuración.

**Decisión (delta al orden de auth §3bis):**

| Paso | Qué hace | Estado del sistema |
|---|---|---|
| **1. Supabase** | configuración/verificación del entorno | sin usuarios |
| **2. Super admin** | crea el usuario (Auth) + `profiles.role=super_admin` y **abre sesión** | la instancia deja de estar "sin admin" |
| **3. Supabase SMTP** | verificación con envío al email del propio admin | autenticado |
| **4. Preferencias** | configuración de instancia | autenticado |
| **5. FCM** (opcional) | notificaciones | autenticado |

Consecuencias:
- La **ventana sin autenticación** dura **solo el paso 1–2** (no toda la configuración).
- Todo lo demás lo escribe un **super_admin autenticado** → `updated_by` es real; no hace falta usuario ficticio ni excepción en el CHECK.
- No hace falta guardar "progreso del wizard" en settings: se **deriva** del estado real (ver §7.3).

## 2bis. Configuración

Sobre la task-01, sin reabrir el modelo:

- **`settings_categories`**: `category_key`, `label`/`help` (inglés, traducido por `translations`), `source`, `sort_order`.
- **`settings`**: `category_key` + `key` (`UNIQUE`), `label`/`help`, `value` **o** `value_encrypted` (`is_secret`), `is_public`, `mcp_access`, `updated_by`/`updated_by_key`.
- **Metadatos no escribibles por API**: `label`, `help`, `is_secret`, `is_public`, `mcp_access`, `source` viven en el **catálogo** (código) o en el manifest del módulo. El cuerpo de `PATCH` solo lleva el **valor** (schema estricto, sin campos extra).

## 4. Catálogo de la instancia (18 claves)

| Clave | Tipo | Default | Secreto | Público (`/instance`) | `mcp_access` |
|---|---|---|---|---|---|
| `instance.name` | string 1..80 | `027Apps` | no | sí | read |
| `localization.default_locale` | locale del set | `en` | no | sí | read |
| `localization.timezone` | IANA válida | `UTC` | no | sí | read |
| `localization.default_currency` | ISO 4217 **habilitada** | `EUR` | no | sí | read |
| `localization.enabled_locales` | array del set de 9, **`en` obligatorio** | `["en"]` | no | sí | read |
| `security.jwt_expiry` | int (solo lectura; refleja Supabase) | `900` | no | no | none |
| `instance.public_url` | URL `https` sin barra final | — (obligatoria) | no | sí | none |
| `security.cors_allowlist` | array de orígenes `http(s)://host[:port]`, sin `*`, sin rutas, máx. 20 | `[]` | no | no | none |
| `notifications.push.provider` | enum `fcm`\|`none` | `none` | no | no | none |
| `notifications.push.fcm_project_id` | string 1..128 | — | no | sí | read |
| `notifications.push.fcm_app_id` | string 1..256 | — | no | sí | read |
| `notifications.push.fcm_api_key` | string 1..128 | — | no | sí | read |
| `notifications.push.fcm_sender_id` | string 1..64 | — | no | sí | read |
| `notifications.push.fcm_service_account` | json (validado, ≤10 KB) | — | **sí** | no | none |
| `rate_limit.mobile_per_min` | int 1..10 000 | `120` | no | no | none |
| `rate_limit.api_key_per_min` | int 1..10 000 | `30` | no | no | none |
| `rate_limit.write_per_min` | int 1..10 000 | `10` | no | no | none |
| `rate_limit.public_per_min` | int 1..10 000 | `30` | no | no | none |

**Reglas:**
- **18 claves** (el email de auth lo gestiona Supabase, no es un setting nuestro; el SMTP propio queda reservado fuera de v1).
- **Nombres canónicos**: `notifications.push.fcm_*` (no `notifications.fcm_*`). Se actualizan task-04 §6.2, task-08 de infra y core-api.
- **Escritura por sensibilidad**: `security.*` y `instance.public_url`/`security.cors_allowlist` exigen **`is_super_admin()`** (no basta `admin`), porque relajan seguridad o cambian enlaces que se envían a terceros. El resto de preferencias, `admin`.
- **`security.jwt_expiry`**: **no modificable por API**; el paso 2 lo escribe con el valor **observado** del token (verificación). Si no coincide con 900, el wizard avisa y no deja continuar hasta corregirlo en Supabase.
- **`fcm_api_key`** es la **web API key del cliente** (`AIza…`); **prohibida** cualquier server key legacy. Lo que firma envíos es **solo** el service account cifrado.
- **`fcm_service_account`**: JSON con `type="service_account"`, `project_id`, `private_key` (PEM `BEGIN PRIVATE KEY`), `client_email`, `token_uri`, `client_id`; `project_id` **debe coincidir** con `fcm_project_id`; tamaño ≤10 KB.
- **Coherencia**: si `provider=fcm`, las **cinco claves FCM** (4 públicas + service account) son obligatorias; si `none`, pueden faltar.
- **Moneda**: la default debe existir en `currencies` **y estar habilitada**; deshabilitar la default está prohibido. Error `currency_not_enabled` (ADR 0007).
- **Idiomas**: subconjunto del set `en, es, ca, it, fr, de, pt, gl, eu`; `en` no se puede quitar.
- **`public_url`**: la consumen los **enlaces de invitación** y los deep links; por eso cambiarla es acción de `super_admin` y se audita.
- **v1 no tiene claves Core con `mcp_access = write`**: `settings_update` por MCP queda **reservado** (módulos/futuro). Un `PATCH` sobre una clave sin permiso de escritura → `insufficient_scope`/`validation_failed` según el caso.
- **Reservado (fuera de v1)**: SMTP propio de la app, LLM BYOK y secrets de clientes MCP usarán `value_encrypted` cuando se especifiquen; hoy **no** están en el catálogo.

## 5. Cifrado de secretos

- **AES-256-GCM**, clave maestra de **32 bytes** en `SETTINGS_ENCRYPTION_KEY` (base64, env). Nunca en BD, git ni logs.
- **Nonce**: **12 bytes aleatorios (CSPRNG) nuevos en CADA cifrado** — incluido todo re-cifrado y la rotación (M-1: reutilizar nonce rompe GCM). Tag de **128 bits**, verificado **antes** de devolver el claro.
- **AAD = `<versión>|<category_key>.<key>`** (M-2): ata el ciphertext a su slot; impide **intercambiar** secretos entre claves (un service account de FCM no puede descifrarse en el slot del SMTP).
- **Formato versionado**: `v1:<iv_b64>:<tag_b64>:<ciphertext_b64>`.
- **Rotación con doble clave**: se descifra con la clave anterior y se re-cifra con la nueva (`v2:`) en una ventana controlada; en cada re-cifrado, **nonce nuevo** y **AAD recalculado**.
- **Respaldo de la clave (M-3)**: la clave maestra se guarda en un **gestor de secretos** independiente y **nunca junto al backup de la BD** (backup de BD + clave = texto claro). Pérdida de la clave = secretos irrecuperables: el runbook de infraestructura documenta custodia y recuperación.
- **Fallo de descifrado** (clave cambiada/corrupta): el setting se trata como **no configurado**, se loguea **sin el valor** y `/instance` puede reportar `degraded`. **Clave ausente** con secretos configurados → arranque controlado en `degraded`, nunca "funciona a medias".
- **Nunca se leen en claro**: los secretos son **write-only** (se fijan, se muestran `configured: true`, nunca se devuelven). Se descifran **solo en el servidor** cuando se usan (p. ej. enviar un push).

## 6. API de configuración

| Endpoint | Reglas |
|---|---|
| `GET /api/v1/settings` | `is_admin()`; claves con `value`; las `is_secret` **enmascaradas**: `{ is_secret: true, configured: boolean }`, **nunca** el valor (delta a task-02: su redacción "todos, incluidos secrets" pasa a "incluidas las secretas, siempre enmascaradas") | 
| `PATCH /api/v1/settings/{category}.{key}` | `is_admin()` + `settings:write`; **`security.*`/`public_url`/`cors_allowlist` exigen `is_super_admin()`**; cuerpo **solo valor** (schema estricto); valida con el tipo del catálogo; escribe `value` o `value_encrypted`; **audita** (`settings.update` con `category_key`+`key`, **nunca el valor**) y **emite `settings.updated` tras el commit** (task-04) |
| `GET /api/v1/settings-categories` | `is_admin()`; agrupado por `sort_order` |
| `GET /api/v1/currencies` · `PATCH /api/v1/currencies/{code}` | lectura autenticada / escritura `is_admin()`; la default no se deshabilita |
| `GET /api/v1/instance` | **público**: `requires_setup`, `setup_incomplete` y **`settings_public`** = `instance.name`, `localization.default_locale/timezone/default_currency/enabled_locales`, `instance.public_url` y los 4 `fcm_*` públicos. **Nunca** CORS, rate limits, `security.*` ni secretos |

- **Validación**: `validation_failed` con `details` por campo; coherencia → códigos específicos (`currency_not_enabled`, `locale_not_available`).
- **Currencies**: seed inicial = **lista ISO 4217 completa** (`enabled = true`); el wizard, al fijar la moneda default, **garantiza en la misma transacción** que esa fila existe y está habilitada (H6).
- **Caché**: sin caché entre peticiones en v1; el cambio es visible en la siguiente petición.

## 7. Wizard de instalación (`/setup`)

### 7.1 Ventana y seguridad

- Se muestra solo si **no existe ningún `super_admin` activo** (`requires_setup`).
- **Creación atómica del primero (M-4)**: una transacción con **re-chequeo** de `requires_setup` + `UNIQUE` de email en Supabase Auth + `UNIQUE` en Auth; dos instaladores concurrentes → **uno gana**, el otro recibe `already_setup` (sin filtrar datos). Test de concurrencia obligatorio.
- **Rate limiting por IP** en **todas** las rutas `/setup*` y `/setup/*` (task-02 §4, superficies sin identidad) (M-4).
- **Orden impuesto en servidor**: las rutas de los pasos 3–5 exigen **sesión de `super_admin`**; no se puede saltar al paso 5.
- **Auditoría**: `super_admin.create` en `admin_actions` con actor = el perfil creado y `request_id`; la configuración posterior se audita por el mecanismo normal (B-6).

### 7.2 Pasos

| # | Paso | Muestra | Verifica | Escribe |
|---|---|---|---|---|
| 1 | **Entorno** | guía de env (Supabase + `SETTINGS_ENCRYPTION_KEY`) y migraciones | conexión a Supabase, migraciones aplicadas, `SETTINGS_ENCRYPTION_KEY` presente y de 32 bytes | — |
| 2 | **Super admin** | email + contraseña | crea el usuario (Admin API) y `profiles.role=super_admin`; **abre sesión**; decodifica el access token y comprueba `exp-iat = 900` (escribe `security.jwt_expiry` observado) | `profiles`, `security.jwt_expiry` |
| 3 | **SMTP** | guía del dashboard de Supabase (Resend/Brevo) | envía un email de prueba **solo al email del admin autenticado**, máx. **3 intentos** (M-7) y pide confirmación | — (proyecto Supabase) |
| 4 | **Preferencias** | formulario | tipos + coherencia (§4) | `instance.name`, `localization.*`, `instance.public_url` |
| 5 | **Notificaciones** (opcional) | formulario FCM | coherencia y validación del service account; **se puede omitir con aviso explícito** | `notifications.push.*` |

- **Orden**: 1 → 2 → 3 → 4 → 5. Saltables: **solo el 5**.
- **Fin**: al completar, `/instance` deja de reportar `setup_incomplete`; el wizard desaparece y redirige al panel.

### 7.3 Estado derivado (sin claves de progreso)

- `requires_setup` = **no hay ningún `super_admin` activo**.
- `setup_incomplete` = existe admin **pero faltan claves obligatorias** (`instance.public_url` y las tres de `localization`). Se calcula, no se guarda.
- El panel muestra un banner "configuración incompleta" con el enlace al paso que falta, y otro de "push no configurado" si `notifications.push.provider = none` (task-04).

## 8. Delta al catálogo de settings de módulo (H9)

El manifest del módulo (task-03) declara cada setting con la forma completa que exige la tabla:

```jsonc
{ "key": "default_currency", "type": "currency", "default": "EUR",
  "label": "Default currency", "help": "Currency used by default in this module",
  "is_public": true, "is_secret": false, "mcp_access": "read", "sort_order": 10 }
```

- `label`/`help` en inglés (se traducen con `translations`), `type` del catálogo de tipos, `default`, `is_public`, `is_secret` (⇒ `value_encrypted`), `mcp_access`, `sort_order`.
- Las claves de módulo se siembran al instalar con `source = module:<key>` y se borran al desinstalar (task-03).

## 9. Decisiones tomadas (conversación de diseño + correcciones, 2026-10-26)

| # | Decisión |
|---|---|
| A | **Frontera**: env (Supabase, `SETTINGS_ENCRYPTION_KEY`) y dashboard (SMTP, `JWT_EXPIRY`) se **guían y verifican**; el wizard escribe solo preferencias, FCM y el admin |
| B | **Admin primero** (delta a auth §3bis): el super_admin se crea en el paso 2 y **abre sesión**; el resto lo configura autenticado → **ninguna escritura sin actor** y ventana sin auth mínima |
| C | **Sin claves de progreso**: `requires_setup` y `setup_incomplete` se **derivan** del estado real |
| D | **18 claves** con tipo, default, secreto, `is_public`, `mcp_access`; nombres canónicos `notifications.push.fcm_*` |
| E | **Escritura por sensibilidad**: `security.*`, `instance.public_url` y `cors_allowlist` son de **`super_admin`** (cierra la asimetría con MCP) |
| F | **AES-256-GCM** con nonce de 12 bytes nuevo por cifrado, **AAD** = versión + clave, formato `v1:iv:tag:ciphertext`, rotación con doble clave |
| G | **Custodia de la clave** en gestor de secretos separado del backup de BD (M-3); provisión en `sprint-infra` task-09 |
| H | **`settings_public`** = 8 claves + los 4 `fcm_*`; **incluye `public_url`** (la consumen invitaciones y deep links); nunca CORS/rate limits/secretos |
| I | **Creación atómica** del primer admin + rate limit en `/setup*` + orden impuesto en servidor (M-4) |
| J | **Email de prueba solo al admin**, máx. 3 intentos (M-7) |
| K | **Service account FCM validado** (campos, PEM, `project_id` coherente, ≤10 KB) y **`fcm_api_key` = web API key del cliente** (prohibida server key legacy) |
| L | **Metadatos de settings no escribibles por API**; `PATCH` solo valor, schema estricto |
| M | **Sin claves Core con `mcp_access=write`** en v1 (MCP `settings_update` reservado) |
| N | **`security.jwt_expiry`** es reflejo verificado de Supabase, no configurable |
| O | **Seed de `currencies`** = ISO 4217 completo habilitado; el wizard garantiza la default habilitada en la misma transacción |

## 10. Fuera de alcance

- **Despliegue, variables de entorno y runbook** → `docs/flows/cicd.md` + `docs/infra`. (Se añade la tarea de `SETTINGS_ENCRYPTION_KEY` en `sprint-infra`.)
- **SMTP propio de la app, LLM BYOK, secrets de MCP**: no en v1 (mecanismo `value_encrypted` reservado).
- **Proveedor SMTP/Firebase de la instancia del autor** → `sprint-infra` task-03/task-08.
- **UI del panel de ajustes** → sprint-web.
- **Rotación operativa completa** → runbook de infraestructura.

## 11. Criterios de aceptación

- No existe **ninguna** escritura a `settings` sin actor humano autenticado; el primer `super_admin` se crea de forma **atómica** y el wizard no permite saltar pasos.
- Catálogo de 18 claves con validación (incl. coherencia FCM, moneda habilitada, `en` obligatorio, límites de longitud/cardinalidad) y escritura restringida por sensibilidad.
- Secretos: AES-256-GCM con **nonce nuevo por cifrado**, **AAD por clave**, formato versionado, rotación y custodia documentadas; write-only; nunca en API/logs/eventos/`settings_public`.
- `settings_public` acotado (incluye `public_url`) y `requires_setup`/`setup_incomplete` derivados correctamente.
- `PATCH` solo escribe valor, audita sin valor y emite `settings.updated`.
- Coherente con task-01..05, ADR 0007/0008 (con nota de revisión), auth §3bis (delta), api-v1.
- Aprobada por el usuario, revisada por segundo agente y **auditoría OWASP**.

## 12. Referencias

- Spec de datos: `docs/superpowers/specs/2026-10-26-core-data-model.md`
- Spec de API del Core: `docs/superpowers/specs/2026-10-26-core-api.md`
- Spec de auth: `docs/superpowers/specs/2026-10-25-auth.md` §3bis/§5bis (delta de orden)
- Spec de realtime: `docs/superpowers/specs/2026-10-26-realtime-notificaciones.md` §4/§6
- Spec de módulos: `docs/superpowers/specs/2026-10-26-modulo-system.md` §3
- Spec de MCP: `docs/superpowers/specs/2026-10-26-mcp.md` §4.4
- ADRs: `docs/adr/0007-manejo-de-errores.md`, `0008-fechas-y-moneda.md` (nota de revisión)
- Infra: `sprint-infra` task-03 (SMTP), task-08 (Firebase), task-09 (`SETTINGS_ENCRYPTION_KEY`)
- Plan del sprint: `docs/superpowers/plans/2026-10-26-sprint-core-design.md`
- Task: `docs/tasks/sprint-core-design/task-06.md`