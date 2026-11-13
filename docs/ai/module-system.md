# Sistema de módulos — documentación canónica para IA

**Manifest version:** 1.0.0
**Estado:** Aprobado (sprint 12, 2026-10-31)
**Contrato base:** `docs/superpowers/specs/2026-10-26-modulo-system.md` §3
**Esquema:** `docs/ai/manifest.schema.json`
**Flujo de creación:** `docs/flows/new-module.md`

Este documento es la fuente única de verdad para agentes. Si algo contradice la spec del
sistema de módulos §3, gana la spec y este documento se corrige en el mismo PR.

## 1. Qué es un módulo

Un módulo es un paquete del monorepo en `packages/<key>/` con un `manifest.json` que declara
su DDL, settings, i18n, scopes, tools MCP, canales, eventos, hooks, páginas de admin y
documentación por capacidad. La instalación es global por instancia; la activación es por
usuario/grupo. El módulo no se sirve si no está `active`.

Un módulo **no declara rutas HTTP de `/api/v1` en el manifest**: los endpoints son parte de la
spec del módulo y se implementan en su capa de aplicación. El manifest solo declara DDL,
settings, tools/eventos/hooks y scopes para validación mecánica.

## 2. Contrato del manifest

El manifest vive en `packages/<key>/manifest.json` y se valida contra
`docs/ai/manifest.schema.json`.

Ejemplo completo:

```jsonc
{
  "key": "split-expenses",
  "name": "Split Expenses",
  "branding": {
    "description": "Shared family expenses with balances and settlement",
    "icon": "assets/icon.svg",
    "color": "teal"
  },
  "version": "1.0.0",
  "is_public": false,
  "migrations": [
    {
      "version": "1.0.0",
      "up": "./sql/1.0.0-up.sql",
      "down": "./sql/1.0.0-down.sql",
      "digest": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      "down_digest": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
    }
  ],
  "settings": [
    {
      "category": "split_expenses",
      "label": "Split Expenses",
      "icon": "split-expenses",
      "sort_order": 10,
      "settings": [
        {
          "key": "default_currency",
          "type": "currency",
          "default": "EUR",
          "label": "Default currency",
          "help": "Currency used by default in this module",
          "is_public": true,
          "is_secret": false,
          "mcp_access": "read",
          "sort_order": 10
        }
      ]
    }
  ],
  "i18n": ["es", "ca", "en", "it", "fr", "de", "pt", "gl", "eu"],
  "scopes": ["expenses:read", "expenses:write", "balance:read"],
  "mcp_tools": [
    {
      "name": "expenses_list",
      "kind": "read",
      "description": "List group expenses",
      "scopes": ["expenses:read"]
    }
  ],
  "channels": [
    {
      "pattern": "expense-group-{id}",
      "members_fn": "split_expenses_expense_group_members"
    }
  ],
  "events": [
    {
      "type": "expense.created",
      "target": "channel:expense-group-{id}",
      "notify": ["push"]
    }
  ],
  "hooks": { "user.deactivated": "handle_user_deactivated" },
  "admin_pages": [
    {
      "route": "overview",
      "label": "Expenses overview",
      "icon": "chart",
      "group": "module",
      "role": "admin"
    }
  ],
  "docs": {
    "readme": "README.md",
    "api": "docs/api.md",
    "mcp": "docs/mcp.md",
    "settings": "docs/settings.md",
    "events": "docs/events.md"
  }
}
```

### Invariantes

- `key` único, kebab-case; `name`/`label` en inglés; `version` semver. Palabras reservadas:
  `admin`, `mcp`, `api`, `core` no pueden ser `key`.
- `is_public` e `i18n` son obligatorios; `i18n` usa los locales soportados
  (`en`, `es`, `ca`, `it`, `fr`, `de`, `pt`, `gl`, `eu`) e **incluye `en` siempre**.
- Cada migración declara `up` y `down`, con `digest` y `down_digest`; cada
  `migrations[].version` es única en el manifest.
- `settings[].category` = `snake_case(key)` del módulo; `settings[].icon` es opcional; se
  respeta `is_public`.
