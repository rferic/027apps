---
id: sprint-core-design-task-05
titulo: MCP del Core — spec (definición)
area: core
estado: pendiente
plan: docs/superpowers/plans/2026-10-26-sprint-core-design.md
---

Tarea 5 del sprint 04 (Diseño del Core). Sprint de **definición**: entrega una spec aprobada, sin código.

**Entregable**: spec `docs/superpowers/specs/2026-10-26-mcp.md` — el endpoint MCP del Core sobre el backbone de la API v1.

**Alcance** (spec de diseño §4 y api-v1 §3.8):
- **Endpoint MCP** (transporte HTTP, SDK oficial `@modelcontextprotocol/sdk`) como **puerta delgada más** (ADR 0004): autentica, autoriza por scopes y delega en el **mismo caso de uso** que el REST; devuelve la **misma representación compartida**.
- **Autenticación: API key de instancia** `027_svc_` (spec de tokens §3.2 — la taxonomía **no** tiene tipo `mcp`); sin identidad de usuario; scopes por módulo/tool (api-v1 E).
- **Declaración de tools**: tools core (lectura de grupos/miembros — alcance v1 de api-v1 §3.8) + tools que cada módulo aporta (Split Expenses primero); cada tool declara su acción expuesta y scopes; el guard las comprueba igual que en REST.
- **Errores MCP**: mapeo del `code` de dominio (ADR 0007) al `error` JSON-RPC de MCP (con `details` en `data`).
- **UI de gestión de keys MCP** en el admin (con task-02 `/api-keys` y task-12 shell).

**Decisiones a fijar**: transporte/configuración del endpoint MCP, catálogo de tools core v1, mapeo exacto de errores ADR 0007 al protocolo MCP, cómo un módulo declara sus tools (conexión con task-03 manifest), rate limiting sobre MCP.

**Criterios de aceptación**: una tool MCP llama al mismo caso de uso que su endpoint REST y devuelve la misma representación (api-v1 §3.8); la auth es por clave de instancia con scopes; los errores usan los `code` del ADR 0007; el CI no expone secretos (`guard-secrets`).

**Referencias**: spec API v1 §3.8 (E), spec de tokens §3.2/§5 (`2026-10-25-token-model.md`), ADR 0004, ADR 0007, task-02 (recursos), task-03 (manifest), spec diseño §4.