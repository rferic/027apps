# Spec — Core: modelo de datos y accesos (sprint 04, task 01)

**Fecha:** 2026-10-26
**Estado:** Borrador para aprobación del usuario
**Base:** [spec de diseño §4/§8](2026-10-24-027apps-design.md) (capacidades transversales, borrador de datos) · [spec de tokens §5/§7](2026-10-25-token-model.md) (scopes por acción, evolución del modelo) · [spec de auth](2026-10-25-auth.md) (frontera Supabase, invitación, wizard) · [spec de API v1](2026-10-25-api-v1.md) (**con delta 2026-10-26**: `groups`→`user_categories`, `/me/modules`) · [ADR 0004](../../adr/0004-bordes-y-capa-de-aplicacion.md) (casos de uso, guard, scopes) · [ADR 0007](../../adr/0007-manejo-de-errores.md) (envelope, `request_id`, `admin_actions`) · [ADR 0008](../../adr/0008-fechas-y-moneda.md) (timezone, config de instancia, moneda) · testing strategy (D2, aislamiento)
**Decide el usuario:** reframe Categoría ≠ Grupo de módulo + decisiones A–J de la conversación de diseño (2026-10-26)

## 1. Objetivo

Definir el **modelo de datos del Core** — la superficie transversal que comparten todos los módulos — y su **modelo de permisos + RLS**, tras el reframe acordado: **en el Core no hay "grupos de datos"; las categorías son etiquetas de usuarios y los grupos reales pertenecen a cada módulo.** Esta spec es la fuente del esquema; la implementación (TDD, migraciones, checks de determinismo) es tarea posterior del backlog del Core.

**Límite de alcance:** aquí se fija el **esquema lógico** (tablas, columnas, invariantes, RLS, contrato de aislamiento). El catálogo concreto de claves de `settings` (task-06), la mecánica del instalador de módulos (task-03), el inventario de endpoints (task-02) y el contrato de eventos (task-04) se especifican en sus propias tareas sobre esta base.

## 2. Reframe rector (decisión del usuario, 2026-10-26)

| | Core | Módulo (p. ej. Split Expenses) |
|---|---|---|
| Qué es "grupo" | **Categoría/etiqueta de usuarios** ("familia", "amigos") | Grupo real de datos (grupo de gastos, sus miembros, saldos) |
| Quién lo define | El `super_admin` de la instancia | El caso de uso del módulo |
| Dónde vive | Tablas del Core (`user_categories`, `user_category_members`) | **Tablas propias del módulo** (`expense_groups`, …) |
| Rol | Solo `super_admin` (instancia) + usuario con acceso a módulos | Roles del módulo (admin de grupo de gastos, etc.) |
| RLS | Derivada de identidad + acceso a módulo | La define el módulo sobre sus tablas, apoyándose en el Core |

**Consecuencias directas:**
- `participants` y `group_members` **no existen en el Core**. Cada módulo modela sus propios participantes (con enlace opcional a `profiles.id` para los "ficticios"). Claiming, miembros, etc. son concepto de módulo.
- El **acceso a módulos** es **por usuario** (`user_modules`) y **viaja con él**: si un usuario cambia de categoría, sus concesiones no cambian (decisión A2).
- Los módulos referencian `profiles.id` del Core cuando necesitan "una persona de la plataforma"; el resto es suyo.
- **No hay tabla de permisos (RBAC)**: el permiso efectivo se **deriva** en tiempo de petición de (rol + `user_modules` + scopes por acción del ADR 0004). Permisos configurables por grupo/categoría → se revisa si algún día aparece un caso real (YAGNI).

## 3. Modelo de datos

Convenciones (ADR 0008): IDs `uuid`, instantes `timestamptz` ISO 8601 UTC, fechas de calendario `date`, dinero nunca en el Core (los módulos lo gestionan con `amount_minor`+`currency`). Errores de integridad → `conflict`/`validation_failed` (ADR 0007). `created_at`/`updated_at` implícitos donde no se diga.

### 3.1 Identidad y categorización

**`profiles`** — la persona de la plataforma (id = `auth.users.id`, Supabase).
| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | = `auth.users.id` |
| `display_name` | text NOT NULL | |
| `locale` | text NOT NULL | default = locale de la instancia (ADR 0008) |
| `timezone` | text NOT NULL | default = zona de la instancia (ADR 0008) |
| `role` | text NOT NULL DEFAULT `user` CHECK (`super_admin`\|`admin`\|`user`) | **jerarquía de 3 roles** (decisión usuario, 2026-10-26): `super_admin` (top, no borrable, root de `/setup`), `admin` (gestiona la instancia + crea/actualiza admins, no crea super_admins ni borra el root), `user` (acceso a sus módulos). `super_admin`/`admin` acceden a **todos los módulos** (públicos y privados). Escritura del rol solo vía `/setup` (primero) y API por un admin/super_admin (nunca el propietario sobre su propia fila — ver §5) |
| `deactivated_at` | timestamptz NULL | **desactivación soft** (task-02 §3.2, task-05): revoca sesiones, `user_modules` y api-keys al instante; el perfil y su historial **no se borran**. Reactivación = limpiar el campo. Los listados excluyen desactivados salvo filtro explícito |
| `created_at`, `updated_at` | timestamptz | |