- `scopes` siguen `recurso:acción`; viven en el manifest y el instalador los copia a
  `module_registry.scopes` para resolverlos por petición. **Un scope no es global**: dos módulos
  pueden declarar `expenses:read` y no se abren el uno al otro. La ruta de un módulo declara su
  `moduleKey`; el door comprueba que el módulo está `active`, que el llamante tiene acceso
  (`admin`/`super_admin`, módulo público o `user_modules` activo) y que el scope pedido está
  entre los declarados. Sin acceso, un módulo desconocido y un módulo desactivado responden el
  mismo `403 insufficient_scope`; `anon` recibe `401`. Un scope de Core nunca satisface una ruta
  de módulo.
- Las tools MCP referencian un scope declarado.
- Cada evento declara `type`, `target` (`admins`|`all`|`user`|`channel:<pattern>`) y
  opcionalmente `notify`; un target de canal exige un `channels[].pattern`.
- `branding`: `description` en inglés no vacía; `icon` SVG monocromo con `currentColor` y
  safe-zone 24/48 px; `color` entre los 8 slots del DS (`teal`, `indigo`, `violet`, `amber`,
  `rose`, `emerald`, `sky`, `slate`), nunca hex libre. El icono se sirve en
  `GET /api/v1/modules/{key}/icon.svg`.
- Cada tool MCP declara `name`, `kind` (`read`|`write`), `description` en inglés y `scopes`;
  `mcp_exposed = read` oculta y bloquea las de `write`.
- Cada setting declara `key`, `type` (`string`|`int`|`bool`|`currency`|`locale`|`url`|`json`),
  `label` en inglés, `is_public`, `is_secret`, `mcp_access`, `sort_order`; `help` es
  opcional. Un setting con `is_secret: true` **no declara `default`** ni puede ser público:
  su valor llega por el gestor de secretos.
- Cada canal declara `pattern` y `members_fn` (función SQL security definer que devuelve los
  `user_id` con acceso).
- Los `hooks` referencian eventos del Core o del propio módulo; el valor es el nombre de la
  función `snake_case` que los atiende.
- `contract`: entero obligatorio; debe **igualar** `CORE_CONTRACT`. Solo sube con cambios
  incompatibles del contrato (campos obligatorios, semántica); los aditivos no lo mueven. Un
  módulo de otra generación no instala ni actualiza, y el error dice cuál espera el Core.
- `app`: `{ "visible": boolean }`, por defecto `true`. Un módulo con `visible: false` es de
  **fondo**: no aparece en el lanzador de la app ni tiene pantallas móviles, pero conserva panel,
  ajustes, eventos y workers. `is_public` sigue siendo visibilidad de acceso, no de UI.
- `requires`: lista de `{ key, version }`; la versión es un **mínimo** (`1.2.0`, no rangos).
  Instalar exige que la dependencia esté **instalada** (y con versión suficiente); activar, que
  esté **activa**. Desactivar o desinstalar se niega mientras otro módulo instalado la requiera.
  Un módulo no puede requerirse a sí mismo y no se permiten duplicados; los ciclos se rechazan al
  instalar. Las reglas se resuelven contra `module_registry` (`app_visible`, `requires`), no
  leyendo paquetes en cada transición.
- `app_actions`: `[{ key, label, icon, screen }]`; solo en módulos con `app.visible: true`. `screen`
  es un identificador del registro de pantallas de la app (nunca una URL ni HTML) y `label` es la
  clave de traducción que la app resuelve en sus 9 idiomas. El catálogo del llamante
  (`GET /api/v1/me/modules`, tarea 01 del sprint 15) las devolverá solo para módulos `active` a
  los que tiene acceso; el FAB de la app se compone de ellas y no hay lista hardcodeada. Hoy el
  registry las guarda y la ficha del panel las muestra en solo lectura.
- `demo`: `{ seed_fn, clear_fn }` (objeto: ambas o ninguna). `seed_fn(ids jsonb) returns jsonb`
  recibe los ids del dataset del Core (`{ users: [{ email, id }], category_id, invitation_id }`) y
  devuelve recuentos; `clear_fn() returns jsonb` borra solo lo que sembró. El Core las ejecuta en
  una transacción al sembrar y al borrar demo, y llama a `clear_fn` **antes** de borrar el esquema
  al desinstalar. Solo corren con `demo.enabled` y nunca en producción (`ALLOW_DEMO_DATA=true` es
  el opt-in explícito de staging); nunca reciben datos reales ni envían correo.
