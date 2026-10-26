# Spec — Core: i18n operativa (sprint 04, task 09)

**Fecha:** 2026-10-26 · **Revisión:** 2 (revisión de docs + auditoría OWASP)
**Estado:** Borrador para aprobación del usuario
**Base:** [ADR 0008](../../adr/0008-fechas-y-moneda.md) (9 locales, `en` obligatorio, check de CI) · [spec de datos](2026-10-26-core-data-model.md) (`translations`, decisión J) · [config](2026-10-26-instance-config.md) (`localization.enabled_locales`) · [módulos](2026-10-26-modulo-system.md) · [API del Core](2026-10-26-core-api.md) §3.9 · [ADR 0007](../../adr/0007-manejo-de-errores.md) · [testing §6](../../conventions/testing-strategy.md)
**Decide el usuario:** fuente de verdad en el repo, `scan`/`check` en CI, traductor solo por PR, entregables (2026-10-26)

## 1. Objetivo

Que añadir o cambiar un texto **nunca** dependa de la memoria de nadie: el **texto en inglés es la clave**, los catálogos viven **en el repo**, el **CI falla** si falta una traducción o si los placeholders no cuadran, y la instancia sirve solo los idiomas habilitados con fallback a inglés.

## 2. Glosario (para no mezclar términos)

| Término | Significado |
|---|---|
| **Disponible** | Los 9 locales que el código es capaz de servir: `en, es, ca, it, fr, de, pt, gl, eu` |
| **Habilitado** | Los que una **instancia** sirve: `localization.enabled_locales` (task-06). `en` no se puede deshabilitar |
| **Validado en CI** | El **set completo de 9** (siempre); el CI comprueba que el código puede servirlos todos, aunque la instancia sirva menos |

> **Delta registrada**: ADR 0008 §29 dice que los no activos «ni se exigen en el check de i18n» y task-03 §6 habla del «set activo». La interpretación vigente es la de ADR 0008 §56 y testing §6: **el CI valida los 9** (disponibles); la instancia sirve los habilitados. Se anota aquí para no dejar dos fuentes en conflicto.

## 3. Modelo: el texto en inglés es la clave

- Estilo gettext/Laravel: `t("Prices")` → `"Precios"` si existe; si no, `"Prices"`. **Nunca** una clave críptica ni un hueco.
- **Sin claves artificiales.** El inglés es la clave y debe ser legible y autocontenido.
- **Desambiguación (v1)**: si una palabra tiene dos significados, **se escribe distinta** ("Sort order" / "Place order"). La identidad es `sha256(text_en)`; dos usos del mismo inglés comparten traducción. `translations.context` **no se siembra en v1** (NULL); si algún día hace falta desambiguar, se extiende la identidad con contexto.
- **Interpolación**: `{nombre}`. La traducción debe conservar **exactamente** los mismos placeholders (ni más, ni menos, ni renombrados).
- **Sin plurales en v1** (cadenas distintas: "1 member" / "Members").
- **`en` no tiene fichero de traducción**: el inglés es la propia cadena. La resolución es `locale → text_en` (sin paso `translations(en)`).
- **Errores (ADR 0007)**: el código (`validation_failed`) lleva un **mensaje por defecto en inglés** (constante de código); ese mensaje **es la cadena** que se traduce (`t("Validation failed")`). **Nunca** hay claves tipo `error.validation_failed` en el catálogo.

## 4. Fuente de verdad: el repo

```
packages/i18n/
  catalog.en.json        # cadenas en inglés del Core (la lista de claves)
  locales/es.json    …   # 8 ficheros (todos menos en): { "Prices": "Precios" }
  locales/ca.json  locales/it.json  locales/fr.json  locales/de.json
  locales/pt.json  locales/gl.json  locales/eu.json
```