> **Contraseñas y credenciales (OWASP, decisión P):** el Core **nunca** almacena contraseñas, hashes de contraseña, tokens de sesión ni secretos de Supabase en tablas propias. La identidad y su autenticación viven íntegramente en **Supabase Auth** (hashes bcrypt server-side, reset, rate limiting del login — auth §2/§4); `profiles.id` es solo la referencia. Los secrets de la instancia (SMTP, LLM, clientes MCP) van cifrados en `settings.value_encrypted` con clave maestra en env (spec §8); nunca en claro ni en logs. Verificado por `guard-secrets` (CI) y auditoría OWASP (task-10).

**`user_categories`** — etiqueta de usuarios creada por un `admin`/`super_admin`.
| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `name` | text NOT NULL | "Familia", "Amigos", … |
| `slug` | text UNIQUE NOT NULL | para URLs/identificación |
| `created_by` | uuid NULL → `profiles.id` | actor humano |
| `created_by_key` | uuid NULL → `api_keys.id` | actor clave de máquina (MCP/API); **exactamente uno** de `created_by`/`created_by_key` |
| `created_at` | timestamptz | |
| — | CHECK `num_nonnulls(created_by, created_by_key) = 1` | |

**`user_category_members`** — M2M usuario ↔ categoría (un usuario puede estar en varias categorías).
| Columna | Tipo | Notas |
|---|---|---|
| `user_category_id` | uuid NOT NULL → `user_categories.id` | PK compuesta |
| `user_id` | uuid NOT NULL → `profiles.id` | PK compuesta |
| `created_at` | timestamptz | |

> La categoría **nunca** concede permisos por sí misma (no es un rol): es clasificación y plantilla de asignación (3.2).

### 3.2 Acceso a módulos

**`module_registry`** — el registro de módulos instalados en la instancia (contrato de plugin, task-03). **Ciclo de vida** (decisión usuario, 2026-10-26): `installed` (DDL aplicado) → `active` (disponible) → `disabled` (desactivado, DDL intacto) → *uninstall* (estado eliminado + rollback de `module_migrations`).
| Columna | Tipo | Notas |
|---|---|---|
| `key` | text PK | p. ej. `split-expenses` |
| `name` | text NOT NULL | |
| `version` | text NOT NULL | versión instalada actual |
| `state` | text NOT NULL CHECK (`installed`\|`active`\|`disabled`) | `installed`/`active` = disponible; `disabled` = no disponible pero DDL intacto; **uninstall** = `DELETE` de la fila + reversión de migraciones (`module_migrations` `down`) |
| `is_public` | bool NOT NULL DEFAULT false | módulo **público** (todos los usuarios lo usan sin `user_modules`) vs **privado** (solo admins + usuarios con concesión). Default lo declara el manifest; override por super_admin en el panel |
| `mcp_exposed` | text NOT NULL DEFAULT `read` CHECK (`none`\|`read`\|`read_write`) | **exposición MCP** (task-05, decisión E): `none` = no expuesto; **`read` (default)** = solo tools de lectura; `read_write` = también escrituras. El admin lo cambia por módulo sin desinstalar; afecta a `tools/list` y a la ejecución |
| `manifest_digest` | text NOT NULL | hash del manifest validado (contrato, task-03) |
| `installed_at`, `updated_at` | timestamptz | secreto: no modificar fuera del instalador |

**`module_migrations`** — historial de DDL aplicado por módulo (permite install/desinstalar/actualizar con rollback).
| Columna | Tipo | Notas |
|---|---|---|
| `module_key` | text NOT NULL → `module_registry.key` | |
| `version` | text NOT NULL | versión de la migración |
| `direction` | text NOT NULL CHECK (`up`\|`down`) | |
| `ddl_digest` | text NOT NULL | hash del DDL aplicado (verificación anti-tamper) |
| `applied_at` | timestamptz | |
| — | PK `(module_key, version, direction)` | |

**`module_channels`** — canales realtime que declara cada módulo (task-04, ADR 0009). El Core los persiste al instalar y los borra al desinstalar; **la política RLS de `realtime.messages` la crea el Core una sola vez** y lee de aquí.
| Columna | Tipo | Notas |
|---|---|---|
| `module_key` | text NOT NULL → `module_registry.key` | |
| `pattern` | text UNIQUE NOT NULL | topic del módulo con `{id}` = uuid (p. ej. `expense-group-{id}`) |
| `members_fn` | text NOT NULL | nombre de la función SQL del módulo (validado por `^[a-z][a-z0-9_]{0,62}$`); `security definer`, `search_path=''`, `STABLE`, `EXECUTE` revocado de PUBLIC |
| `created_at` | timestamptz | |
| — | PK `(module_key, pattern)` | |

**`event_outbox`** — outbox transaccional de eventos de dominio (task-04, decisión E: entrega **at-least-once**).
| Columna | Tipo | Notas |
|---|---|---|
| `event_id` | uuid PK | idempotencia (`(event_id, module_key)` para hooks) |
| `module_key` | text NULL → `module_registry.key` | NULL = evento del Core |
| `type` | text NOT NULL | `expense.created`, `user.deactivated`, … |
| `target` | text NOT NULL | `admins`\|`all`\|`user`\|`channel:<topic resuelto>` (metadato interno, **no** viaja al cliente) |
| `subject_id` | uuid NULL | sujeto del evento cuando `target = user` |
| `resource` | jsonb NOT NULL | representación compartida |
| `payload` | jsonb | datos no sensibles |
| `notify` | text[] NULL | p. ej. `{push}` |
| `state` | text NOT NULL CHECK (`pending`\|`published`\|`failed`) | |
| `attempts` | int NOT NULL DEFAULT 0 | |
| `next_attempt_at` | timestamptz NULL | backoff exponencial |
| `hook_applied` | text[] NULL | módulos cuyo hook ya se aplicó (idempotencia) |
| `created_at`, `published_at` | timestamptz | purga por retención (job, task-07) |

