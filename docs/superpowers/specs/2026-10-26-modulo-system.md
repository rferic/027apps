# Spec — Core: sistema de módulos e instalador en runtime (sprint 04, task 03)

**Fecha:** 2026-10-26
**Estado:** Borrador para aprobación del usuario
**Base:** [spec de diseño §4](2026-10-24-027apps-design.md) (sistema de módulos, manifest, instalación global + activación por grupo → reframe: por usuario) · [spec de datos del Core](2026-10-26-core-data-model.md) (task-01: `module_registry`, `module_migrations`, `is_public`, `settings.is_public`, decisiones K/N/O) · [spec de API](2026-10-26-core-api.md) (task-02: endpoints `/modules/*/install|activate|deactivate|uninstall`, `/modules/{key}/settings`, `/modules/{key}`) · [flujo new-module](docs/flows/new-module.md) (esqueleto a completar) · [spec de tokens §5](2026-10-25-token-model.md) (scopes por acción) · [ADR 0004](../../adr/0004-bordes-y-capa-de-aplicacion.md) (puertas, casos de uso, scopes) · [ADR 0007](../../adr/0007-manejo-de-errores.md) (envelope, `conflict`) · [ADR 0008](../../adr/0008-fechas-y-moneda.md) (config por instancia)
**Decide el usuario:** contrato del manifest, seguridad del DDL (A+C+D, firma B diferida), limpieza de settings al uninstall, secuencia de implementación (2026-10-26)

## 1. Objetivo

Definir **cómo se empaqueta, instala, activa, desactiva y desinstala un módulo en runtime** (filosofía "plugin" estilo WordPress, decisión F de task-01): un **contrato de manifest estricto** + un **instalador** que lo valida, aplica/revierte su DDL de forma segura y siembra su configuración/strings. Esta spec fija el contrato y la mecánica; el **instalador se implementará en el backlog de implementación del Core** (sprint futuro, tras esta definición); aquí solo especificación.

**Límite de alcance:** no se implementa código. La spec define: (a) el contrato del `manifest.json`, (b) la mecánica del instalador (install/activate/deactivate/uninstall con migraciones y limpieza), (c) la seguridad del DDL (decisiones A+C+D), (d) el CI que valida el manifest. Los **eventos realtime** (`eventos` del manifest) van a task-04; las **tools MCP** a task-05; la **pipeline i18n** a task-09.

## 2. Modelo (sobre la task-01)

El Core ya define (task-01, no se reabre):
- `module_registry` — key, name, version, `state` (`installed|active|disabled`), `is_public`, `manifest_digest`.
- `module_migrations` — `(module_key, version, direction)` con `ddl_digest` (hash del DDL aplicado, anti-tamper).
- `settings_categories` + `settings` — siembra de config por el manifest (`source: module:<key>`), `is_public`/`is_secret`.
- `translations` — strings del módulo sembrados (`source: module:<key>`).
- Ciclo de vida (decisión K): **instalar → activar → desactivar → desinstalar**.
- Público/privado (decisión N): `module_registry.is_public`.

Esta spec **concreta** ese modelo: qué contiene el manifest y cómo el instalador lo lleva al esquema.

## 3. Contrato del `manifest.json`

Cada módulo es un **paquete del monorepo** en `packages/<key>/` (decisión 1 del usuario). El manifest vive en `packages/<key>/manifest.json`:

