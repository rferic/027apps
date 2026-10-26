# Spec — Core: configuración de instancia y wizard de instalación (sprint 04, task 06)

**Fecha:** 2026-10-26
**Estado:** Borrador para aprobación del usuario
**Base:** [spec de datos](2026-10-26-core-data-model.md) (task-01: `settings_categories`, `settings`, `currencies`, `translations`) · [ADR 0008](../../adr/0008-fechas-y-moneda.md) (config general: zona, moneda, idiomas) · [spec de auth §3bis/§5bis](2026-10-25-auth.md) (wizard `/setup`, SMTP) · [spec de API v1 §3.4/§4](2026-10-25-api-v1.md) (CORS, `/instance`) · [spec de API del Core](2026-10-26-core-api.md) (task-02: `/settings`, `/currencies`) · [spec de realtime](2026-10-26-realtime-notificaciones.md) (task-04: `notifications.fcm_*`, `JWT_EXPIRY`) · [spec de módulos](2026-10-26-modulo-system.md) (task-03: categorías de settings por manifest, limpieza en uninstall) · [spec de MCP](2026-10-26-mcp.md) (task-05: `mcp_access`) · [ADR 0007](../../adr/0007-manejo-de-errores.md) (envelope, sin internos)
**Decide el usuario:** wizard de 5 pasos con Supabase/SMTP/JWT guiados y verificados; AES-256-GCM; contenido de `settings_public` (2026-10-26)

## 1. Objetivo

Definir **qué es configurable en una instancia**, con qué tipo y validación, **quién puede leerlo y escribirlo**, cómo se cifran los secretos, y **cómo se instala una instancia nueva** (wizard `/setup`) sin que nadie tenga que tocar código.

## 2. Frontera: lo que el wizard puede escribir y lo que no

**Restricción estructural (huevo y gallina):** los settings viven en la **BD de Supabase**, así que las credenciales de Supabase tienen que estar **antes** del primer arranque, en **variables de entorno del hosting** (Vercel). El wizard no puede escribirlas: sin ellas no hay BD que leer.

| Dato | Dónde vive | Quién lo escribe | Qué hace el asistente |
|---|---|---|---|
| URL y claves de Supabase | Variables de entorno (Vercel) | Quien instala, antes del deploy | **Guía + verifica** (conexión, migraciones) |
| SMTP del proyecto Supabase | Dashboard del proyecto Supabase | Quien instala | **Guía + verifica** (email de prueba) |
| `JWT_EXPIRY = 900 s` | Config del proyecto Supabase | Quien instala | **Guía + verifica** (decodifica un JWT y comprueba `exp - iat`) |
| Preferencias de instancia | `settings` (nuestra BD) | **Wizard / panel** | **Escribe** |
| Notificaciones FCM (4 públicas + service account) | `settings` (nuestra BD) | Wizard / panel | **Escribe** (opcional) |
| Primer `super_admin` | Supabase Auth + `profiles` | Wizard (Admin API) | **Escribe** |

**Nada de esto se inventa en runtime**: si falta una variable de entorno, la instancia arranca en estado `degraded` y `/instance` lo refleja (api-v1 §4).

## 3. Modelo de settings

Sobre la task-01 (`settings_categories` + `settings`), sin reabrirlo:

- **Categoría** (`settings_categories`): `category_key`, `label`/`help` (texto en inglés → traducido por `translations`), `icon`, `sort_order`, `source` (`core` | `module:<key>`).
- **Setting** (`settings`): `category_key` + `key` (key completa `{category_key}.{key}`, `UNIQUE(category_key,key)`), `label`/`help`, `value` (jsonb, no secreto) **o** `value_encrypted` (secreto, `is_secret`), `is_public`, **`mcp_access`** (`none`|`read`|`write`, delta de task-05), `sort_order`, actor (`updated_by` / `updated_by_key`).
- **Tipos**: cada clave del catálogo declara un **tipo zod** (§4). El tipo no es una columna: vive en el **catálogo** (código del Core o manifest del módulo) y se valida en el borde (ADR 0004 §3) al escribir.
- **Secretos**: `value_encrypted`, nunca en `value`; nunca en respuestas, logs ni `settings_public`.

