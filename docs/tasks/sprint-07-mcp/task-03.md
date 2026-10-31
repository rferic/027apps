---
id: sprint-07-task-03
titulo: Tools de módulo, exposición y documentación
area: core
estado: pendiente
adrs: [0004, 0005, 0007]
plan: docs/superpowers/plans/2026-10-27-core-implementation-roadmap.md
---

**Alcance**: Tools namespaced por endpoint con `kind: read|write`; gating por módulo `active` + `mcp_exposed` + `has_module_access` + scope; `tools/list` filtrado; CI comprueba que cada tool declarada aparece en `docs/mcp.md`.

**TDD**: contrato MCP (discover, headers, versión, errores), test cruzado `structuredContent` == REST por tool, y los negativos de seguridad (tipo de clave, `mcp_exposed`, no enumeración).

**DoD**: DoD de Código + auditoría OWASP.
