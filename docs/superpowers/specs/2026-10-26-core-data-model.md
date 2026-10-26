# Spec — Core: modelo de datos y accesos (sprint 04, task 01)

**Fecha:** 2026-10-26
**Estado:** Borrador para aprobación del usuario
**Base:** [spec de diseño §4/§8](2026-10-24-027apps-design.md) (capacidades transversales, borrador de datos) · [spec de tokens §5/§7](2026-10-25-token-model.md) (scopes por acción, evolución del modelo) · [spec de auth](2026-10-25-auth.md) (frontera Supabase, invitación, wizard) · [spec de API v1](2026-10-25-api-v1.md) (**con delta 2026-10-26**: `groups`→`categories`, `/me/modules`) · [ADR 0004](../../adr/0004-bordes-y-capa-de-aplicacion.md) (casos de uso, guard, scopes) · [ADR 0007](../../adr/0007-manejo-de-errores.md) (envelope, `request_id`, `admin_actions`) · [ADR 0008](../../adr/0008-fechas-y-moneda.md) (timezone, config de instancia, moneda) · testing strategy (D2, aislamiento)
**Decide el usuario:** reframe Categoría ≠ Grupo de módulo + decisiones A–G de la conversación de diseño (2026-10-26)

## 1. Objetivo

Definir el **modelo de datos del Core** — la superficie transversal que comparten todos los módulos — y su **modelo de permisos + RLS**, tras el reframe acordado: **en el Core no hay "grupos de datos"; las categorías son etiquetas de usuarios y los grupos reales pertenecen a cada módulo.** Esta spec es la fuente del esquema; la implementación (TDD, migraciones, checks de determinismo) es tarea posterior del backlog del Core.

**Límite de alcance:** aquí se fija el **esquema lógico** (tablas, columnas, invariantes, RLS, contrato de aislamiento). El catálogo concreto de claves de `settings` (task-06), la mecánica del instalador de módulos (task-03), el inventario de endpoints (task-02) y el contrato de eventos (task-04) se especifican en sus propias tareas sobre esta base.

## 2. Reframe rector (decisión del usuario, 2026-10-26)

| | Core | Módulo (p. ej. Split Expenses) |
|---|---|---|
| Qué es "grupo" | **Categoría/etiqueta de usuarios** ("familia", "amigos") | Grupo real de datos (grupo de gastos, sus miembros, saldos) |
| Quién lo define | El `super_admin` de la instancia | El caso de uso del módulo |
| Dónde vive | Tablas del Core (`categories`, `category_members`) | **Tablas propias del módulo** (`expense_groups`, …) |
| Rol | Solo `super_admin` (instancia) + usuario con acceso a módulos | Roles del módulo (admin de grupo de gastos, etc.) |
| RLS | Derivada de identidad + acceso a módulo | La define el módulo sobre sus tablas, apoyándose en el Core |

**Consecuencias directas:**
- `participants` y `group_members` **no existen en el Core**. Cada módulo modela sus propios participantes (con enlace opcional a `profiles.id` para los "ficticios"). Claiming, miembros, etc. son concepto de módulo.
- El **acceso a módulos** es **por usuario** (`user_modules`) y **viaja con él**: si un usuario cambia de categoría, sus concesiones no cambian (decisión A).
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
| `is_super_admin` | bool NOT NULL DEFAULT false | el primer admin se crea en el wizard `/setup` (auth §3bis) |
| `created_at`, `updated_at` | timestamptz | |

**`categories`** — etiqueta de usuarios creada por el `super_admin`.
| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `name` | text NOT NULL | "Familia", "Amigos", … |
| `slug` | text UNIQUE NOT NULL | para URLs/identificación |
| `created_by` | uuid NOT NULL → `profiles.id` | |
| `created_at` | timestamptz | |

**`category_members`** — M2M usuario ↔ categoría (un usuario puede estar en varias categorías).
| Columna | Tipo | Notas |
|---|---|---|
| `category_id` | uuid NOT NULL → `categories.id` | PK compuesta |
| `user_id` | uuid NOT NULL → `profiles.id` | PK compuesta |
| `created_at` | timestamptz | |

> La categoría **nunca** concede permisos por sí misma (no es un rol): es clasificación y plantilla de asignación (3.2).

### 3.2 Acceso a módulos

**`module_registry`** — el registro de módulos instalados en la instancia (contrato de plugin, task-03).
| Columna | Tipo | Notas |
|---|---|---|
| `key` | text PK | p. ej. `split-expenses` |
| `name` | text NOT NULL | |
| `version` | text NOT NULL | versión instalada actual |
| `state` | text NOT NULL CHECK (`installed`\|`disabled`) | instalación global por instancia |
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