**`idempotency_keys`** — registro de idempotencia de escrituras (task-05 decisión F); el mismo patrón sirve a MCP y a REST.
| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `api_key_id` | uuid NULL → `api_keys.id` | llamador por clave (MCP/API) |
| `user_id` | uuid NULL → `profiles.id` | llamador por sesión (móvil/admin) |
| `endpoint` | text NOT NULL | `mcp:admin`, `mcp:split-expenses`, `rest:/api/v1/…` |
| `tool` | text NOT NULL | tool o acción |
| `key` | text NOT NULL | `idempotency_key` del cliente (o el `id` del recurso creado) |
| `request_hash` | text NOT NULL | hash del payload normalizado |
| `state` | text NOT NULL CHECK (`pending`\|`done`) | `pending` = en vuelo |
| `response` | jsonb NULL | respuesta **no sensible** cacheada (nunca tokens/secretos) |
| `expires_at` | timestamptz NOT NULL | TTL (24 h por defecto) |
| `created_at` | timestamptz | |
| — | CHECK `num_nonnulls(api_key_id, user_id) = 1` · **dos índices únicos parciales** (H5): `(api_key_id, endpoint, tool, key) WHERE api_key_id IS NOT NULL` y `(user_id, endpoint, tool, key) WHERE user_id IS NOT NULL` | como una columna siempre es NULL, un `UNIQUE` simple **no** garantiza unicidad (`NULL = NULL` no colisiona) |

> **Reglas**: se escribe en la **misma transacción** que la mutación; mismo `request_hash` → replay del resultado; hash distinto → `conflict`; `pending` concurrente → `conflict` con `retry_after`; purga por job (task-07).
>
> **Normalización del hash (H6)**: JSON canónico — claves en orden lexicográfico, números normalizados, `null` explícito ≠ campo ausente, sin espacios; el mismo algoritmo en REST y MCP (helper compartido con test). El replay es **el resultado de aquella mutación**, no el estado actual del recurso (H11).

**`user_modules`** — la **concesión real**: el usuario tiene acceso a este módulo. **El permiso va con el usuario.**

| Columna | Tipo | Notas |
|---|---|---|
| `user_id` | uuid NOT NULL → `profiles.id` | |
| `module_key` | text NOT NULL → `module_registry.key` | |
| `granted_by` | uuid NULL → `profiles.id` | quién concedió (humano) |
| `granted_by_key` | uuid NULL → `api_keys.id` | quién concedió (clave de máquina, MCP/API) |
| `created_at` | timestamptz | |
| `revoked_at` | timestamptz NULL | revocación individual (soft) |
| — | PK `(user_id, module_key)` | |

> **`granted_by` y re-grant** (hallazgo de revisión): al canjear una invitación, `granted_by` = el `super_admin`/admin que creó la invitación (o el definer del canjeo). Un **re-grant** tras una soft-revocación (`revoked_at` no nulo) es un **UPDATE que limpia `revoked_at`**, no un INSERT (la PK es `(user_id, module_key)`); la semántica "re-asignar = resucitar la concesión" queda fijada. Las concesiones mediadas por clave `service` (p. ej. tools MCP, task-05) no tienen `profiles.id` como `granted_by` → se permite `granted_by` NULL **solo** en ese caso (o un sentinel documentado), resuelto en task-02/05; el resto exige un actor humano. **CHECK `num_nonnulls(granted_by, granted_by_key) = 1`**: siempre hay un actor identificable, humano o clave — nunca un perfil sintético.

**`user_category_modules`** — **plantilla de asignación masiva** (decisión A2: **materializa**).
| Columna | Tipo | Notas |
|---|---|---|
| `user_category_id` | uuid NOT NULL → `user_categories.id` | |
| `module_key` | text NOT NULL → `module_registry.key` | |
| `assigned_by` | uuid NULL → `profiles.id` | actor humano |
| `assigned_by_key` | uuid NULL → `api_keys.id` | actor clave de máquina |
| `created_at` | timestamptz | |
| — | PK `(user_category_id, module_key)` · CHECK `num_nonnulls(assigned_by, assigned_by_key) = 1` | |

**Semántica (decisión A2):** asignar un módulo a una categoría = **materializar** `user_modules` para los miembros **actuales** de la categoría (transacción: insert `user_modules` por cada `user_category_members`, si no existe). Los que entren después **no** lo heredan automáticamente — la categoría es un lote inicial, no un vínculo vivo. Revocar en la categoría **no** revoca concesiones ya materializadas (se revoca por usuario cuando toque). La fila `user_category_modules` queda como trazabilidad del lote.

### 3.3 Configuración, monedas y traducciones

**`settings_categories`** — categoría de settings (decisión usuario, 2026-10-26): agrupa, ordena e iconiza los settings en el panel. Las categorías del Core nacen por seed/instalador; las de módulo las registra el **manifest** al instalarse (task-03).
| Columna | Tipo | Notas |
|---|---|---|
| `category_key` | text PK | `global`, `connectivity`, `notifications`, `security`, `split_expenses`, … (la key de cada setting lleva este prefijo) |
| `label` | text NOT NULL | texto en inglés (la capa i18n lo traduce; **nunca** una clave i18n) — ver `translations` |
| `help` | text NULL | descripción en inglés (idem) |
| `icon` | text NULL | icono del DS o del paquete del módulo |
| `sort_order` | int NOT NULL | orden en el panel |
| `source` | text NOT NULL | `core` (seed/instalador) o `module:<key>` (manifest) |
| `created_at`, `updated_at` | timestamptz | |

