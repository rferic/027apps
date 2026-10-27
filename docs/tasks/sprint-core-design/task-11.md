---
id: sprint-core-design-task-11
titulo: Documentación de la API pública — `docs/api/README.md` (definición)
area: core
estado: finalizada
plan: docs/superpowers/plans/2026-10-26-sprint-core-design.md
---

Tarea 11 del sprint 04 (Diseño del Core). Sprint de **definición**: entrega documentación aprobada, sin código.

**Entregable**: `docs/api/README.md` — la **guía pública para consumidores externos** de la API (spec §11 paquete de documentación), en inglés.

**Alcance**:
- Público: desarrolladores externos que integren contra `/api/v1` (third-party, herramientas propias conectadas por API key).
- Contenido: cómo autenticarse (móvil con JWT de Supabase; terceros con API keys de instancia `027_svc_` / delegado `027_usr_`, scopes — spec de tokens), base URL y versionado (`/api/v1`), formato de errores (envelope ADR 0007), paginación (offset-limit + cursor, api-v1 D2), rate limiting (C1), fechas/moneda (ADR 0008), y **enlace al OpenAPI generado como fuente de verdad** (api-v1 A2). MCP si procede.
- Sin duplicar: enlaza la spec y el OpenAPI; no copia secciones enteras (regla anti-duplicación spec §11).

**Decisiones a fijar**: estructura de la guía, idioma (inglés — superficie pública), cuándo existe el OpenAPI generado (dependencia de la implementación del contrato), dónde se renderiza además en el admin (se conecta con el sprint-web: página de documentación con Swagger o alternativa).

**Estado (2026-10-27):** entregado `docs/api/README.md` (inglés, guía pública) + **delta de documentación por capacidad** en el contrato de módulos.
- **Guía completa**: quickstart con 3 credenciales, auth (scopes, `role_cap`, revocación inmediata, secreto mostrado una vez), versionado, **catálogo de errores** (13 códigos con HTTP y si reintentar), paginación (offset/cursor), rate limiting en capas, **idempotencia** (`id` de cliente + `Idempotency-Key` con `request_hash`), fechas/dinero, **módulos**, **MCP al detalle** y OpenAPI.
- **MCP documentado a fondo**: endpoints y credenciales (`/mcp`, `/mcp/admin`, `/mcp/<module>`), protocolo `2026-07-28` stateless, catálogo de tools Core (4 de usuario + **22** de administración con scopes y `role_cap` mínimo), tools de módulo, `structuredContent` = representación REST, **dos canales de error** (protocolo vs ejecución con `isError`), idempotencia, anotaciones + `confirm: true`, y **lo que no está disponible por diseño** (DDL, API keys, secretos).
- **Docs por capacidad de módulo** (delta a task-03): `docs.readme` obligatorio; `api`/`mcp`/`settings`/`events` obligatorios **según lo que declare el manifest**; el CI exige el fichero y que **cada nombre declarado aparezca**; `GET /modules/{key}` devuelve el bloque `docs`.
- **Artefacto OpenAPI**: `docs/api/openapi.yaml` generado desde los schemas zod, servido en `GET /api/v1/openapi.json`, commiteado para revisión y verificado por CI. La guía **no enlaza** el fichero mientras no se genere (estado declarado; la referencia normativa es la spec).
- **Estado honesto**: la guía declara que la v1 **aún no está implementada** (hoy solo el alias `/api/health`), para no presentar rutas de diseño como existentes.

**Criterios de aceptación**: guía en inglés con las 11 secciones; catálogo de errores completo; MCP detallado; contrato de docs de módulo con validación mecánica; rutas y comandos verificados; sin enlaces rotos; revisada por segundo agente.

**Referencias**: `docs/api/README.md`, api-v1, core-api, mcp, modulo-system (delta `docs`), `SECURITY.md`, `docs/guia-debugging.md`.
