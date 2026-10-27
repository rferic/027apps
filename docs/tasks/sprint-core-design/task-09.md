---
id: sprint-core-design-task-09
titulo: i18n operativa — pipeline de claves, check de CI, flujo de traducción (definición)
area: core
estado: finalizada
plan: docs/superpowers/plans/2026-10-26-sprint-core-design.md
---

Tarea 9 del sprint 04 (Diseño del Core). Sprint de **definición**: entrega una spec aprobada, sin código.

**Entregable**: spec `docs/superpowers/specs/2026-10-26-i18n-operativa.md` + el destino operativo que fije (habitualmente script + flujo + skill).

**Alcance** (la «pipeline i18n operativa» de spec §11 y la infra i18n de ADR 0008/estrategia de testing):
- **Modelo**: sobre la tabla **`translations`** de la task-01 (texto en inglés como clave, `text_hash`, fallback `locale → en`).
- **Set de locales**: el set **commiteado en el repo** de 9 idiomas activables (`en, es, ca, it, fr, de, pt, gl, eu`), `en` inamovible (ADR 0008); los no activos en una instancia no se sirven.
- **Pipeline de claves**: la fuente seed (`source: code`) alimenta `translations`; **script de sync** entre locales, y **check de CI determinista que falla** si los locales no tienen exactamente las mismas claves (ADR 0008 nivel 1, testing §6) — sin depender de `settings` en runtime.
- **Flujo de traducción con agente**: el flujo i18n (spec §11, `docs/flows/agents.md` TODO) — generación de claves, traducción con el agente Traductor, revisión; la **skill `i18n-sync`** de proyecto (spec §9/§11).
- **Gestión de traducciones** (decisión J de la task-01): importación (por `text_hash`), detección de faltantes y % traducido por locale, disponibles para el panel (sprint-web).
- **i18n de errores**: el `code` lleva un **mensaje por defecto en inglés** que **es la cadena** del catálogo (`t("Validation failed")`); **nunca** claves `error.<code>` (delta anotada en ADR 0007 §6). Test: el mensaje por defecto de cada `code` existe en el catálogo y en los 8 locales.

**Decisiones a fijar**: rutas y formato de los ficheros de claves, contenido/uso del script de sync, job de CI concreto (dónde corre, qué falla), flujo del Traductor (quién genera, quién revisa). **La skill `i18n-sync` queda diferida** al sprint de implementación (no la define esta spec).

**Estado (2026-10-26):** spec `docs/superpowers/specs/2026-10-26-i18n-operativa.md` + flujo `docs/flows/i18n.md`.
- **Fuente de verdad en el repo**: `packages/i18n/catalog.en.json` + `locales/<locale>.json` (**8 ficheros: todos menos `en`**, que es la propia cadena); la BD (`translations`) es **espejo sembrado** (`source: code`/`module:<key>`), no la fuente. Se siembran **siempre los 9**.
- **Texto inglés como clave** (sin claves crípticas); desambiguación escribiendo distinto; placeholders `{nombre}` validados; sin plurales en v1.
- **`i18n:scan`** (actualiza el catálogo **del Core**; los `label/help/name` de un manifest van al catálogo **del módulo**, nunca al del Core) + **`i18n:check`** en el job `admin`: falla si falta/sobra una clave, si cambian los placeholders, si el JSON es inválido o si el catálogo está stale. Valida el **set completo** de 9.
- **Siembra idempotente** por `(locale, text_hash)` con prioridad **`manual > import > code > module:<key>`**: el Core manda en sus cadenas y un módulo que colisione **no se siembra** (aviso); cadenas retiradas `source: code` se borran.
- **Runtime**: `GET /translations?locale` solo con locales habilitados, `ETag`, fallback `locale → en → text_en`; el servidor no localiza.
- **Traductor**: solo PRs (nunca BD); el admin importa/edita en caliente; cobertura y faltantes en `/translations/status`.
- **Flujo** `docs/flows/i18n.md` enlazado desde `feature.md`, `new-module.md` y `agents.md` (elimina el `TODO` de i18n en los tres).

**Criterios de aceptación**: catálogo + **8 locales** (set disponible de 9) en el repo con `i18n:check` en CI cubriendo los casos de fallo; inglés como clave en todo el producto; siembra idempotente con prioridad de origen; runtime con ETag y fallback; cobertura visible; flujo publicado y enlazado; revisado por segundo agente.

**Referencias**: `docs/superpowers/specs/2026-10-26-i18n-operativa.md`, `docs/flows/i18n.md`, ADR 0008, testing-strategy §6, task-01 (`translations`), task-03 (locales de módulo).
