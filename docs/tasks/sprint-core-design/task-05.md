---
id: sprint-core-design-task-05
titulo: MCP del Core — spec (definición)
area: core
estado: test
plan: docs/superpowers/plans/2026-10-26-sprint-core-design.md
---

Tarea 5 del sprint 04 (Diseño del Core). Sprint de **definición**: entrega una spec aprobada, sin código.

**Entregable**: spec `docs/superpowers/specs/2026-10-26-mcp.md` — MCP del Core y por módulo, con acciones.

**Alcance** (refleja el contenido real de la spec):
- **Topología (decisión del usuario)**: **un MCP por módulo** (`/mcp/<module_key>`) + dos generales del Core (`/mcp` con clave delegada, `/mcp/admin` con clave de instancia). Sin duplicar tools: `modules_list` es el descubrimiento. Palabras reservadas de módulo (`admin`, `mcp`, `api`, `core`).
- **Transporte**: Streamable HTTP **stateless**, SDK oficial v2, versión de protocolo declarada. Fuera de `/api/v1` a propósito (JSON-RPC sobre HTTP, no REST).
- **MCP actúa, no solo consulta**: catálogo Core con invitaciones, usuarios (incl. `role` vía `roles:assign`), categorías (incl. asignar módulo → materializa `user_modules`), concesión/revocación de acceso a módulos y settings **no secretos**; las tools de módulo pueden escribir (crear gasto, liquidar) pasando por los mismos casos de uso.
- **Fuera de MCP**: ciclo de vida de módulos (DDL + revisión humana), API keys (secreto único), settings `is_secret`, borrado destructivo de dinero.
- **Autenticación**: claves service (`027_svc_`) en `/mcp/admin` y delegadas (`027_usr_`) en `/mcp` y `/mcp/<module_key>`; cada ruta rechaza la clave del otro tipo; acceso efectivo `min(scopes clave, permisos usuario)` + `has_module_access`.
- **Contrato verificado**: `inputSchema`/`outputSchema` son los schemas zod compartidos y el SDK valida `structuredContent` → MCP == REST por construcción.
- **Idempotencia**: `create` con `id` UUID del cliente + `idempotency_key` para acciones repetibles (mismo patrón en REST).
- **Errores**: JSON-RPC con `data.code` del ADR 0007 y `details` de validación; 401/403/404/429/500.
- **Operación**: rate limiting por clave y endpoint, `audit` por tool, `admin_actions` en mutaciones sensibles; `module_registry.mcp_exposed` para apagar las tools de un módulo.
- **OAuth 2.1 diferido** (desviación documentada) → backlog `docs/tasks/sprint-mcp-oauth/task-01.md`.

**Decisiones tomadas** (conversación de diseño, 2026-10-26): MCP por módulo + generales, catálogo con acciones, `users_update` con `roles:assign`, idempotencia por id de cliente, Streamable HTTP, API keys en v1 con OAuth en backlog, `mcp_exposed`.

**Criterios de aceptación**: tres familias de endpoints con la clave correcta cada una y módulo no disponible → 404; catálogo con acciones y `tools/list` filtrado; tools de módulo solo con `active` + `mcp_exposed` + acceso + scope; `outputSchema`/`structuredContent` compartidos validados por el SDK; escrituras idempotentes; errores con `data.code` sin internos; rate limit y auditoría por tool.

**Referencias**: spec API v1 §3.8 (con delta 2026-10-26), spec de tokens §3/§5 (`2026-10-25-token-model.md`), ADR 0004, ADR 0007, task-02 (recursos), task-03 (manifest), spec diseño §4, backlog `sprint-mcp-oauth`.