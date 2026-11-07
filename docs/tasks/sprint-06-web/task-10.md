---
id: sprint-06-task-10
titulo: Documentación de la API
area: web
estado: test
adrs: [0004, 0005, 0007]
plan: docs/superpowers/plans/2026-11-06-web-admin.md
spec: docs/superpowers/specs/2026-11-06-web-admin-design.md
---

**Alcance**: registro declarativo con `z.toJSONSchema()` de zod 4 (nativo; `zod-to-openapi` no soporta zod 4), `docs/api/openapi.json`, `GET /api/v1/openapi.json`, visor Scalar autoalojado, CI de paridad y de documento al día.

> Documento en **JSON**, no YAML: zod 4 emite JSON Schema nativamente y evitar un serializador YAML elimina una dependencia.

**TDD**: generación determinista, registro completo, página, checks.

**DoD**: igual, énfasis A03 y cadena de suministro.
