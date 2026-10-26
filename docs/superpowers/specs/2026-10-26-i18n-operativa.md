# Spec — Core: i18n operativa (sprint 04, task 09)

**Fecha:** 2026-10-26
**Estado:** Borrador para aprobación del usuario
**Base:** [ADR 0008 §Configuración general](../../adr/0008-fechas-y-moneda.md) (9 locales, `en` obligatorio, check de CI sobre set commiteado) · [spec de datos](2026-10-26-core-data-model.md) (`translations`, decisión J) · [spec de config](2026-10-26-instance-config.md) (`localization.enabled_locales`) · [spec de módulos](2026-10-26-modulo-system.md) (locales del módulo, limpieza en uninstall) · [spec de API](2026-10-26-core-api.md) (`/translations`) · [ADR 0007](../../adr/0007-manejo-de-errores.md) (el servidor no localiza) · [estrategia de testing §6](../../conventions/testing-strategy.md)
**Decide el usuario:** fuente de verdad en el repo, `scan`/`check` en CI, traductor solo por PR, entregables (2026-10-26)

## 1. Objetivo

Que añadir o cambiar un texto **nunca** dependa de la memoria de nadie: el **texto en inglés es la clave**, los catálogos viven **en el repo**, el **CI falla** si falta una traducción o si el catálogo está desactualizado, y la instancia **sirve solo los idiomas habilitados** con fallback a inglés.

## 2. Modelo: el texto en inglés es la clave

- Estilo gettext/Laravel: `t("Prices")` → `"Precios"` si existe, `"Prices"` si no. **Nunca** se muestra una clave críptica.
- **Sin claves artificiales** (`settings.category.notifications.name`): el inglés **es** la clave y debe ser **legible y autocontenido**.
- **Regla de desambiguación (v1)**: si una palabra tiene dos significados, **se escribe distinta** ("Sort order" / "Place order"). No hay contextos de desambiguación: la identidad es `sha256(text_en)` (task-01), así que dos usos del mismo inglés comparten traducción. Si algún día hace falta, se extiende el hash con un contexto (fuera de v1).
- **Interpolación**: `{nombre}` con llaves. El **check** verifica que la traducción conserva **exactamente** los mismos placeholders que el inglés (ni más, ni menos, ni renombrados).
- **Sin plurales en v1**: se escriben cadenas distintas ("1 member" / "Members"). Se reevalúa si aparece un caso real.
- **Idioma base** `en`: siempre activo, no se traduce (es la propia clave).

## 3. Fuente de verdad: el repo

```
packages/i18n/
  catalog.en.json        # TODAS las cadenas en inglés del Core (la lista de claves)
  locales/es.json        # { "Prices": "Precios", … }
  locales/ca.json
  locales/it.json  …  locales/eu.json        # los 9 del set
```

- **La BD no es la fuente**: se **siembra** desde aquí (`source: code`) al instalar/migrar.
- **Módulo**: su paquete trae `locales/*.json` y su propio catálogo inglés; se siembra con `source: module:<key>` al instalar y se **borra** al desinstalar (task-03).
- **Prioridad de origen** si coinciden: `manual` > `import` > `module:<key>` > `code` (una traducción hecha a mano en el panel no se pisa al reinstalar un módulo).
- **Cadenas retiradas**: al sembrar, las filas `source: code` que ya no están en el catálogo se **borran** (con su traducción); las `manual`/`import` se conservan.

## 4. Scripts y CI (determinismo antes que agentes)

| Script | Qué hace | Falla cuando |
|---|---|---|
| `pnpm i18n:scan` | Recorre el código y actualiza `catalog.en.json` con las cadenas nuevas; detecta cadenas usadas que ya no existen | — (escribe; se commitea el resultado) |
| `pnpm i18n:check` | Compara **catálogo ↔ cada locale** del set completo (9): claves que faltan, claves sobrantes, placeholders distintos, ficheros inválidos | **Cualquier** diferencia; catálogo desactualizado respecto al código |

- `i18n:check` corre en el **job `admin`** del CI (junto a lint/tsc/test).
- **El check valida el set completo** (9 locales), no los habilitados: una instancia concreta sirve menos, pero el código debe poder servirlos todos (ADR 0008 nivel 1).
- **Locales del módulo**: el mismo check se aplica a `packages/<key>/locales/` (job `admin` o el que valide el manifest, task-03 §6).

## 5. Siembra y runtime

- **Siembra** (migración del Core / instalación de módulo): `upsert` por `(locale, text_hash)` con `text_en` y `translated_text`; idempotente.
- **Resolución en runtime** (kernel, task-02 §3.9): `resolve(text_en, locale) = traducción(locale) ?? traducción(en) ?? text_en`. El servidor **no localiza** (ADR 0007): devuelve los pares ya resueltos con fallback.
- **Entrega al cliente**: `GET /api/v1/translations?locale=xx` devuelve el mapa `text_en → texto`, **solo** de los locales **habilitados** en la instancia (`localization.enabled_locales`).
- **Caché**: respuesta con **`ETag`** (hash del catálogo sembrado para ese locale + versión) y `Cache-Control` con validación; el móvil revalida y no descarga el mapa en cada arranque.
- **Cambio de idiomas activos**: invalida la caché (versión del catálogo).