## 4. Catálogo v1 (claves del Core)

| Clave | Tipo (zod) | Default | Secreto | `is_public` | `mcp_access` |
|---|---|---|---|---|---|
| `global.instance_name` | string 1..64 | `027Apps` | no | ✅ | read |
| `global.default_timezone` | IANA (validada) | `UTC` | no | ✅ | read |
| `global.default_currency` | ISO 4217 **habilitada** | `EUR` | no | ✅ | read |
| `global.active_locales` | array de locales, **`en` obligatorio**, no vacío | `["en"]` | no | ✅ | read |
| `global.jwt_expiry` | int (informativo; verificado contra Supabase) | `900` | no | — | **none** |
| `connectivity.public_url` | URL `https` sin barra final | — (obligatoria) | no | ✅ | **none** |
| `connectivity.cors_allowlist` | array de orígenes (`scheme://host[:port]`, **sin `*`** ni rutas) | `[]` (solo same-origin) | no | — | **none** |
| `notifications.push.provider` | enum `fcm`\|`none` | `none` | no | — | **none** |
| `notifications.push.fcm_project_id` | string | — | no (público por diseño) | ✅ | read |
| `notifications.push.fcm_app_id` | string | — | no | ✅ | read |
| `notifications.push.fcm_api_key` | string | — | no | ✅ | read |
| `notifications.push.fcm_sender_id` | string | — | no | ✅ | read |
| `notifications.push.fcm_service_account` | json (claves requeridas) | — | **sí** | — | **none** |
| `security.rate_limit.mobile_per_min` | int 1..10 000 | `120` | no | — | **none** |
| `security.rate_limit.api_key_per_min` | int 1..10 000 | `30` | no | — | **none** |
| `security.rate_limit.write_per_min` | int 1..10 000 | `10` | no | — | **none** |
| `security.rate_limit.public_per_min` | int 1..10 000 | `30` | no | — | **none** |

**Reglas del catálogo:**
- **Coherencia de push**: si `notifications.push.provider = fcm`, las **cinco** claves `notifications.push.*` son obligatorias; si es `none`, las de FCM pueden faltar (no se envían push).
- **Moneda**: la default debe existir en `currencies` **y estar `enabled`**; deshabilitar la moneda default está prohibido (task-01).
- **Idiomas**: subconjunto del set disponible `en, es, ca, it, fr, de, pt, gl, eu`; `en` no se puede quitar (ADR 0008).
- **Nunca configurables desde la interfaz** (son de seguridad o de plataforma): `global.jwt_expiry` (solo verificación), cualquier clave `security.*`, y las variables de entorno.
- **Módulos**: cada módulo registra su categoría y sus claves desde el manifest (task-03), con `is_public`/`is_secret`/`mcp_access` declarados. Convención de clave: `{snake_case(module_key)}.{key}`.

## 5. Cifrado de secretos

- **AES-256-GCM** con clave maestra de **32 bytes** en `SETTINGS_ENCRYPTION_KEY` (env; base64). Nunca en la BD, en git ni en logs (`guard-secrets`).
- **Formato versionado**: `v1:<iv_b64>:<tag_b64>:<ciphertext_b64>` — permite rotar la clave sin migración traumática (se descifra con la versión indicada).
- **Rotación**: job/procedimiento que descifra con la clave anterior y re-cifra con la nueva, incrementando la versión (`v2:`); se documenta en el runbook (infra).
- **Descifrado solo en el servidor y solo cuando la clave se usa** (p. ej. al enviar un push). Los secretos **nunca** se envían a un cliente ni se incluyen en `settings_public`, en la representación `Setting` (task-02 §5) ni en eventos.
- **Fallo de descifrado** (clave maestra cambiada) → el setting se trata como **no configurado**, se loguea sin el valor y `/instance` puede reportar `degraded`.
- **Clave ausente** con secretos configurados → error de arranque controlado (degraded), nunca "funciona a medias".