**`settings`** — los valores de configuración, **categorizados** (decisión usuario, 2026-10-26; sustituye al `instance_settings` plano de la spec §8).
| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `category_key` | text NOT NULL → `settings_categories.category_key` | |
| `key` | text NOT NULL | única dentro de su categoría; **key completa = `{category_key}.{key}`** |
| `label` | text NOT NULL | texto en inglés para el panel (traducido por la capa i18n) |
| `help` | text NULL | ayuda en inglés (idem) |
| `value` | jsonb NULL | config **no sensible** en claro (ADR 0008): zona, moneda default, idiomas activos, `connectivity.cors_allowlist`… |
| `value_encrypted` | text NULL | **secrets cifrados** con clave maestra en env (spec §8): SMTP propio, LLM BYOK, secrets de clientes MCP |
| `is_secret` | bool NOT NULL DEFAULT false | invariante (CHECK en el esquema): `is_secret = true` ⇒ `value_encrypted` NOT NULL y `value` NULL; `is_secret = false` ⇒ `value_encrypted` NULL |
| `is_public` | bool NOT NULL DEFAULT false | **visibilidad** (decisión usuario 2026-10-26, distinta de `is_secret`): `true` = legible por usuarios (bloque `settings_public` de `/instance` para claves del Core; para módulos, usuarios con acceso). `false` = solo admin. Catálogo en task-06; **el usuario nunca edita settings** |
| `mcp_access` | text NOT NULL DEFAULT `none` CHECK (`none`\|`read`\|`write`) | **exposición por MCP** (task-05 §4.4, task-06 §4): `none` en `security.*`/`connectivity.*`/`auth.*`; `settings_get`/`settings_update` solo operan sobre `read`/`write` |
| `sort_order` | int NOT NULL | orden dentro de la categoría |
| `updated_by` | uuid NULL → `profiles.id` | actor humano (solo `is_admin()` escribe) |
| `updated_by_key` | uuid NULL → `api_keys.id` | actor clave de máquina (MCP/API) |
| — | CHECK `num_nonnulls(updated_by, updated_by_key) = 1` | siempre hay actor |
| `updated_at` | timestamptz | |
| — | `UNIQUE (category_key, key)` | |

> Invariante: `UNIQUE (category_key, key)` garantiza el prefijo sin depender de la disciplina del que escribe. El catálogo de tipos zod / validaciones / quién lee cada clave se define en task-06; aquí solo la forma.

**`currencies`** — listado de monedas disponibles en la instancia (decisión del usuario: lista desactivable + default).
| Columna | Tipo | Notas |
|---|---|---|
| `code` | text PK | ISO 4217 (`EUR`, `USD`,…) |
| `enabled` | bool NOT NULL DEFAULT true | se pueden desactivar; la default no se desactiva |
| `created_at` | timestamptz | |

**Default de moneda**: `settings['global.default_currency']` (una de las `currencies.enabled`). Los módulos toman el default de aquí y **sobreescriben por concepto** cuando lo necesitan (p. ej. un grupo de gastos con su propia moneda — config del módulo, no del Core).

**`translations`** — gestión de traducciones del Core (decisión usuario, 2026-10-26): el texto **en inglés es la clave legible**, estilo Laravel/gettext; la capa i18n resuelve `locale → fallback en`; el Core permite importar, detectar faltantes y medir cobertura.
| Columna | Tipo | Notas |
|---|---|---|
| `locale` | text NOT NULL | de los locales activos (`settings['global.active_locales']`, ADR 0008) |
| `text_hash` | text NOT NULL | SHA-256 del `text_en`; lookup/import estable (una edición del original crea entrada nueva, no rompe en silencio) |
| `text_en` | text NOT NULL | **la clave**: el texto en inglés |
| `translated_text` | text NOT NULL | el valor traducido |
| `context` | text NULL | de dónde viene (p. ej. `settings.global.default_currency`, `modules.split_expenses.*`) |
| `source` | text NOT NULL | `code` (set commiteado, ADR 0008), `module:<key>` (manifest), `import`, `manual` |
| `updated_by` | uuid NULL → `profiles.id` | |
| `created_at`, `updated_at` | timestamptz | |
| — | `UNIQUE (locale, text_hash)`, índice por `text_en` | |

> **Resolución en runtime** (kernel en task-02): `resolve(text_en, locale) = translations(locale, hash) ?? translations(en) ?? text_en` — **nunca** una clave sin traducir "seca"; el texto en inglés es siempre el último recurso. **Cobertura/detección** (task-09 + sprint-web): % traducido por locale y faltantes = consultas sobre esta tabla; la importación compara por `text_hash`. La **check de CI de ADR 0008 sigue igual** (set commiteado determinista) y alimenta esta tabla como `source: code`; el store runtime la extiende, no la sustituye.

### 3.4 Invitación

**`invitations`** — vehículo único de alta (auth §3). **Email + nombre + categoría + módulos** (decisión B).
| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `email` | text NOT NULL | el invitado puede modificarlo al registrarse (auth §3) |
| `name` | text NOT NULL | nombre propuesto (el invitado confirma) |
| `user_category_id` | uuid NULL → `user_categories.id` | **solo clasificación**, no concede permisos |
| `token_hash` | text UNIQUE NOT NULL | token de un solo uso, **solo hash** (spec de tokens §6) |
| `expires_at` | timestamptz NOT NULL | |
| `used_at` | timestamptz NULL | single-use (se marca al canjear) |
| `created_by` | uuid NULL → `profiles.id` | actor humano (admin autorizado por scopes) |
| `created_by_key` | uuid NULL → `api_keys.id` | actor clave de máquina (MCP) |
| — | CHECK `num_nonnulls(created_by, created_by_key) = 1` | siempre hay actor |
| `created_at` | timestamptz | |