```jsonc
{
  "key": "split-expenses",              // = module_registry.key; UNIQUE; kebab-case
  "name": "Split Expenses",             // texto en inglés (i18n lo traduce)
  "version": "1.0.0",                   // semver de la versión instalable actual
  "is_public": false,                   // default del manifest; override por super_admin en el panel (task-02 PATCH /modules/{key})
  "migraciones": [                      // DDL del módulo, en orden
    {
      "version": "1.0.0",               // versión de la migración (única en el manifest, ver invariantes)
      "up": "./sql/1.0.0-up.sql",       // ruta al SQL dentro del paquete (o inline string)
      "down": "./sql/1.0.0-down.sql",   // rollback de esa migración (reversible, decisión K)
      "digest": "sha256:…",             // hash esperado del contenido "up" (verificado por el instalador, decisión A)
      "down_digest": "sha256:…"         // hash esperado del contenido "down" (verificado en el uninstall, decisión A)
    }
  ],
  "settings": [                         // siembra settings_categories + settings (forma en task-06)
    {
      "category": "split_expenses",     // = settings_categories.category_key; snake_case(key) del módulo (invariante)
      "label": "Split Expenses",        // texto en inglés
      "icon": "split-expenses",         // icono del DS o del paquete
      "sort_order": 10,
      "settings": [
        { "key": "default_currency", "type": "currency", "default": "EUR", "is_public": true },
        { "key": "reminder_threshold", "type": "int", "default": 3, "is_public": false }
      ]
    }
  ],
  "i18n": ["es", "ca", "en", "it", "fr", "de", "pt", "gl", "eu"],  // locales que siembra (source: module:<key>); el set activo lo filtra el check de CI (task-09)
  "scopes": ["expenses:read", "expenses:write", "balance:read"],   // acciones expuestas (ADR 0004 §2); viven en código, el manifest solo las declara para validación mecánica (CI) y el guard
| `mcp_tools`: [ { "name": "expense_list", "scopes": ["expenses:read"] } ],  // tools MCP (formato definitivo en task-05)
  "channels": [                                                     // canales realtime propios del módulo (task-04)
    { "pattern": "expense-group-{id}", "members_fn": "split_expenses_expense_group_members" }
  ],
  "eventos": [                                                      // eventos de dominio que publica (contrato en task-04)
    { "type": "expense.created", "target": "channel:expense-group-{id}", "notify": ["push"] },
    { "type": "expense.deleted", "target": "channel:expense-group-{id}" },
    { "type": "expense.invited", "target": "user" }
  ],
  "hooks": { "user.deactivated": "handleUserDeactivated" }          // reacciones a eventos del Core (task-02 §3.2: DELETE /users/{id})
}
```

**Invariantes del contrato (validados por el esquema zod del manifest):**
- `key` único, kebab-case; `name`/`label` en inglés (nunca claves i18n); `version` semver.
- Cada migración declara `up` **y** `down` (reversibilidad obligatoria, decisión K) y sus `digest`/`down_digest`. **Cada `migraciones[].version` es única en el manifest** (la PK de `module_migrations` es `(module_key, version, direction)`, task-01 §3.2).
- `settings[].category` = **`snake_case(key)`** del módulo (coherente con el prefijo `{category_key}.{key}` de task-01 §3.3); `settings[].settings[].is_public` se respeta (decisión O).
- `scopes` siguen la convención `recurso:acción` de task-02; **viven en código** (ADR 0004 §2, token-model §5), el manifest solo los declara para validación mecánica (CI) y el guard — no se "siembran" en BD (no existe tabla de scopes, decisión H6).
- Las tools MCP referencian un scope declarado.
- Cada **evento** declara `type`, `target` (`admins`|`all`|`user`|`channel:<pattern>`) y opcionalmente `notify` (task-04 §2.3/§6.3); un `target` de canal exige un `channels[].pattern` declarado.
- Cada **canal** declara `pattern` y `members_fn` (función SQL security definer del módulo que devuelve los `user_id` con acceso; la usan la RLS de realtime y la resolución de push — task-04 §2.2).
- Los `hooks` referencian **eventos del Core** o del propio módulo (task-04 define el catálogo).

**Regla de negocio del manifest:** un manifest NO declara rutas HTTP de `/api/v1` propias del recurso (esos endpoints son de la spec del módulo, mecanismo de extensión de api-v1 §5); el manifest solo declara DDL, settings, tools/eventos/hooks y los scopes para validación mecánica (que viven en código, ADR 0004 §2). El contrato de API lo añade el módulo con sus schemas/casos de uso/recursos, sin tocar la mecánica (api-v1 §5).

## 4. El instalador (mecánica)

