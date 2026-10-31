# Spec — Módulo `<key>`

**Fecha:** <YYYY-MM-DD>
**Estado:** Borrador para aprobación del usuario
**Paquete:** `packages/<key>/`
**Manifest:** `packages/<key>/manifest.json` (contrato: `docs/superpowers/specs/2026-10-26-modulo-system.md` §3)
**Flujo:** `docs/flows/new-module.md` · **Feature base:** `docs/flows/feature.md`

## 1. Objetivo y límites de v1

- Qué problema resuelve para la familia y por qué es un módulo (no una pantalla del Core).
- Qué **no** hace en v1 (límites explícitos).
- Referencias de producto: <enlaces a specs/mockups si existen>.

## 2. Modelo de datos

- Tablas del módulo, con `group_id` en todas y RLS scoped al grupo.
- Referencias a `participants`, nunca a `profiles`.
- Migraciones: versión, `up` y `down` reversibles; `down` no borra dinero (spec §12).
- Índices y restricciones relevantes.

## 3. Superficie

- **API:** endpoints del módulo (recursos, acciones, scopes `recurso:acción`).
- **Settings:** categoría, settings y defaults (forma completa del §3).
- **i18n:** locales y claves visibles (inglés como clave).
- **Tools MCP:** nombre, `kind` (`read`/`write`), descripción y scopes.
- **Eventos realtime:** canales (`pattern` + `members_fn`) y eventos (`type`, `target`, `notify`).
- **Páginas de admin:** ruta de un solo segmento, label, icono, group y role.
- **Hooks:** eventos del Core a los que reacciona.

## 4. Seguridad

- RLS por tabla y pruebas de aislamiento entre grupos.
- Scopes mínimos; ninguna tool MCP de `write` expuesta por defecto.
- Datos sensibles: qué se cifra (`is_secret`) y qué no se expone.
- Revisión OWASP específica del módulo además de la incondicional.

## 5. Documentación por capacidad

- `README.md` (obligatorio), `docs/api.md`, `docs/mcp.md`, `docs/settings.md`,
  `docs/events.md` — cada nombre declarado en el manifest debe aparecer en su documento.

## 6. Criterios de aceptación

- <criterios verificables, uno por línea>
- Instalación/activación/desinstalación coherentes con el contrato.
- `i18n:check`, validación del manifest y tests de RLS en verde.