**Formato canónico** (para diffs estables):
- UTF-8, JSON con **2 espacios**, **claves ordenadas alfabéticamente**, **newline final**.
- `catalog.en.json`: **array de strings** (sin duplicados), ordenado.
- `locales/<locale>.json`: **objeto** `text_en → traducción`, mismo orden que el catálogo.
- **La BD no es la fuente**: `translations` es un **espejo sembrado** (`source: code` / `module:<key>`).

**Prioridad de origen en colisión** (corregida tras auditoría): **`manual > import > code > module:<key>`**.
- El **Core manda en sus cadenas**: un módulo **no puede** sobrescribir una traducción del Core (vector de **suplantación de UI/avisos** que tenía la prioridad anterior).
- Al sembrar un módulo, si su `text_en` ya existe con `source: code|import|manual`, **no se siembra** y se registra un **aviso** en el log de instalación.
- Una traducción `manual`/`import` del admin **nunca** se pisa por un módulo ni por el seed del Core.

## 5. Scripts y CI (determinismo antes que agentes)

| Script | Qué hace | Falla cuando |
|---|---|---|
| `pnpm i18n:scan` | Recorre el código (`t(...)`, catálogo de settings de task-06 y `label/help/name` de manifests de módulos) y actualiza `catalog.en.json` | — (se commitea el resultado) |
| `pnpm i18n:check` | Compara **catálogo ↔ cada uno de los 8 locales**: faltantes, sobrantes, placeholders distintos, JSON inválido, catálogo stale | **Cualquier** diferencia |

- Corre en el **job `admin`** del CI (junto a lint/tsc/test), igual que la validación del manifest (task-03 §6).
- Valida el **set completo de 9** (8 ficheros + catálogo), aunque la instancia habilite menos.
- **Módulos**: su catálogo y sus locales viven en `packages/<key>/locales/`; el módulo declara un **subconjunto ⊆ 9** que **incluye `en`**, y el check exige **su subconjunto + su catálogo**. Mismo job.

## 6. Siembra y runtime

- **Siembra**: se siembran **siempre los 9 locales** (espejo del repo) al instalar/migrar; habilitar un idioma después **no** exige re-sembrar. `upsert` idempotente por `(locale, text_hash)`.
- **Cadenas retiradas**: las filas `source: code` que ya no están en el catálogo se **borran**; `manual`/`import` se conservan.
- **Resolución**: `resolve(text_en, locale) = traducción(locale) ?? text_en`. El servidor **no localiza** (ADR 0007): devuelve los pares resueltos.
- **`GET /api/v1/translations?locale=xx`**: **autenticado**; solo locales **habilitados** (si no lo está → `locale_not_available`). Devuelve el mapa `text_en → texto` **resuelto** (incluye inglés donde falte traducción).
- **ETag**: hash canónico del **cuerpo servido** (pares resueltos, serialización estable, incluido el fallback) — **no** del seed. Así, una edición `manual`/`import` **cambia el ETag** y el cliente recibe el texto nuevo. Sin cambios → `304`.
- **Invalidación**: cualquier escritura en `translations` del locale (o un cambio de `enabled_locales`) produce un ETag distinto en la siguiente petición.

## 7. Traducción y cobertura

- **Agente Traductor**: **solo PRs** (nunca BD), conserva placeholders, no cambia el inglés, no traduce marcas.
- **Admin (panel)**: `POST /translations/import` y `PUT /translations/{locale}/{text_hash}` con `source: import|manual`.
  - **Validación en la puerta** (la misma que el CI, no solo en CI): `translated_text` ≤ **2000** caracteres, **sin caracteres de control ni bidi override**, **paridad de placeholders** con `text_en`, y **texto plano** (el cliente nunca lo interpreta como HTML/Markdown).
  - **Import acotado**: máximo por payload (bytes) y nº de claves (≈ tamaño del catálogo + margen), procesado en lotes idempotentes.
- **Cobertura**: `GET /translations/status` da % traducido y faltantes por locale; el panel lo muestra.
- Un locale habilitado con < 100 % **no rompe**: cae a inglés.

## 8. Decisiones tomadas (2026-10-26)

