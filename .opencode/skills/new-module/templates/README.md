# Plantillas de `new-module`

Copia la plantilla al directorio de trabajo de la tarea y **reemplaza todos los
placeholders**. La skill `new-module` considera un fallo dejar `<...>` en el manifest.

- `manifest.json` — forma del contrato. Fuente canónica: `docs/ai/module-system.md`;
  esquema: `docs/ai/manifest.schema.json`.
  - `key` en kebab-case y único; no puede ser `admin`, `mcp`, `api` ni `core`.
  - `name`/`label`/`help` en inglés (textos visibles; i18n los traduce, no son claves i18n).
  - `branding.color` ∈ los 8 slots del DS (`teal`, `indigo`, `violet`, `amber`, `rose`,
    `emerald`, `sky`, `slate`); nunca un hex libre.
  - Cada migración declara `up` **y** `down`; `version` única en el manifest; calcula
    `digest`/`down_digest` con SHA-256 sobre el contenido de cada SQL.
  - `settings[].category` = `snake_case(key)`; cada setting declara la forma completa.
  - `scopes` con convención `recurso:acción`; viven en código, el manifest solo los declara.
  - `docs`: `readme` obligatorio; `api` si hay `scopes`; `mcp` si hay `mcp_tools`;
    `settings` si hay `settings`; `events` si hay `eventos`/`channels`.
  - Borra las capacidades que el módulo no use y sus docs asociados.

- `module-spec.md` — esqueleto de la spec del módulo (entregable de la fase de spec).
  Referencia el contrato en `docs/ai/module-system.md`.

- `state.md` — memoria del proceso: brief, análisis, requisitos cerrados, dependencias del
  Core, artefactos, puertas y bitácora. Se copia al directorio de trabajo de la tarea y se
  actualiza en cada fase.