- `jobs`: `[{ key, schedule, fn, timeout_seconds? }]`. `schedule` es un cron de **5 campos**
  (`minuto hora día mes día_semana`), validado al instalar; `fn` es una función del esquema del
  módulo que se ejecuta **sin usuario** (el Core la llama como servicio, con timeout, y nunca le
  pasa datos de una sesión). Día del mes y día de la semana deben coincidir **ambos** cuando los
  dos están restringidos (simplificación deliberada del OR de cron). Los trabajos de un módulo
  inactivo no se ejecutan y se borran al desinstalar. El registro copia `jobs` para que el
  despachador no lea paquetes en cada minuto.
  El despachador evalúa el cron en **UTC**, ejecuta cada trabajo en una transacción con
  `statement_timeout` y `search_path` del esquema del módulo (las tablas se resuelven sin
  cualificar, igual que en las migraciones), y reclama la fila de `module_job_runs` antes de
  ejecutar: dos llamadas en el mismo minuto no duplican. Un fallo se registra y no aborta el lote.
- `dashboard_widgets`: cada widget declara `key` (`modulo.dato`, con guion permitido en el
  prefijo), `type` (`summary`|`metric`|`list`), `surface` (`app`|`panel`), `title`, `icon`,
  `order` y `data_fn`, una función del esquema del módulo `(user_id uuid) returns jsonb` que
  **filtra por ese usuario**. El Core la llama al componer `GET /api/v1/me/dashboard`; si la
  función falla, el widget se omite y el dashboard sigue. Sin HTML ni JS del módulo.
  La función devuelve `{ "value": string | number, "label"?: string, "detail"?: string }`; el
  panel pinta `value` con `label` y `detail` como texto secundario, y nunca interpreta claves
  que no conozca. Cualquier otro campo se ignora.
- `admin_pages`: `route` de un solo segmento (`^[a-z0-9]+(-[a-z0-9]+)*$`, sin `/`, `..`,
  `%2e` ni rutas reservadas), `label` en inglés, `icon` del DS, `group` (`module`) y `role`
  (`admin`|`super_admin`). El componente vive en `packages/<key>/admin/<route>/page.tsx` y el
  CI del Core exigirá que exista; se sirve en `/modules/<key>/<route>` y solo si el módulo está `active`.
- Documentación por capacidad: `docs.readme` obligatorio; `docs.api` obligatorio si declara
  `scopes`; `docs.mcp` si declara `mcp_tools`; `docs.settings` si declara `settings`;
  `docs.events` si declara `events`/`channels`. El CI del Core exigirá el fichero y que cada
  nombre declarado aparezca en su documento. Un módulo sin `README.md` no instala.

El esquema JSON valida la forma; las referencias cruzadas (scopes de las tools, targets de
eventos contra `channels[].pattern`, `settings[].category` = `snake_case(key)` y la
documentación por capacidad) las validará el registry/CI del Core. Mientras no exista, el
agente debe comprobarlas manualmente.

## 3. Propiedades y requisitos

### Estructura del paquete

```text
packages/<key>/
  manifest.json
  README.md
  sql/
    1.0.0-up.sql
    1.0.0-down.sql
  docs/
    api.md
    mcp.md
    settings.md
    events.md
  admin/
    <route>/page.tsx
  locales/
    es.json
    ca.json
    en.json
  src/
    schemas/
    usecases/
    resources/
```

### Dónde se leen en producción

El runtime lee el paquete con `readFile`: en local, `MODULES_ROOT` o el `packages/` del monorepo
junto a `apps/admin`; en Vercel, el `packages/` que `outputFileTracingIncludes` copia junto al
root de la función (`apps/admin/next.config.ts`). Un manifiesto, SQL, docs, locales, iconos o
páginas de admin nuevos entran en `MODULE_PACKAGE_FILES`; si falta uno, el módulo instala en
local y falla en el preview. Nunca se copian `.env` ni secretos.