Se ejecuta en el Core (implementación futura), invocado por los endpoints `/modules/{key}/install|activate|deactivate` (task-02, `modules:manage`, `is_admin()`) y `/modules/{key}/uninstall` (`is_super_admin()`, decisión B3). Sigue el patrón de puerta delgada → caso de uso orquestador (ADR 0004): la puerta autoriza (scopes + confirmación explícita) y el caso de uso orquestador gestiona: validar manifest → aplicar migraciones → sembrar settings/i18n → registry. Los **scopes no se siembran** (viven en código, decisión H6).

### 4.1 Instalar (`install`)
1. **Leer y validar el manifest** contra el **esquema zod** del contrato (§3) — si falla → `validation_failed` (ADR 0007). El runtime lee el manifest/SQL **embebidos en el build del deploy** (el paquete del módulo se compila en la app; el detalle de entrega se confirma en el sprint de implementación, decisión B4).
2. **Verificar `digest` y `down_digest`** de cada migración (los hashes del contenido `up`/`down` deben coincidir; `ddl_digest` en `module_migrations`) — decisión A. Si no coinciden → `conflict`/`validation_failed`, no se aplica nada.
3. **Aplicar migraciones `up` en orden** dentro de una transacción (si una falla, rollback de todas; ADR 0004 §6: efectos externos tras el commit). Registrar cada una en `module_migrations` (`direction: up`, `ddl_digest`).
4. **Sembrar**: `settings_categories` + `settings` (con `is_public`/`is_secret` del manifest), `translations` (`source: module:<key>`). Los **scopes no se siembran en BD** (viven en código; decisión H6).
5. **Registry**: `module_registry` `state = installed`, `manifest_digest`, `version`.
6. **`admin_actions`** registrado (`module.install`) **dentro de la transacción** (es una fila de BD, no un efecto externo).
7. Estado `installed` = DDL aplicado pero **no visible** aún (requiere `activate`).

### 4.1bis Máquina de estados (transiciones legales, decisión H2)

Cada operación solo es válida desde los estados permitidos; cualquier otra transición devuelve **`conflict` (409)** con mensaje claro (ADR 0007):

| Desde | Transición legal |
|---|---|
| *(no existe)* | → `installed` (install de cero) |
| `installed` | → `active` (activate) · → *(eliminado)* (uninstall) |
| `active` | → `disabled` (deactivate) · → *(eliminado)* (uninstall) |
| `disabled` | → `active` (activate) · → *(eliminado)* (uninstall) |
| `installed`/`active`/`disabled` | re-`install` → `conflict` "ya está instalado" (para re-instalar: uninstall → install) |

**Upgrade de versión (1.0.0 → 1.1.0):** se define como alcance de **implementación** del sprint del instalador (aplicar solo las migraciones pendientes sobre un módulo `active`/`disabled`); esta spec fija el contrato que lo permite (migraciones por versión + `module_migrations`) y deja la operación `update` concreta al código. No bloquea esta definición.

### 4.2 Activar / desactivar (`activate` / `deactivate`) — `is_admin()`
- `activate`: `state = active` (disponible para quien tenga acceso: admins → todos; usuarios → `is_public` o `user_modules`, decisión N). Transición válida desde `installed`/`disabled` (§4.1bis).
- `deactivate`: `state = disabled` — el DDL y los datos **permanecen** (no se tocan); solo deja de estar disponible. No revoca `user_modules` existentes (se mantienen; el módulo simplemente no se sirve mientras está desactivado). Transición válida solo desde `active`.
- Ambas registran `admin_actions` (`module.activate`/`module.deactivate`) **dentro de la transacción**.