| # | Decisión |
|---|---|
| A | **Fuente de verdad en el repo** (`catalog.en.json` + 8 locales); BD = espejo sembrado |
| B | **Texto inglés como clave**; sin claves crípticas; placeholders validados; `en` sin fichero; errores = mensaje inglés por defecto |
| C | **`i18n:scan` + `i18n:check`** en el job `admin`, validando los **9** (8 ficheros + catálogo) |
| D | **Traductor solo por PR**; admin importa/edita en caliente con validación **en la puerta** (longitud, control/bidi, placeholders, texto plano) e import acotado |
| E | **Prioridad `manual > import > code > module`**: el Core manda en sus cadenas; un módulo **no** puede sobrescribirlas (colisión → no se siembra + aviso) |
| F | **ETag = hash del cuerpo servido** (con fallback), recalculado en cada escritura del locale o cambio de idiomas |
| G | **Siembra de los 9 siempre** (habilitar después no requiere re-seed); retiradas `code` se borran, `manual`/`import` se conservan |
| H | **Entregables**: esta spec + `docs/flows/i18n.md`; la **skill `i18n-sync` queda explícitamente diferida** al sprint de implementación (no la define esta spec) |

## 9. Fuera de alcance

- **Plurales / ICU / RTL** (se reevalúa con caso real).
- **Contextos de desambiguación** (`translations.context` no se siembra en v1).
- **Traducción automática en runtime**.
- **UI del panel de traducciones** (sprint-web).
- **Skill `i18n-sync`**: **no** la define esta spec; se materializa en el sprint de implementación cuando existan los scripts.
- **Android**: `apps/android` se localiza con su propio mecanismo (`values-*`); esta pipeline cubre **Core web/admin + módulos**.

## 10. Testing

- `i18n:check` falla con: clave faltante, sobrante, placeholder distinto, JSON inválido, catálogo stale. **Pasa** con el set completo.
- Siembra idempotente: dos ejecuciones no duplican; una cadena retirada `code` desaparece; una `manual` sobrevive.
- **Colisión módulo↔Core**: instalar un módulo cuya cadena coincide con una del Core **no** cambia la traducción del Core (y deja aviso).
- **ETag**: sin cambios → `304`; **editar una traducción `manual` → ETag nuevo y 200 con el texto nuevo**; locale deshabilitado → `locale_not_available`; re-habilitar → ETag válido.
- **Puerta**: `translated_text` con HTML, carácter de control, bidi override o placeholder distinto → `validation_failed` (no se guarda).
- Import: por encima del límite → `validation_failed`; lotes idempotentes (repetir no duplica).
- `GET /translations` incluye el fallback en inglés y **no** expone claves inexistentes.

## 11. Criterios de aceptación

- `packages/i18n/` con catálogo + 8 locales en el formato canónico; `i18n:check` en CI cubriendo los casos de §10.
- Inglés como clave en todo el producto web/admin; **ningún** `error.<code>` como clave de catálogo.
- Siembra de los 9, idempotente, con prioridad `manual > import > code > module` y aviso en colisión.
- Runtime: solo locales habilitados, fallback, **ETag del cuerpo servido** que cambia con ediciones.
- Puerta de import/edición validando longitud, control/bidi, placeholders y texto plano.
- `docs/flows/i18n.md` publicado y enlazado desde `feature.md`, `new-module.md` y `agents.md`.
- Sin residuos de «4 locales» en los flujos y convenciones tocados.
- Revisado por segundo agente y **auditoría OWASP** (esta spec tuvo un Alta —suplantación entre módulos— que queda resuelta en §4).

## 12. Referencias

- ADR 0008 · spec de datos (`translations`) · config (`enabled_locales`) · módulos · API §3.9 · ADR 0007 · testing §6
- Flujo entregable: `docs/flows/i18n.md`
- Plan: `docs/superpowers/plans/2026-10-26-sprint-core-design.md` · Task: `docs/tasks/sprint-core-design/task-09.md`