### Requisitos

- `README.md` obligatorio. Documenta el propósito, las capacidades y cómo se usa.
- `docs/api.md` obligatorio si el manifest declara `scopes`.
- `docs/mcp.md` obligatorio si declara `mcp_tools`.
- `docs/settings.md` obligatorio si declara `settings`.
- `docs/events.md` obligatorio si declara `events` o `channels`.
- DDL `up`/`down` reversible, con digests verificables.
- Settings completos y con `is_secret` cuando corresponda.
- i18n con claves en inglés como clave; el texto visible se traduce.
- Scopes en el manifest; el instalador los copia a `module_registry.scopes` para resolverlos
  por petición (ver §3bis).
- Páginas de admin con componente existente y ruta válida.
- Sin secretos en el paquete ni en el manifest.
- Un paquete de pruebas puede marcarse `027apps.devOnly: true` en su `package.json` (no en el
  manifest: el esquema es estricto). El catálogo del panel no lo ofrece con
  `NODE_ENV=production`; en local y staging sí, para poder ejercitar el runtime.

### 3bis. Esquema, privilegios y RLS

- El DDL corre como `module_installer`: crea el esquema `module_<key>` y sus objetos, y **no puede**
  tocar `public`, `auth` ni crear `security definer`. El guard de SQL (`assertSafeModuleSql`) solo
  permite dos referencias auditadas a `public`: `public.core_current_user_id()` en políticas y
  `references public.profiles(...)` como destino de FK (nunca como lectura).
- **Privilegios**: tras las migraciones el instalador concede `usage` del esquema y DML sobre
  tablas/secuencias a `authenticated` (siempre pasa por RLS) y todo a `service_role`; las
  migraciones futuras heredan con `alter default privileges`. Desinstalar borra el esquema y con
  él los privilegios.
- **Identidad**: `public.core_current_user_id()` (`security invoker`, `search_path` vacío) lee el
  `sub` de los claims. Es la única función que un módulo puede usar para saber quién llama.
- **FK a `profiles`**: obligatorio `on delete set null`, porque `purgeUser` borra `auth.users` y no
  limpia los esquemas de módulo. El instalador lo comprueba en el catálogo y falla con
  `fk_profiles_missing_set_null`; la fila del módulo sobrevive sin `user_id` (D16).
- **Scopes por ruta**: la ruta declara `moduleKey`; el door comprueba módulo `active`, acceso
  (admin, público o grant activo) y que el scope esté declarado. Sin acceso → `403` uniforme.

## 4. Ciclo de vida

1. **Instalar:** validar manifest contra el esquema; verificar digests; aplicar migraciones `up`
   en orden dentro de una transacción; sembrar settings, i18n y traducciones; registrar en
   `module_registry` y `module_migrations`.
2. **Activar:** habilitar el módulo para el usuario/grupo; el módulo pasa a `active`.
3. **Desactivar:** ocultar el módulo sin borrar datos; pasa a `disabled`.
4. **Desinstalar:** ejecutar migraciones `down` en orden inverso; limpiar settings y datos
   según el contrato; borrar el registro. Los scopes no se siembran ni se borran de BD.

Si una migración falla, se revierte la transacción y no se aplica nada. Los efectos externos
se ejecutan después del commit.

### Landing pública

Implementar el módulo no termina en el panel. La web pública (`/` para la app, `/self-host`
para el proyecto) es la carta de presentación y debe decir la verdad sobre lo que la familia
puede usar hoy.

- Al cambiar el estado de un módulo, actualiza el catálogo de `docs/ai/landing.md` y las dos
  páginas: nombre, descripción, tres características y estado.
- Al pasar a `available`, sustituye la maqueta por una **captura real con datos de demo**;
  nunca datos de la familia.
- Traduce las claves nuevas en los 9 idiomas (`pnpm i18n:scan`, `pnpm i18n:check`).
- Un módulo `planned` o `in-development` se queda marcado como tal. Nunca se presenta como
  disponible.
- La actualización de la landing va en el mismo PR que implementa el módulo. Sin ella, la
  tarea no está `finalizada`.