### 4.3 Desinstalar (`uninstall`) — `is_super_admin()`
**Requiere confirmación explícita del super_admin** en el panel (decisión D: revisa el diff de lo que se va a revertir/borrar). Transición válida desde `installed`/`active`/`disabled` (§4.1bis). Secuencia (todo orquestado):
1. **Invitaciones pendientes**: las `invitation_modules` que conceden este módulo **pierden el acceso a él** (se eliminan esas filas; la invitación sigue para el resto de módulos) y el uninstall **continúa** (decisión H1 del usuario).
2. **Comprobar bloqueo**: si hay `user_modules`/`user_category_modules` activos o datos referenciados en uso → `conflict` con mensaje claro (task-01 K: no se desinstala un módulo con concesiones/settings en uso sin confirmación). La confirmación explícita del panel desbloquea.
3. **Verificar `down_digest`** de cada migración (decisión A) antes de revertir.
4. **Revertir migraciones `down` en orden inverso** (transaccional; si falla → rollback, el módulo queda como estaba).
5. **Limpiar settings**: borrar `settings_categories` + `settings` con `source: module:<key>` (decisión 3).
6. **Limpiar i18n**: borrar `translations` con `source: module:<key>` (decisión 3).
7. **Limpiar registry**: `DELETE module_registry` (y `module_migrations` de ese módulo).
8. **`admin_actions`** registrado (`module.uninstall`) **dentro de la transacción**.
9. **Efectos externos tras el commit** (ADR 0004 §6): evento `module.uninstalled` publicado (task-04).

> **Semántica de datos** (decisión 3): el `down` de cada migración es **del módulo** — decide si hace drop de sus tablas o archiva (el dinero no se borra, spec §12). El Core no decide por el módulo; solo ejecuta el `down` declarado y limpia los registros del Core (settings/translations/registry).

## 5. Seguridad del DDL (decisiones A + C + D; B diferida)

El manifest trae SQL ejecutable: capas de protección (filosofía "defensa en profundidad", como RLS):

- **A — Contrato estricto + digest (`up`+`down`)**: manifest validado contra esquema zod; cada migración con `digest` (up) y `down_digest` (down) verificados al aplicar y al revertir (`module_migrations.ddl_digest`). Detecta alteración entre instalaciones, también del rollback.
- **C — Permisos mínimos de BD**: el rol/credencial que ejecuta el instalador **solo puede DDL sobre el esquema del módulo** (`module_<key>.*`), nunca `auth.*`, tablas del Core (`profiles`, `module_registry`, `settings`, `translations`, `user_categories`, …) ni tablas de otros módulos. RLS como segunda barrera.
- **D — Confirmación humana explícita**: el super_admin revisa el **diff del DDL** (qué tablas crea/borra) en el panel y confirma antes de `install` y `uninstall` (obligatorio en uninstall; recomendado en install).
- **B (firma criptográfica, Ed25519) — diferida**: no se adopta en v1 (quien instala elige el módulo; A+C+D cubren la amenaza principal). Se evalúa si el registry se abre a módulos de terceros no revisados. Queda anotado como decisión aplazada.
- **Sin secrets en el manifest**: el manifest y sus SQLs son **código público**; cualquier credencial de instancia va en `settings` (`value_encrypted`) en runtime, nunca en el paquete. `guard-secrets` del CI lo vigila.

## 6. CI del módulo (determinismo antes que agentes)

- **Validación mecánica del manifest** contra su esquema zod como **check de CI** en el **job `admin` existente** (se añade ahí; no hay job `modules` en `cicd.md` y no se crea uno aparte): todo PR que añada/modifique un `packages/*/manifest.json` pasa el contrato o falla.
- El `digest`/`down_digest` de cada migración se **recalcula y compara** (evita manifests con digest desincronizado).
- Las claves i18n del manifest se integran con el **check de locales** (task-09): el set del manifest (`i18n`) no puede contener locales fuera del set activo.
- Permite que la **skill `new-module`** (spec §9/§11, `new-module.md` paso 8) automatice el scaffolding con el contrato ya validado.

## 7. Relación con el flujo `new-module.md`

Esta spec **completa los TODOs del esqueleto** (`new-module.md`): el contrato del manifest (paso 2), la validación mecánica (paso 2), la suite RLS con el instalador (paso 3), y el alta en el instalador (paso 8). La **actualización del esqueleto** (que hoy conserva el lenguaje pre-reframe: "activación por grupo", `group_id`, `participants`) queda **enlazada a la tarea de implementación del instalador** en el backlog del Core — el mismo PR que implemente el instalador revisa `new-module.md` contra esta spec y contra el reframe (decisión B7). Los pasos que dependen de código (instalador, suite RLS, tools MCP, eventos) se cierran en el sprint de implementación del Core.

