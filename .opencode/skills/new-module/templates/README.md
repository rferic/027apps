# Plantillas de `new-module`

Copia la plantilla al paquete del módulo y **reemplaza todos los placeholders**. La skill
`new-module` considera un fallo dejar `<...>` en el manifest.

- `manifest.json` — forma del contrato (§3 de `docs/superpowers/specs/2026-10-26-modulo-system.md`).
  - `key` en kebab-case y único; no puede ser `admin`, `mcp`, `api` ni `core`.
  - `name`/`label`/`help` en inglés (son claves i18n).
  - `branding.color` ∈ los 8 slots del DS (`teal`, `indigo`, `violet`, `amber`, `rose`,
    `emerald`, `sky`, `slate`); nunca un hex libre.
  - Cada migración declara `up` **y** `down`; `version` única en el manifest; calcula
    `digest`/`down_digest` con SHA-256 sobre el contenido de cada SQL.
  - `settings[].category` = `snake_case(key)`; cada setting declara la forma completa.
  - `scopes` con convención `recurso:acción`; viven en código, el manifest solo los declara.
  - `docs`: `readme` obligatorio; `api` si hay `scopes`; `mcp` si hay `mcp_tools`;
    `settings` si hay `settings`; `events` si hay `eventos`/`channels`.
  - Borra las capacidades que el módulo no use y sus docs asociados.

- `module-spec.md` — esqueleto de la spec del módulo (entregable de la fase 1 del flujo).