**`user_modules`** — la **concesión real**: el usuario tiene acceso a este módulo. **El permiso va con el usuario.**
| Columna | Tipo | Notas |
|---|---|---|
| `user_id` | uuid NOT NULL → `profiles.id` | |
| `module_key` | text NOT NULL → `module_registry.key` | |
| `granted_by` | uuid NOT NULL → `profiles.id` | quién concedió |
| `created_at` | timestamptz | |
| `revoked_at` | timestamptz NULL | revocación individual (soft) |
| — | PK `(user_id, module_key)` | |

**`category_modules`** — **plantilla de asignación masiva** (decisión A: **materializa**).
| Columna | Tipo | Notas |
|---|---|---|
| `category_id` | uuid NOT NULL → `categories.id` | |
| `module_key` | text NOT NULL → `module_registry.key` | |
| `assigned_by` | uuid NOT NULL → `profiles.id` | |
| `created_at` | timestamptz | |
| — | PK `(category_id, module_key)` | |

**Semántica (decisión A):** asignar un módulo a una categoría = **materializar** `user_modules` para los miembros **actuales** de la categoría (transacción: insert `user_modules` por cada `category_members`, si no existe). Los que entren después **no** lo heredan automáticamente — la categoría es un lote inicial, no un vínculo vivo. Revocar en la categoría **no** revoca concesiones ya materializadas (se revoca por usuario cuando toque). La fila `category_modules` queda como trazabilidad del lote.

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
| `is_secret` | bool NOT NULL DEFAULT false | invariante: `value` **o** `value_encrypted`, nunca ambas; `is_secret` lo fuerza |
| `sort_order` | int NOT NULL | orden dentro de la categoría |
| `updated_by` | uuid NULL → `profiles.id` | solo `super_admin` escribe |
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

**`invitations`** — vehículo único de alta (auth §3). **Email + nombre + categoría + módulos** (decisión D).
| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `email` | text NOT NULL | el invitado puede modificarlo al registrarse (auth §3) |
| `name` | text NOT NULL | nombre propuesto (el invitado confirma) |
| `category_id` | uuid NULL → `categories.id` | **solo clasificación**, no concede permisos |
| `token_hash` | text UNIQUE NOT NULL | token de un solo uso, **solo hash** (spec de tokens §6) |
| `expires_at` | timestamptz NOT NULL | |
| `used_at` | timestamptz NULL | single-use (se marca al canjear) |
| `created_by` | uuid NOT NULL → `profiles.id` | solo `super_admin` o admin autorizado por scopes |
| `created_at` | timestamptz | |

**`invitation_modules`** — módulos que el invitado tendrá acceso al aceptar (decisión D: el permiso viene de **aquí**, no del grupo).
| Columna | Tipo | Notas |
|---|---|---|
| `invitation_id` | uuid NOT NULL → `invitations.id` | |
| `module_key` | text NOT NULL → `module_registry.key` | |
| — | PK `(invitation_id, module_key)` | |

> Al canjear: se crea/verifica `profiles` (Supabase Admin API), se inserta `category_members` si hay `category_id`, y se **materializan** los `user_modules` de `invitation_modules`. La revocación de concesiones es posterior y por usuario (3.2).

### 3.5 Tokens de máquina

**`api_keys`** — tokens opacos service/delegado (spec de tokens §3.2/§3.3). **Sin `group_id`** (la clave es de instancia o de usuario, no "de grupo").
| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `key_hash` | text UNIQUE NOT NULL | SHA-256, prefijo `027_svc_`/`027_usr_` (spec §6) |
| `kind` | text NOT NULL CHECK (`service`\|`delegated`) | service = instancia; delegated = actúa como `user_id` |
| `name` | text NOT NULL | etiqueta visible en el panel |
| `scopes` | text[] NOT NULL | scopes por acción (ADR 0004 §2) |
| `user_id` | uuid NULL → `profiles.id` | NOT NULL si `delegated`; NULL si `service` |
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
| `push_token` | text NULL | token de push (FCM/Expo) para notificaciones (task-04) |
| `last_seen_at` | timestamptz | |
| `created_at` | timestamptz | |

> No es un token de sesión: la sesión la gestiona Supabase Auth. Revocar dispositivo en el panel → via Admin API de Supabase + marca `revoked_at`/soft en `devices` si procede (auth §5, decisión de task-02).

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

