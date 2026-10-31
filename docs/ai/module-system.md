# Sistema de módulos — documentación canónica para IA

**Manifest version:** 1.0.0
**Estado:** Aprobado (sprint 08, 2026-10-31)
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
  "migraciones": [
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
  "eventos": [
    {
      "type": "expense.created",
      "target": "channel:expense-group-{id}",
      "notify": ["push"]
    }
  ],
  "hooks": { "user.deactivated": "handleUserDeactivated" },
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
- Cada migración declara `up` y `down`, con `digest` y `down_digest`; cada
  `migraciones[].version` es única en el manifest.
- `settings[].category` = `snake_case(key)` del módulo; se respeta `is_public`.
- `scopes` siguen `recurso:acción`; viven en código; no se siembran en BD.
- Las tools MCP referencian un scope declarado.
- Cada evento declara `type`, `target` (`admins`|`all`|`user`|`channel:<pattern>`) y
  opcionalmente `notify`; un target de canal exige un `channels[].pattern`.
- `branding`: `description` en inglés no vacía; `icon` SVG monocromo con `currentColor` y
  safe-zone 24/48 px; `color` entre los 8 slots del DS (`teal`, `indigo`, `violet`, `amber`,
  `rose`, `emerald`, `sky`, `slate`), nunca hex libre. El icono se sirve en
  `GET /api/v1/modules/{key}/icon.svg`.
- Cada tool MCP declara `name`, `kind` (`read`|`write`), `description` en inglés y `scopes`;
  `mcp_exposed = read` oculta y bloquea las de `write`.
- Cada setting declara `key`, `type`, `default`, `label`/`help` en inglés, `is_public`,
  `is_secret`, `mcp_access`, `sort_order`.
- Cada canal declara `pattern` y `members_fn` (función SQL security definer que devuelve los
  `user_id` con acceso).
- Los `hooks` referencian eventos del Core o del propio módulo.
- `admin_pages`: `route` de un solo segmento (`^[a-z0-9]+(-[a-z0-9]+)*$`, sin `/`, `..`,
  `%2e` ni rutas reservadas), `label` en inglés, `icon` del DS, `group` (`module`) y `role`
  (`admin`|`super_admin`). El componente vive en `packages/<key>/admin/<route>/page.tsx` y el
  CI del Core exigirá que exista; se sirve en `/modules/<key>/<route>` y solo si el módulo está `active`.
- Documentación por capacidad: `docs.readme` obligatorio; `docs.api` obligatorio si declara
  `scopes`; `docs.mcp` si declara `mcp_tools`; `docs.settings` si declara `settings`;
  `docs.events` si declara `eventos`/`channels`. El CI del Core exigirá el fichero y que cada
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

### Requisitos

- `README.md` obligatorio. Documenta el propósito, las capacidades y cómo se usa.
- `docs/api.md` obligatorio si el manifest declara `scopes`.
- `docs/mcp.md` obligatorio si declara `mcp_tools`.
- `docs/settings.md` obligatorio si declara `settings`.
- `docs/events.md` obligatorio si declara `eventos` o `channels`.
- DDL `up`/`down` reversible, con digests verificables.
- Settings completos y con `is_secret` cuando corresponda.
- i18n con claves en inglés como clave; el texto visible se traduce.
- Scopes en código, no en BD.
- Páginas de admin con componente existente y ruta válida.
- Sin secretos en el paquete ni en el manifest.

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
