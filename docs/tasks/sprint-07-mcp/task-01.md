---
id: sprint-07-task-01
titulo: Transporte y autenticación MCP
area: core
estado: pendiente
adrs: [0004, 0007]
plan: docs/superpowers/plans/2026-10-27-core-implementation-roadmap.md
---

**Alcance**: Streamable HTTP stateless con SDK v2, `server/discover`, `_meta`/headers, `legacy: 'reject'`, validación de `Origin`/`Host`; `/mcp` (delegada) y `/mcp/admin` (service con `role_cap`) rechazan el tipo incorrecto con **403**; 404 uniforme.

**TDD**: contrato MCP (discover, headers, versión, errores), test cruzado `structuredContent` == REST por tool, y los negativos de seguridad (tipo de clave, `mcp_exposed`, no enumeración).

**DoD**: DoD de Código + auditoría OWASP.