## 8. Decisiones tomadas (conversación de diseño, 2026-10-26)

| # | Decisión |
|---|---|
| A | Manifest en **`packages/<key>/manifest.json`** (cada módulo es un paquete del monorepo, spec §4) |
| B | Seguridad del DDL: **A + C + D** — esquema zod estricto + `digest`/`down_digest` verificados (`up` y `down`), permisos mínimos de BD (rol acotado a `module_<key>.*`), y **confirmación explícita del super_admin** (diff del DDL) antes de install/uninstall. **Firma criptográfica (Ed25519) diferida** |
| C | **Uninstall limpia**: revierte `down` en orden inverso + **borra `settings_categories`/`settings` y `translations`** con `source: module:<key>`; el `down` del módulo decide si hace drop o archiva sus datos (el dinero no se borra, spec §12) |
| D | **Secuencia**: esta spec es **definición**; el instalador se implementa en el backlog de implementación del Core (sprint futuro). El CI ya valida el manifest contra su esquema |
| E | Manifest sin rutas de recurso (esos endpoints son de la spec del módulo, extensión de api-v1 §5); solo DDL/settings/tools/eventos/hooks + scopes para validación (viven en código, H6) |
| F (H1) | **Uninstall con invitaciones pendientes**: las `invitation_modules` que conceden el módulo **pierden ese acceso** (se eliminan) y el uninstall continúa; la invitación vale para el resto de módulos |
| G (H2) | **Máquina de estados** definida (§4.1bis): transiciones legales, `conflict` 409 en otras; **upgrade de versión** = alcance de implementación del instalador |

## 9. Fuera de alcance

- **Implementación del instalador** → sprint de implementación del Core.
- **Catálogo de settings (tipos zod, wizard)** → task-06.
- **Contrato de eventos realtime y su publicación** (`eventos`/`hooks` del manifest) → task-04.
- **Tools MCP concretas** → task-05.
- **Pipeline i18n** (sync, check de locales, skill `i18n-sync`) → task-09.
- **Modelo de datos de los módulos** (p. ej. tablas de gastos) → spec de cada módulo (Split Expenses la primera).

## 10. Criterios de aceptación

- El contrato del manifest (§3) está definido con invariantes y validación zod; los `up`/`down` son obligatorios y reversibles.
- La mecánica del instalador (install/activate/deactivate/uninstall) está especificada sobre `module_registry`/`module_migrations` de la task-01, con transacciones y efectos externos tras el commit (ADR 0004 §6).
- La seguridad del DDL aplica A+C+D (digest, permisos mínimos, confirmación explícita); B queda diferida y anotada.
- El uninstall limpia settings/translations y delega la semántica de datos al `down` del módulo.
- El CI valida el manifest contra su esquema (check mecánico).
- Coherente con task-01 (modelo, decisiones K/N/O), task-02 (endpoints), api-v1 §5 (extensión) y `new-module.md`.
- Aprobada por el usuario y revisada por segundo agente (DoD de Docs).

## 11. Referencias

- Spec de datos del Core: `docs/superpowers/specs/2026-10-26-core-data-model.md` (task-01: registry, migrations, is_public, settings, decisiones K/N/O)
- Spec de API del Core: `docs/superpowers/specs/2026-10-26-core-api.md` (task-02: endpoints de módulos)
- Spec de diseño: `docs/superpowers/specs/2026-10-24-027apps-design.md` §4 (sistema de módulos)
- Spec de API v1: `docs/superpowers/specs/2026-10-25-api-v1.md` §5 (mecanismo de extensión)
- Flujo: `docs/flows/new-module.md` (esqueleto a completar)
- ADRs: `0004-bordes-y-capa-de-aplicacion.md`, `0007-manejo-de-errores.md`, `0008-fechas-y-moneda.md`
- Plan del sprint: `docs/superpowers/plans/2026-10-26-sprint-core-design.md`
- Task: `docs/tasks/sprint-core-design/task-03.md`