## 4. Modelo de permisos (sin tabla RBAC)

El permiso efectivo se **deriva por petición** (ADR 0004 §2, spec de tokens §5):

| Llamador | Permiso efectivo |
|---|---|
| Móvil (JWT Supabase) | Los **scopes de las acciones** que sus `user_modules` habilitan: si el usuario no tiene `split-expenses`, `expenses:read` no le aplica. `is_super_admin` → instancia completa |
| Clave delegada (`027_usr_`) | `min(scopes de la clave, permisos del usuario)` |
| Clave service (`027_svc_`) | scopes de la clave (sin identidad de usuario; ver §6: definer de servicio) |
| Admin web | Igual que el móvil + las acciones de `super_admin` para su rol |

**Regla**: los scopes son **por acción expuesta** (cada puerta declara los scopes que exige — ADR 0004 §2). La concesión de módulos (`user_modules`) es el **gate** de qué scopes "existen" para el usuario; el guard los comprueba; RLS es la segunda barrera.

## 5. RLS (por tabla)

Patrón de **security definer functions** canónicas (task-10 lo formaliza):
- `is_super_admin()` → `profiles.is_super_admin` de `auth.uid()`
- `has_module_access(key)` → existe `user_modules(user_id = auth.uid(), module_key = key)` sin `revoked_at`
- `is_service(caller)` → la puerta/definer identifica llamador service (JWT de servicio emitido por nuestra API, no Supabase) — ver §6

| Tabla | Política RLS |
|---|---|
| `profiles` | read/write: la propia fila (`auth.uid() = id`); `is_super_admin` lee todos (para el panel) |
| `categories`, `category_members` | read: `is_super_admin` (gestión) + miembro de la categoría (ver su etiqueta); write: `is_super_admin` |
| `module_registry`, `module_migrations` | read: cualquier autenticado (para `/me/modules`/catálogo); write: **solo el instalador** (via service/API con scope, no RLS directo) |
| `user_modules` | read/write: el propio usuario (sus concesiones) + `is_super_admin`; la concesión/revocación la ejecuta la API, no el cliente |
| `category_modules` | read: `is_super_admin`; write: `is_super_admin` (materialización vía caso de uso) |
| `settings_categories`, `settings`, `currencies` | read: `is_super_admin` (config) / los no sensibles vía API `/instance` filter; write: `is_super_admin` |
| `translations` | read: cualquier autenticado (resolución i18n en runtime); write: `is_super_admin` / pipeline de import (task-09) |
| `invitations`, `invitation_modules` | read: `is_super_admin` (panel) + el registro de canjeo (flujo wizard); write: `is_super_admin` / caso de uso de canjeo |
| `api_keys` | service: solo `is_super_admin`; delegado: el propietario (`user_id = auth.uid()`) + `is_super_admin` |
| `devices` | read/write: el propio usuario; `is_super_admin` para el panel de revocar |
| `audit` | read: `is_super_admin`; write: solo API (service) |
| `admin_actions` | read: `is_super_admin`; write: solo API (service) |

## 6. Claves de instancia (`027_svc_`) y RLS — el agujero decidido

Una clave `service` **no tiene usuario**: las políticas basadas en `auth.uid()` no le aplican. Decisión (punto A de la conversación):

- **El guard es la barrera efectiva** para claves `service`: la puerta resuelve los scopes de la clave (spec §5) y el caso de uso valida los datos (qué grupo/categoría/entidad se toca). RLS **no** sustituye al guard en este caso.
- Las rutas que admiten llamador `service` usan un **definer de servicio** explícito y acotado (el JWT de servicio emitido por nuestra API para `sb_secret_*`/server, o la tabla `api_keys` resuelta por la puerta), **nunca** `service_role` camuflado en RLS por omisión.
- Regla de oro: **cualquier dato que una clave service pueda leer, el guard debe poder explicarlo por scopes**; RLS de servicio solo como refuerzo no como autorización (ADR 0004 §5).

## 7. Contrato de la suite de aislamiento (testing D2, adaptado al reframe)

La suite de aislamiento es **parte del DoD de toda tabla nueva** (testing §8). Para el Core, los casos base:

1. **Dos categorías**: un usuario de la categoría A no ve los datos que la categoría B otorgó a sus miembros (materialización aislada — la concesión es por fila `user_modules`, no por pertenencia viva).
2. **Dos usuarios con distinto acceso**: el usuario con `split-expenses` ve sus recursos; el que no lo tiene recibe `insufficient_scope`/`not_found` (nunca filtra el dato del otro).
3. **Revocación instantánea**: al revocar `user_modules` o expulsar (soft) de una categoría, la siguiente petición deniega — sin TTL de permisos (spec de tokens §5).
4. **Aislamiento por tabla sensible**: `settings` (no sensibles legibles vía API pública `/instance` filtrado; secrets/`value_encrypted` jamás), `api_keys` (delegado no ve claves de otro usuario), `devices` (propietario), `audit`/`admin_actions` (solo super_admin), `translations` (un usuario cualquiera lee traducciones, no escribe).
5. **Claves service con scope mínimo**: una clave con `expenses:read` no lee `settings`, y su `audit` registra el uso con ventana.

Formato (testing §2/§3): suite SQL por tabla + script de dos usuarios/categorías con datos compartidos, verificación RLS y contrato API punta a punta. Job `supabase`/`rls` en CI → se añade en infra (task-07 de infra).

## 8. Decisiones tomadas (conversación de diseño, 2026-10-26)

| # | Decisión |
|---|---|
| A | **Categoría ≠ Grupo de módulo**: el Core no modela grupos de datos; los módulos tienen los suyos. `participants`/`group_members` fuera del Core |
| A2 | **Acceso a módulos por usuario** (`user_modules`), viaja con el usuario; `category_modules` es plantilla que **materializa** a los miembros actuales (los nuevos no heredan) |
| B | **Invitación** = email (modificable) + nombre + categoría (solo clasificación) + módulos a conceder al aceptar; el permiso viene de la invitación, no del grupo |
| C | **Monedas**: listado `currencies` desactivable + `default_currency` en `settings`; los módulos sobreescriben por concepto |
| D | **Permisos sin tabla RBAC**; derivados por petición (rol + `user_modules` + scopes por acción) |
| E | **`audit`** (uso agregado de tokens) + **`admin_actions`** (log de mutaciones sensibles) |
| F | **Módulos = plugins con contrato estricto** (`module_registry` + `module_migrations`); doc pública de "cómo crear tu módulo" (task-03/11) |
| G | **Settings categorizados**: `settings_categories` (key, label en inglés, icono, orden, source) + `settings` (categoría + key con `UNIQUE(category_key, key)` = prefijo garantizado, texto en inglés, `value`/`value_encrypted` con `is_secret`); los módulos registran su categoría por manifest (task-03) |
| H | **Delta API v1 (2026-10-26)**: `groups`→`categories`, `/me/modules`, config de módulo fuera de lo transversal, MCP lee categorías/usuarios |
| I | Claves service: **guard = barrera efectiva**; definer de servicio acotado; nunca `service_role` por omisión |
| J | **Traducciones del Core** (`translations`): el **texto en inglés es la clave** (estilo Laravel/gettext), fallback `locale → en`; el Core gestiona import, faltantes y cobertura; el kernel de resolución va en task-02, la pipeline en task-09, los strings de módulo viajan en el manifest (task-03) |

## 9. Fuera de alcance

- **Catálogo concreto de claves de `settings`** (tipos zod, quién lee/escribe cada una, wizard `/setup`) → task-06.
- **Mecánica del instalador de módulos** (contract del manifest, orden de migraciones, validación de DDL en runtime) → task-03.
- **Inventario de endpoints del Core** (recursos, scopes por acción, `request_id`, rate limiting) → task-02.
- **Contrato de eventos realtime y notificaciones** → task-04.
- **MCP tools** → task-05.
- **Modelo de participantes/grupos de los módulos** → spec de cada módulo (Split Expenses la primera).
- **Checklist OWASP / política de secrets / patrón RLS canónico formalizado** → task-10.

## 10. Criterios de aceptación

- El esquema cubre identidad (`profiles`), categorización (`categories`, `category_members`), acceso (`user_modules` materializado, `category_modules`), plugins (`module_registry`, `module_migrations`), config (`settings_categories` + `settings` con prefijo garantizado, `currencies`+default, `translations`), invitación (`invitations` + `invitation_modules`), tokens (`api_keys` sin `group_id`), `devices`, `audit` y `admin_actions`.
- **No** hay tablas de "grupos de datos de módulo" en el Core (eso vive en cada módulo).
- El **acceso a módulos es por usuario y viaja con él**; la categoría es solo clasificación/plantilla (decisión A).
- **RLS por tabla** con definers canónicos (`is_super_admin`, `has_module_access`) y contrato de aislamiento definido (D2 adaptado a categorías/usuarios).
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