## 6. API de configuración

Ya definida en task-02 §3.8; aquí su semántica:

| Endpoint | Reglas |
|---|---|
| `GET /api/v1/settings` | `is_admin()`; devuelve claves con `value`; las `is_secret` se devuelven **enmascaradas** (`{ is_secret: true, configured: true }`, nunca el valor) |
| `PATCH /api/v1/settings/{category}.{key}` | `is_admin()` + `settings:write`; valida con el **tipo del catálogo**; escribe `value` o `value_encrypted` según `is_secret`; **audita** en `admin_actions` (`settings.update` con `category_key`+`key`, **nunca el valor**) |
| `GET /api/v1/settings-categories` | `is_admin()`; agrupado por `sort_order` |
| `GET /api/v1/currencies` · `PATCH /api/v1/currencies/{code}` | lectura autenticada / escritura `is_admin()`; la default no se deshabilita |
| `GET /api/v1/instance` | **público**; incluye **`settings_public`** = solo claves `is_public` del Core: `instance_name`, `default_timezone`, `default_currency`, `active_locales` y los `fcm_*` públicos. **Nunca** CORS, rate limits, `security.*` ni secretos |

- **Validación**: errores → `validation_failed` con `details` por campo (ADR 0007); conflicto de coherencia (p. ej. moneda no habilitada) → código específico (`currency_not_enabled`).
- **Lectura**: **sin caché entre peticiones en v1** (el catálogo es pequeño y se lee poco); memoización por petición. Un cambio es visible en la siguiente petición.
- **`updated_by`/`updated_by_key`**: siempre hay actor (humano o clave), coherente con task-01.

## 7. Wizard de instalación (`/setup`)

### 7.1 Detección y seguridad

- Se muestra **solo** si no existe ningún `super_admin` (`requires_setup` en `/instance`). Al crear el primero, desaparece y el acceso pasa a requerir sesión.
- **Ventana de instalación**: es el único momento de alta sin invitación (auth §3bis). Mitigaciones: **rate limiting por IP** (task-02 §4), cuerpo del wizard **sin secretos de instancia**, y **auditoría** del alta (`admin_actions`).
- El wizard es **resumible**: cada paso guarda su progreso en `settings`; si se interrumpe, se retoma.
- **No expone** ninguna clave maestra ni credencial de Supabase.

### 7.2 Pasos

| # | Paso | Qué muestra | Qué verifica | Qué escribe |
|---|---|---|---|---|
| 1 | **Supabase** | Guía de variables de entorno (URL, anon, service) + migraciones | Conexión con el proyecto, migraciones aplicadas, `JWT_EXPIRY = 900 s` (decodifica un JWT de prueba) | — (env del hosting) |
| 2 | **SMTP** | Guía del dashboard de Supabase (Resend/Brevo) | Envía un **email de prueba** y pide confirmación de recepción | — (proyecto Supabase) |
| 3 | **Preferencias** | Formulario | Validación de tipos (§4) | `global.*` + `connectivity.public_url` |
| 4 | **Notificaciones** (opcional) | Formulario FCM; se puede **omitir con aviso explícito** ("sin Firebase no recibirás notificaciones con la app cerrada") | Coherencia de las 5 claves; el service account parsea como JSON con campos requeridos | `notifications.push.*` |
| 5 | **Super admin** | Email + contraseña (mín. requisitos de Supabase) | Crea el usuario (Admin API) y `profiles.role = super_admin` | `profiles` + `auth.users` |

- **Orden**: 1 → 2 → 3 → 4 → 5. El paso 4 es saltable; los demás no.
- **Al terminar**: `/instance` deja de reportar `requires_setup`; el wizard redirige al login.
- **Banner de push**: si el paso 4 se omitió, el panel muestra "Push no configurado" con enlace a Ajustes → Notificaciones (task-04 §6.2).

