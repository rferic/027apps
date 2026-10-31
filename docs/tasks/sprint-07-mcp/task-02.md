---
id: sprint-07-task-02
titulo: Catálogo Core, `role_cap` e idempotencia
area: core
estado: pendiente
adrs: [0004, 0007]
plan: docs/superpowers/plans/2026-10-27-core-implementation-roadmap.md
---

**Alcance**: Tools de usuario (perfil, instancia, mis módulos) y de administración (invitaciones, usuarios, roles, categorías, acceso a módulos, settings permitidos, admin_actions) con `inputSchema`/`outputSchema` compartidos, `structuredContent` = REST, `isError` con `code` y `request_id`, idempotencia con `request_hash`.

**TDD**: contrato MCP (discover, headers, versión, errores), test cruzado `structuredContent` == REST por tool, y los negativos de seguridad (tipo de clave, `mcp_exposed`, no enumeración).

**DoD**: DoD de Código + auditoría OWASP.
