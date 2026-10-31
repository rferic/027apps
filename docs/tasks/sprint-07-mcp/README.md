---
id: sprint-07-mcp
titulo: MCP — transporte, catálogo del Core y tools de módulo
area: core
estado: pendiente
plan: docs/superpowers/plans/2026-10-27-core-implementation-roadmap.md
---

Sprint de **implementación** del MCP sobre el backbone ya construido (mismos casos de uso y representación que REST).

**Depende de:** sprint-06 (módulos, claves, `mcp_exposed`). **Spec:** task-05 del diseño del Core.

| # | Tarea | Entregable |
|---|---|---|
| 01 | Transporte y autenticación MCP | `2026-07-28` stateless, `/mcp` y `/mcp/admin`, `server/discover`, `Origin`, errores en dos canales |
| 02 | Catálogo Core + `role_cap` + idempotencia | 4 tools de usuario y 22 de administración con scopes, `isError` con `code`/`request_id` |
| 03 | Tools de módulo + `mcp_exposed` + docs | tools por módulo con `kind`, gating `read`/`read_write`, cobertura de docs en CI |

**Cierre:** DoD de Código + auditoría OWASP; la suite de contrato demuestra "MCP devuelve lo mismo que REST".