## 8. Decisiones tomadas (conversación de diseño, 2026-10-26)

| # | Decisión |
|---|---|
| A | **Frontera wizard**: Supabase, SMTP y `JWT_EXPIRY` se **guían y verifican** (viven en env/dashboard, imposible escribirlos desde la app); el wizard **escribe** preferencias, FCM y el primer `super_admin` |
| B | **Wizard de 5 pasos** (Supabase → SMTP → preferencias → notificaciones opcional → super admin), resumible, protegido por rate limit y auditoría |
| C | **Catálogo v1** de 17 claves del Core con tipos zod, defaults, secreto, `is_public` y `mcp_access` (§4) |
| D | **Cifrado AES-256-GCM** con clave maestra en env y formato versionado `v1:iv:tag:ciphertext` (rotación posible) |
| E | **`settings_public`** = solo nombre, zona, moneda, idiomas y los `fcm_*` públicos; nunca CORS, rate limits ni secretos |
| F | **Settings no secretos leídos por cualquier admin; escritos solo `is_admin()`**; secretos enmascarados en `GET /settings` y auditados sin valor |
| G | **Sin caché entre peticiones** en v1; el cambio es visible en la siguiente petición |
| H | **Moneda default**: debe estar habilitada; deshabilitarla está prohibido (task-01). Idiomas: subconjunto del set de 9 con `en` obligatorio |

## 9. Fuera de alcance

- **Variables de entorno y despliegue** (Vercel, Supabase project) → `docs/flows/cicd.md` e infraestructura/runbook.
- **Proveedor SMTP concreto** → `sprint-infra` (puerta de usuario).
- **Configuración de Firebase de tu instancia** → `sprint-infra` task-08.
- **Catálogo de claves de cada módulo** → manifest y spec del módulo.
- **Rotación de la clave maestra** (procedimiento operativo completo) → runbook de infraestructura.
- **UI del panel de ajustes** → sprint-web (task-12 shell).

## 10. Criterios de aceptación

- El catálogo v1 está definido con tipo, default, secreto, `is_public`, `mcp_access` y validación cruzada (push coherente, moneda habilitada, `en` obligatorio).
- Los secretos se cifran con AES-256-GCM y clave maestra en env; nunca aparecen en API, logs, eventos ni `settings_public`; el fallo de descifrado degrada de forma controlada.
- Un admin puede leer/escribir settings con validación zod; el no-admin no; cada escritura queda auditada **sin el valor**.
- `/instance` expone exactamente `settings_public` (sin CORS/rate limits/secretos) y `requires_setup`.
- El wizard de 5 pasos está especificado: guía+verifica lo externo, escribe lo propio, es resumible, protegido y desaparece al crear el primer `super_admin`.
- Coherente con task-01/02/03/04/05, ADR 0007/0008, auth §3bis/§5bis y api-v1.
- Aprobada por el usuario, revisada por segundo agente y **auditoría OWASP** (toca secretos y auth).

## 11. Referencias

- Spec de datos: `docs/superpowers/specs/2026-10-26-core-data-model.md`
- Spec de API del Core: `docs/superpowers/specs/2026-10-26-core-api.md`
- Spec de auth: `docs/superpowers/specs/2026-10-25-auth.md` §3bis/§5bis
- Spec de realtime: `docs/superpowers/specs/2026-10-26-realtime-notificaciones.md` §6
- Spec de módulos: `docs/superpowers/specs/2026-10-26-modulo-system.md` §3
- Spec de MCP: `docs/superpowers/specs/2026-10-26-mcp.md` §4.4
- ADRs: `docs/adr/0007-manejo-de-errores.md`, `0008-fechas-y-moneda.md`
- Plan del sprint: `docs/superpowers/plans/2026-10-26-sprint-core-design.md`
- Task: `docs/tasks/sprint-core-design/task-06.md`