**`invitation_modules`** — módulos que el invitado tendrá acceso al aceptar (decisión B: el permiso viene de **aquí**, no del grupo).
| Columna | Tipo | Notas |
|---|---|---|
| `invitation_id` | uuid NOT NULL → `invitations.id` | |
| `module_key` | text NOT NULL → `module_registry.key` | |
| — | PK `(invitation_id, module_key)` | |

> Al canjear: se crea/verifica `profiles` (Supabase Admin API), se inserta `user_category_members` si hay `user_category_id`, y se **materializan** los `user_modules` de `invitation_modules`. La revocación de concesiones es posterior y por usuario (3.2).

### 3.5 Tokens de máquina

**`api_keys`** — tokens opacos service/delegado (spec de tokens §3.2/§3.3). **Sin `group_id`** (la clave es de instancia o de usuario, no "de grupo").
| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `key_hash` | text UNIQUE NOT NULL | SHA-256, prefijo `027_svc_`/`027_usr_` (spec de tokens §3: taxonomía) |
| `kind` | text NOT NULL CHECK (`service`\|`delegated`) | service = instancia; delegated = actúa como `user_id` |
| `name` | text NOT NULL | etiqueta visible en el panel |
| `scopes` | text[] NOT NULL | scopes por acción (ADR 0004 §2) |
| `user_id` | uuid NULL → `profiles.id` | NOT NULL si `delegated`; NULL si `service` |
| `role_cap` | text NULL CHECK (`admin`\|`super_admin`) | solo para `service`; **CHECK `(kind = 'service') = (role_cap IS NOT NULL)`** (una delegada nunca lleva cap). Techo de permisos: `min(scopes, role_cap)`. Default `admin`; crear una clave con `super_admin` exige ser `super_admin` (task-05 D) |
| `created_by` | uuid NOT NULL → `profiles.id` | |
| `expires_at` | timestamptz NULL | opcional (spec §6) |
| `revoked_at` | timestamptz NULL | revocación instantánea |
| `last_used_at` | timestamptz NULL | auditoría de uso (§3.7) |
| `created_at` | timestamptz | |

### 3.6 Dispositivos

**`devices`** — información del dispositivo para push y panel "revocar dispositivo" (en v1, decisión usuario).
| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid NOT NULL → `profiles.id` | |
| `platform` | text NOT NULL | `android`; `ios` futuro (spec §2) |
| `push_token` | text **UNIQUE** NULL | token de push (FCM) para notificaciones (task-04); UNIQUE permite reasignar el token si el móvil cambia de usuario; **varios dispositivos por usuario** permitidos |
| `last_seen_at` | timestamptz | |
| `revoked_at` | timestamptz NULL | revocado en el panel (soft); la sesión se revoca además vía Admin API de Supabase |
| `created_at` | timestamptz | |

> No es un token de sesión: la sesión la gestiona Supabase Auth. Revocar dispositivo en el panel → via Admin API de Supabase + marca `revoked_at` en `devices` (auth §5, decisión de task-02).

### 3.7 Auditoría y admin

**`audit`** — uso **agregado** de tokens de máquina (spec de tokens §6: sin log por petición).
| Columna | Tipo | Notas |
|---|---|---|
| `api_key_id` | uuid NOT NULL → `api_keys.id` | |
| `endpoint` | text NOT NULL | |
| `count` | int NOT NULL DEFAULT 0 | |
| `window_start` | timestamptz NOT NULL | agregación por ventana |
| `window_end` | timestamptz | |
| — | PK `(api_key_id, endpoint, window_start)` | |
| Escritura | API (incremento/cierre de ventana, job task-07) | sin token en claro |

**`admin_actions`** — log de **mutaciones sensibles** (decisión usuario, 2026-10-26): quién hizo qué, cuándo, con qué `request_id`.
| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `actor_id` | uuid NULL → `profiles.id` | quién ejecutó (NULL si fue job/clave service) |
| `api_key_id` | uuid NULL → `api_keys.id` | si fue una clave de máquina |
| `action` | text NOT NULL | `invitation.create`, `key.revoke`, `settings.update`, `module.install`, `category.assign`… |
| `subject` | text NULL | referencia legible (uuid o key del recurso tocado) |
| `request_id` | uuid NULL | correlación con logs (ADR 0007 §6) |
| `details` | jsonb NULL | datos no sensibles; **nunca secrets/tokens en claro** |
| `created_at` | timestamptz | inmutável (append-only) |

> Es un log de seguridad, no un log por petición. No contiene el token, solo su `request_id`/referencia. La política de retención se fija en task-07/10 si procede.

### 3.8 Semántica de borrado y desinstalación

Principio rector (spec §12 y decisión de revisión): **el dato no se borra a la ligera — se archiva, se marca o se restringe**. Reglas por ámbito:

- **`profiles`**: nunca hard-delete si hay referencias de historial (invitaciones que creó, concesiones, dispositivos, acciones de admin) — se desactiva (`deleted_at`/soft) o se mantiene inerte. El borrado físico real queda como operación de super_admin explícita y documentada (task-02).
- **`user_categories` / `user_category_members`**: borrar una categoría **no** revoca concesiones ya materializadas (`user_modules`) — la categoría es plantilla, no vínculo vivo (decisión A2). `user_category_members` puede hard-delete al "expulsar" (no afecta a concesiones); `user_categories` se puede hard-delete si no tiene `user_category_modules`/invitaciones pendientes que la referencien (restringir o vaciar antes).
- **`module_registry`**: la **desinstalación (uninstall)** es el único borrado de módulo: `DELETE` de la fila + reversión de todas sus `module_migrations` (`direction: down`). Mientras el DDL esté aplicado, la fila permanece en `installed`/`active`/`disabled` — **no** se borra a medias. FKs desde `user_modules`/`user_category_modules`/`invitation_modules`/`settings_categories` (`source: module:<key>`) → `RESTRICT` o `CASCADE` explícito decidido en task-03 (por defecto: no se desinstala un módulo con concesiones/settings en uso sin confirmación).
- **`module_migrations`**: inmutable (append-only); solo el instalador escribe; la reversión registra filas `direction: down`.
- **`settings` / `settings_categories` / `currencies`**: sin borrado casual; desactivar (`enabled=false`, `sort_order`/`disabled`) en lugar de borrar. La **moneda default no se desactiva** (invariante de negocio; enforcement en el caso de uso, task-06).
- **`invitations` / `api_keys` / `devices` / `admin_actions` / `audit`**: soft (`used_at`, `revoked_at`, `expires_at`) o append-only (`audit`, `admin_actions`); sin hard-delete salvo purga explícita de retención (task-07/10).

> El detalle por tabla (FK `ON DELETE` concreto, purgas) se decide en task-02 (API) y task-03 (instalador); esta sección fija el principio y las reglas generales.

## 4. Modelo de permisos (sin tabla RBAC)

El permiso efectivo se **deriva por petición** (ADR 0004 §2, spec de tokens §5):

| Llamador | Permiso efectivo |
|---|---|
| Móvil (JWT Supabase) | `super_admin`/`admin` → **acceso a todos los módulos** (públicos y privados). `user` → los módulos **públicos** (`is_public`) + los de sus `user_modules` sin revocar; los scopes de las acciones que esos módulos habilitan. `is_super_admin`/`is_admin` → además poderes de gestión de la instancia |
| Clave delegada (`027_usr_`) | `min(scopes de la clave, permisos del usuario)` |
| Clave service (`027_svc_`) | scopes de la clave (sin identidad de usuario; ver §6: definer de servicio) |
| Admin web | Igual que el móvil + las acciones de `super_admin`/`admin` según su rol |

**Regla**: los scopes son **por acción expuesta** (cada puerta declara los scopes que exige — ADR 0004 §2). La concesión de módulos (`user_modules`) es el **gate** de qué scopes "existen" para el usuario; el guard los comprueba; RLS es la segunda barrera.

## 5. RLS (por tabla)

Patrón de **security definer functions** canónicas (task-10 lo formaliza):
- `is_super_admin()` → `profiles.role = 'super_admin'` de `auth.uid()`
- `is_admin()` → `profiles.role IN ('super_admin','admin')` de `auth.uid()`
- `has_module_access(key)` → `is_admin() OR module_registry.is_public OR existe user_modules(user_id = auth.uid(), module_key = key)` sin `revoked_at`
- `is_service(caller)` → la puerta/definer identifica llamador service (JWT de servicio emitido por nuestra API, no Supabase) — ver §6

| Tabla | Política RLS |
|---|---|
| `profiles` | read: la propia fila (`auth.uid() = id`) + `super_admin`/`admin` leen todos (panel); write: la propia fila **solo en columnas no sensibles** (`display_name`, `locale`, `timezone`). **`role` NO es editable por el propietario**: solo el wizard `/setup` (primer super_admin, auth §3bis) y la API (caso de uso con scope, ADR 0004) lo cambian — se implementa con grant a nivel de columna o trigger en el patrón RLS canónico (task-10). Varios admins/super_admins son válidos; el root de `/setup` no es borrable (decisión de roles) |
| `user_categories`, `user_category_members` | read: `is_admin()` (gestión) + miembro de la categoría (ver su etiqueta); write: **solo la API/`is_admin()`** (la membresía la inserta el caso de uso de canjeo o un admin, **nunca el miembro sobre sí mismo**) |
| `module_registry` | read: cualquier autenticado (para `/me/modules`/catálogo); write: **solo el instalador** (via service/API con scope, no RLS directo) |
| `module_migrations` | read: **solo `is_super_admin()`/service (instalador)** — el historial de DDL no lo necesita ningún usuario normal; write: **solo el instalador** |
| `user_modules` | read: el propio usuario (sus concesiones) + `is_admin()`; write: **solo `is_admin()` (o definer de servicio acotado)** — la concesión/revocación la ejecuta la API, el usuario **nunca** puede auto-concederse (la concesión de módulos es solo de admins) |
| `user_category_modules` | read: `is_admin()`; write: `is_admin()` (materialización vía caso de uso) |
| `settings_categories`, `settings` | read: `is_admin()` (config) / los no sensibles vía API `/instance` filter; write: `is_admin()` |
| `currencies` | read: **cualquier autenticado** (datos no sensibles: lista de monedas habilitadas, decisión M4); write: `is_admin()` |
| `translations` | read: cualquier autenticado (resolución i18n en runtime); write: `is_admin()` / pipeline de import (task-09) |
| `invitations`, `invitation_modules` | read: `is_admin()` (panel) + el registro de canjeo (flujo wizard); write: `is_admin()` / caso de uso de canjeo |
| `api_keys` | service: solo `is_super_admin()` (crear/revocar claves de instancia); delegado: el propietario (`user_id = auth.uid()`) + `is_admin()` |
| `devices` | read/write: el propio usuario; `is_admin()` para el panel de revocar |
| `audit` | read: `is_super_admin()`; write: solo API (service) |
| `admin_actions` | read: `is_super_admin()`; write: solo API (service) |
| **Gestión de roles** | `role` de un usuario: `admin` puede promocionar a `admin` y demotar `admin`; **solo `is_super_admin()`** crea/actualiza `super_admin`; el **root de `/setup` no es borrable** (invariante: siempre ≥1 `super_admin`) |

