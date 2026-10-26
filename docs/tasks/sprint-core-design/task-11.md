---
id: sprint-core-design-task-11
titulo: Documentación de la API pública — `docs/api/README.md` (definición)
area: core
estado: pendiente
plan: docs/superpowers/plans/2026-10-26-sprint-core-design.md
---

Tarea 11 del sprint 04 (Diseño del Core). Sprint de **definición**: entrega documentación aprobada, sin código.

**Entregable**: `docs/api/README.md` — la **guía pública para consumidores externos** de la API (spec §11 paquete de documentación), en inglés.

**Alcance**:
- Público: desarrolladores externos que integren contra `/api/v1` (third-party, herramientas propias conectadas por API key).
- Contenido: cómo autenticarse (móvil con JWT de Supabase; terceros con API keys de instancia `027_svc_` / delegado `027_usr_`, scopes — spec de tokens), base URL y versionado (`/api/v1`), formato de errores (envelope ADR 0007), paginación (offset-limit + cursor, api-v1 D2), rate limiting (C1), fechas/moneda (ADR 0008), y **enlace al OpenAPI generado como fuente de verdad** (api-v1 A2). MCP si procede.
- Sin duplicar: enlaza la spec y el OpenAPI; no copia secciones enteras (regla anti-duplicación spec §11).

**Decisiones a fijar**: estructura de la guía, idioma (inglés — superficie pública), cuándo existe el OpenAPI generado (dependencia de la implementación del contrato), dónde se renderiza además en el admin (se conecta con el sprint-web: página de documentación con Swagger o alternativa).

**Criterios de aceptación**: guía completa, en inglés, con rutas y comandos verificados contra el repo; enlaza el OpenAPI generado sin duplicarlo; sin contradecir la spec de API v1 ni ADR 0007/0008; corregida por el flujo de docs con segundo agente.

**Referencias**: spec API v1 (`2026-10-25-api-v1.md`), spec diseño §11 (paquete de documentación, idiomas), ADR 0007/0008, spec de tokens §3 (prefijos), sprint-web (README.md del backlog).