## 5. Seguridad

Todo módulo debe documentar y cumplir:

- **Modelo de amenazas:** activos, actores, límites de confianza y casos de abuso.
- **Autenticación y autorización:** roles de familia, `admin`/`super_admin`, scopes y matriz
  de permisos.
- **RLS:** aislamiento entre familias/grupos; tests que intentan accesos cruzados.
- **Validación:** zod en los bordes de API; prevención de inyección; codificación de salida.
- **Secretos:** nunca en código; gestor de secretos; cifrado; rotación.
- **Datos personales/familiares:** cifrado en tránsito y reposo; retención; exportación;
  borrado; backups.
- **API:** JWT corto + refresh; scopes; rate limits; idempotencia; envelope de errores sin
  fugas; CORS/CSRF cuando aplique.
- **MCP:** autorización por herramienta, scopes, auditoría, límites, sin secretos en
  respuestas, efectos secundarios declarados.
- **Auditoría:** quién hizo qué y cuándo; logs inmutables; retención.
- **Dependencias:** versiones fijadas; sin vulnerabilidades conocidas.
- **Puerta de auditoría de seguridad** antes de implementar, por un agente distinto del autor.
  Hallazgos críticos/altos bloquean.

## 6. Testing

- **Dominio:** tests unitarios con TDD (rojo → verde → refactor).
- **API:** tests de contrato con zod, códigos de estado y envelope de errores.
- **RLS:** suite de aislamiento entre familias/grupos.
- **Integración:** límites con el Core, casos de uso y puertas delgadas.
- **MCP:** autorización, entrada/salida y efectos secundarios.
- **Migraciones:** `up` y `down`, idempotencia y rollback.
- **E2E:** flujos críticos de móvil y panel cuando exista UI.
- **Seguridad:** bypass de autorización, inyección, rate limits y fuga de datos.
- **Criterios de aceptación** y cobertura esperada.

## 7. API y MCP

- **API-first:** todo cliente habla con `/api/v1`; nunca con la BD.
- **Contrato de API:** endpoints, métodos, esquemas de entrada/salida, envelope de errores,
  paginación, filtros, idempotencia, versionado, scopes y rate limits.
- **MCP:** el spec define si el módulo expone tools/resources; nombre, descripción, esquema de
  entrada/salida, scopes, efectos secundarios, idempotencia y límites. El manifest declara las
  tools; la documentación por capacidad las describe. MCP es opt-in y respeta permisos.
- **Seguridad MCP:** autorización por herramienta, auditoría, sin secretos en respuestas,
  límites de uso.

## 8. Regla de actualización

Cualquier cambio en el contrato del manifest, el ciclo de vida o el flujo de creación debe
actualizar, en el mismo PR:

- `docs/ai/module-system.md`
- `docs/ai/manifest.schema.json` (si cambia el esquema)
- la sección de módulos de `AGENTS.md` y el puntero de `CLAUDE.md`
- los envoltorios de proveedor
- los ejemplos si cambia la forma

Un cambio solo de código que deje esta documentación desactualizada está incompleto.

> **Deuda registrada:** las claves de nivel superior de `docs/ai/manifest.schema.json` se
> comparan automáticamente con `manifestSchema` en
> `packages/core/src/modules/manifest.test.ts` (`pnpm --filter core test`).

## 9. Dependencias del Core y stop conditions

El Core debe aportar: script de registry, suite RLS, componentes del DS, pipeline i18n e
instalador en runtime. Si falta una pieza al ejecutar un módulo real, el agente **para y
reporta**; no inventa stubs ni contratos provisionales. La documentación y la skill pueden
trabajar sin esas piezas; la implementación del módulo no.

## 10. Referencias

- `docs/superpowers/specs/2026-10-26-modulo-system.md` §3–§4 y §10
- `docs/superpowers/specs/2026-10-24-027apps-design.md` §4 y §9/§11
- `docs/ai/manifest.schema.json`
- `docs/flows/new-module.md`
- `docs/conventions/security-checklist.md`
- `docs/conventions/testing-strategy.md`
- ADRs 0004, 0007, 0008