## 6. Traducción y cobertura

- **Agente Traductor**: **solo abre PRs** que rellenan `locales/*.json` (nunca escribe en BD). Reglas: conservar placeholders, no traducir nombres de marca, no cambiar el inglés, mantener el orden/format del fichero.
- **Admin** (panel): puede **importar** (`POST /translations/import`, por `text_hash`) o **editar** una traducción (`PUT /translations/{locale}/{text_hash}`), con `source: import|manual`.
- **Cobertura**: `GET /translations/status` devuelve por locale el **% traducido** y la **lista de faltantes**; el panel lo muestra por locale.
- **Límite**: si un locale habilitado tiene < 100 %, la app **funciona** (fallback a inglés); no hay bloqueo de arranque.

## 7. Relación con el resto del sistema

- **`settings.label`/`help`** y las etiquetas del catálogo (task-06) son **texto inglés** y se traducen por esta misma capa.
- **Errores** (ADR 0007): el cliente mapea `error.<code>`; los textos de error viven también en el catálogo.
- **Módulos** (task-03): declaran sus locales; el check cubre sus ficheros; el uninstall limpia sus filas.
- **`i18n:scan` no traduce**: solo mantiene el catálogo.

## 8. Decisiones tomadas (2026-10-26)

| # | Decisión |
|---|---|
| A | **Fuente de verdad en el repo** (`packages/i18n/catalog.en.json` + `locales/<locale>.json`); la BD es **espejo sembrado** (`source: code` / `module:<key>`) |
| B | **Texto inglés como clave**; sin claves artificiales; desambiguación escribiendo distinto; placeholders `{nombre}` validados |
| C | **`i18n:scan` + `i18n:check` en CI** (job `admin`): falla si el catálogo está stale o si un locale del set difiere (claves o placeholders) |
| D | **Traductor solo por PR**; el admin puede importar/editar en caliente (`import`/`manual`, con prioridad sobre `code`/módulo) |
| E | **Siembra idempotente** con `upsert` por `(locale, text_hash)`; las cadenas retiradas `source: code` se borran, las manuales se conservan |
| F | **Runtime**: `GET /translations?locale` solo con locales habilitados, con **ETag** y fallback `locale → en → text_en`; el servidor no localiza |
| G | **Entregables**: esta spec + `docs/flows/i18n.md`; la **skill `i18n-sync`** se materializa en el sprint de implementación (para no describir herramientas que aún no existen) |

## 9. Fuera de alcance

- **Plurales / ICU / RTL** (v1 sin ellos; se reevalúa con caso real).
- **Contextos de desambiguación** (se evita escribiendo distinto).
- **Traducción automática en runtime** (el LLM no traduce en producción).
- **UI del panel de traducciones** (sprint-web; aquí el contrato).
- **Skill `i18n-sync`** y los scripts: se implementan en el sprint del Core; esta spec fija el contrato.

## 10. Testing

- `i18n:check` falla con: clave faltante, clave sobrante, placeholder distinto, JSON inválido, catálogo stale.
- `i18n:check` **pasa** con el set completo en verde (caso base del repo).
- Siembra idempotente: dos ejecuciones no duplican filas; una cadena retirada del catálogo desaparece de la BD (`source: code`) pero una `manual` sobrevive.
- Prioridad de origen: reinstalar un módulo **no** pisa una traducción `manual`.
- `GET /translations?locale=es` devuelve solo claves del locale habilitado; un locale deshabilitado → `validation_failed` (`locale_not_available`).
- ETag: misma versión → `304` en revalidación.
- Placeholders: una traducción con `{nombre}` mal escrito **falla** el check (no llega a producción).

## 11. Criterios de aceptación

- Existe `packages/i18n/` con catálogo y los 9 locales; el check está en el CI y falla en los casos de §10.
- El inglés es la clave en todo el producto; no hay claves crípticas ni strings visibles fuera del catálogo.
- La BD se siembra desde el repo de forma idempotente y respeta la prioridad de origen.
- El runtime sirve solo los locales habilitados, con fallback y ETag; el servidor no localiza.
- Cobertura y faltantes visibles en `/translations/status`; el traductor trabaja solo por PR.
- `docs/flows/i18n.md` publicado y enlazado desde los flujos que hoy tienen `TODO` (feature, new-module, agents).
- Revisado por segundo agente y **auditoría OWASP** si toca datos personales o secretos (no debería; se confirma).

## 12. Referencias

- ADR 0008: `docs/adr/0008-fechas-y-moneda.md`
- Spec de datos: `docs/superpowers/specs/2026-10-26-core-data-model.md` §3.3 (`translations`)
- Spec de config: `docs/superpowers/specs/2026-10-26-instance-config.md` §4
- Spec de módulos: `docs/superpowers/specs/2026-10-26-modulo-system.md` §3
- API del Core: `docs/superpowers/specs/2026-10-26-core-api.md` §3.9
- Testing: `docs/conventions/testing-strategy.md` §6
- Flujo entregable: `docs/flows/i18n.md`
- Plan: `docs/superpowers/plans/2026-10-26-sprint-core-design.md`
- Task: `docs/tasks/sprint-core-design/task-09.md`