## 6. Claves de instancia (`027_svc_`) y RLS — el agujero decidido

Una clave `service` **no tiene usuario**: las políticas basadas en `auth.uid()` no le aplican. Decisión (decisión I de §8):

- **El guard es la barrera efectiva** para claves `service`: la puerta resuelve los scopes de la clave (spec §5) y el caso de uso valida los datos (qué grupo/categoría/entidad se toca). RLS **no** sustituye al guard en este caso.
- Las rutas que admiten llamador `service` usan un **definer de servicio** explícito y acotado (el JWT de servicio emitido por nuestra API para `sb_secret_*`/server, o la tabla `api_keys` resuelta por la puerta), **nunca** `service_role` camuflado en RLS por omisión.
- Regla de oro: **cualquier dato que una clave service pueda leer, el guard debe poder explicarlo por scopes**; RLS de servicio solo como refuerzo no como autorización (ADR 0004 §5).

## 7. Contrato de la suite de aislamiento (testing D2, adaptado al reframe)

La suite de aislamiento es **parte del DoD de toda tabla nueva** (testing §8). Para el Core, los casos base:

1. **Dos categorías**: un usuario de la categoría A no ve los datos que la categoría B otorgó a sus miembros (materialización aislada — la concesión es por fila `user_modules`, no por pertenencia viva).
2. **Dos usuarios con distinto acceso**: el usuario con `split-expenses` ve sus recursos; el que no lo tiene recibe `insufficient_scope`/`not_found` (nunca filtra el dato del otro).
3. **Revocación instantánea (solo de la concesión)**: al revocar `user_modules` (`revoked_at`), la siguiente petición deniega — sin TTL de permisos (spec de tokens §5). **Coherente con la decisión A2**: expulsar de una categoría **no** revoca las concesiones materializadas; el test que lo verifica es el caso 1 (la concesión es por fila `user_modules`, no por pertenencia viva).
4. **Aislamiento por tabla sensible**: `settings` (no sensibles legibles vía API pública `/instance` filtrado; secrets/`value_encrypted` jamás), `api_keys` (delegado no ve claves de otro usuario), `devices` (propietario), `audit`/`admin_actions` (solo super_admin), `translations` (un usuario cualquiera lee traducciones, no escribe).
5. **Claves service con scope mínimo**: una clave con `expenses:read` no lee `settings`, y su `audit` registra el uso con ventana.

Formato (testing §2/§3): suite SQL por tabla + script de dos usuarios/categorías con datos compartidos, verificación RLS y contrato API punta a punta. Job `supabase`/`rls` en CI → se añade en infra (nota de `testing-strategy.md` §2: "a añadir en infra, hoy no existe").

## 8. Decisiones tomadas (conversación de diseño, 2026-10-26)

| # | Decisión |
|---|---|
| A | **Categoría ≠ Grupo de módulo**: el Core no modela grupos de datos; los módulos tienen los suyos. `participants`/`group_members` fuera del Core |
| A2 | **Acceso a módulos por usuario** (`user_modules`), viaja con el usuario; `user_category_modules` es plantilla que **materializa** a los miembros actuales (los nuevos no heredan) |
| B | **Invitación** = email (modificable) + nombre + categoría (solo clasificación) + módulos a conceder al aceptar; el permiso viene de la invitación, no del grupo |
| C | **Monedas**: listado `currencies` desactivable + `default_currency` en `settings`; los módulos sobreescriben por concepto |
| D | **Permisos sin tabla RBAC**; derivados por petición (rol + `user_modules` + scopes por acción) |
| E | **`audit`** (uso agregado de tokens) + **`admin_actions`** (log de mutaciones sensibles) |
| F | **Módulos = plugins con contrato estricto** (`module_registry` + `module_migrations`); doc pública de "cómo crear tu módulo" (task-03/11) |
| G | **Settings categorizados**: `settings_categories` (key, label en inglés, icono, orden, source) + `settings` (categoría + key con `UNIQUE(category_key, key)` = prefijo garantizado, texto en inglés, `value`/`value_encrypted` con `is_secret`); los módulos registran su categoría por manifest (task-03) |
| H | **Delta API v1 (2026-10-26)**: `groups`→`user_categories`, `/me/modules`, config de módulo fuera de lo transversal, MCP lee categorías/usuarios |
| I | Claves service: **guard = barrera efectiva**; definer de servicio acotado; nunca `service_role` por omisión |
| J | **Traducciones del Core** (`translations`): el **texto en inglés es la clave** (estilo Laravel/gettext), fallback `locale → en`; el Core gestiona import, faltantes y cobertura; el kernel de resolución va en task-02, la pipeline en task-09, los strings de módulo viajan en el manifest (task-03) |
| K | **Ciclo de vida de módulos** (instalar → activar → desactivar → desinstalar): `module_registry.state` = `installed`\|`active`\|`disabled`; **uninstall** = borrado de la fila + reversión de `module_migrations` (DDL `down`); desinstalar un módulo con concesiones/settings en uso exige confirmación (task-03) |
| L | **RLS sin auto-escalado ni auto-concesión**: `profiles.role` no es editable por el propietario (solo `/setup` y API); `user_modules`/`user_category_members` write solo admin (jamás el usuario sobre sí mismo) |
| M | **Roles jerárquicos (3)**: `super_admin` (top, no borrable, root `/setup`) / `admin` (gestiona instancia, crea/actualiza **admins**, no crea super_admins ni borra el root) / `user`. **super_admin y admin acceden a todos los módulos** (públicos y privados) |
| N | **Módulos público/privado**: `module_registry.is_public` (default del manifest, override super_admin). **Público** = todos los usuarios lo usan sin `user_modules`; **privado** = solo admins + usuarios con concesión. `has_module_access` = `is_admin() OR is_public OR user_modules` |
| O | **Settings con visibilidad** (`settings.is_public`): distinta de `is_secret` (cifrado). `is_public` declarada **solo en el manifest del módulo** (task-03) o en el catálogo del Core (task-06); el **usuario nunca edita settings** |
| P | **Contraseñas fuera del Core**: identidad y hashes de contraseña en Supabase Auth (auth §2/§4); el Core nunca almacena contraseñas ni credenciales en BD (verificación `guard-secrets` + auditoría task-10) |
| Q | **Realtime y notificaciones** (task-04, ADR 0009): canales con destinatario, `module_channels`, `event_outbox` (at-least-once), `devices.push_token` UNIQUE |
| R | **MCP por módulo + generales** (task-05): `/mcp` (delegada), `/mcp/admin` (instancia con `role_cap`) y `/mcp/<module_key>` (módulo); `module_registry.mcp_exposed` (`none`\|`read`\|`read_write`, default `read`) regula la exposición |
| S | **`api_keys.role_cap`** (`admin`\|`super_admin`, solo service): una clave de instancia tiene techo de rol; permiso efectivo `min(scopes, role_cap)` (task-05) |
| T | **Actores de máquina**: `created_by_key`/`assigned_by_key`/`granted_by_key` con CHECK de exactamente un actor; nunca perfiles sintéticos |
| U | **`idempotency_keys`**: idempotencia de escrituras por `request_hash` (replay solo con payload idéntico), TTL 24 h, misma transacción |
| V | **`profiles.deactivated_at`**: desactivación soft con revocación inmediata de sesiones, módulos y claves; el historial no se borra |
| W | **Settings con `mcp_access`** (`none`\|`read`\|`write`) y actor humano **o** clave (`updated_by_key` + CHECK) — deltas de task-05/06 |

## 9. Fuera de alcance

- **Catálogo concreto de claves de `settings`** (tipos zod, quién lee/escribe cada una, wizard `/setup`) → task-06.
- **Mecánica del instalador de módulos** (contract del manifest, orden de migraciones, validación de DDL en runtime) → task-03.
- **Inventario de endpoints del Core** (recursos, scopes por acción, `request_id`, rate limiting) → task-02.
- **Contrato de eventos realtime y notificaciones** → task-04.
- **MCP tools** → task-05.
- **Modelo de participantes/grupos de los módulos** → spec de cada módulo (Split Expenses la primera).
- **Checklist OWASP / política de secrets / patrón RLS canónico formalizado** → task-10.

## 10. Criterios de aceptación

- El esquema cubre identidad (`profiles` con `role` de 3 niveles y **sin contraseñas en BD** — decisión P), categorización (`user_categories`, `user_category_members`), acceso (`user_modules` materializado, `user_category_modules`), plugins (`module_registry` con `is_public`, `module_migrations`), config (`settings_categories` + `settings` con prefijo garantizado, `is_secret`/`is_public`, `currencies`+default, `translations`), invitación (`invitations` + `invitation_modules`), tokens (`api_keys` sin `group_id`), `devices`, `audit` y `admin_actions`.
- **No** hay tablas de "grupos de datos de módulo" en el Core (eso vive en cada módulo).
- El **acceso a módulos es por usuario y viaja con él**; la categoría es solo clasificación/plantilla (decisión A2). Los **roles jerárquicos** (M) y el **público/privado** (N) se respetan.
- **RLS por tabla** con definers canónicos (`is_admin()`, `is_super_admin()`, `has_module_access`), **sin auto-escalado ni auto-concesión** (decisiones L) y contrato de aislamiento definido (D2 adaptado a categorías/usuarios).
- **Ciclo de vida de módulos** (instalar/activar/desactivar/desinstalar) con `module_migrations` reversibles (decisión K) y semántica de borrado definida (§3.8).
- Coherente con la spec de API v1 (con delta 2026-10-26), spec de tokens §5/§7, ADR 0004/0007/0008 y testing D2.
- Aprobada por el usuario y revisada por segundo agente (DoD de Docs).

## 11. Referencias

- Spec de diseño: `docs/superpowers/specs/2026-10-24-027apps-design.md` §4/§8
- Spec de API v1 (con delta): `docs/superpowers/specs/2026-10-25-api-v1.md`
- Spec de tokens: `docs/superpowers/specs/2026-10-25-token-model.md` §5/§6/§7
- Spec de auth: `docs/superpowers/specs/2026-10-25-auth.md` §3/§3bis/§5/§5bis
- ADRs: `docs/adr/0004-bordes-y-capa-de-aplicacion.md`, `0007-manejo-de-errores.md`, `0008-fechas-y-moneda.md`, `0006-realtime.md`
- Testing: `docs/conventions/testing-strategy.md` (D2, §3, §8)
- Plan del sprint: `docs/superpowers/plans/2026-10-26-sprint-core-design.md`