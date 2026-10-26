---
id: sprint-core-design-task-05
titulo: MCP del Core — spec (definición)
area: core
estado: finalizada
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

**Correcciones de la revisión de segundo agente (2026-10-26)** — 7 Alta + 10 Media + 5 Baja:
- **Protocolo `2026-07-28`** (no legacy): sin handshake, `_meta` por request, headers `MCP-Protocol-Version`/`Mcp-Method`/`Mcp-Name`, **`server/discover` obligatorio**, `legacy: 'reject'`, validación `Origin`/`Host`, `WWW-Authenticate`; SDK **v2** (`@modelcontextprotocol/server`, no `sdk` v1).
- **Errores en dos canales**: protocolo (JSON-RPC, códigos estándar, sin `-32000`) vs ejecución (`isError: true` con `code` del ADR 0007 + `request_id`).
- **`api_keys.role_cap`** (`admin`|`super_admin`): una clave service no hereda super_admin; `users_deactivate` exige cap super_admin; `users_update` (perfil) separado de `users_assign_role`.
- **`mcp_exposed` en 3 niveles** (`none`|`read`|`read_write`, default `read`): instalar expone solo lectura; las escrituras las habilita el admin.
- **Idempotencia real**: `idempotency_keys` con `request_hash` (payload distinto → `conflict`), TTL 24 h, misma transacción.
- **Actores de máquina**: `created_by_key`/`assigned_by_key`/`granted_by_key` con CHECK de exactamente un actor (resuelve el NOT NULL roto con claves service).
- **`profiles.deactivated_at`** (no existía): desactivación soft con revocación inmediata y reactivación.
- **`settings` con `mcp_access`** (`none` por defecto en `security.*`/`connectivity.*`/`auth.*`): un agente no puede desactivar el rate limiting ni ampliar CORS.
- **403** (no 401) para clave del tipo incorrecto; **404 uniforme** para módulo no disponible; gates reevaluados en cada `tools/call`; herramientas destructivas con `confirm: true`.
- **Nombres únicos por endpoint** (`instance_get` solo en `/mcp`, `my_modules_list` ≠ `modules_list`); auditoría `(endpoint, tool)`.
- **Detalles corregidos**: `instance:read` eliminado (el endpoint `/instance` es público), `categories_assign_module` = upsert que limpia `revoked_at` y `unassign` no revoca, `ListResult`/`MutationResult`/`Instance` para `outputSchema`, rate limiting en capas, OAuth es OPTIONAL en la spec y CIMD sustituye a DCR.

**Auditoría de seguridad OWASP (2026-10-26)** — veredicto `APROBADA CON OBSERVACIONES` (sin críticos ni altos). Resueltas en la spec:
- **H1** revocación: `revoked_at`/`expires_at` en BD por petición o invalidación de caché (token-model §5) + test.
- **H2** invariantes en MCP: root no se demota/desactiva y siempre ≥1 `super_admin` activo, con tests.
- **H3** `invitations_create` **no** devuelve el token/enlace de canje.
- **H4** rate limiting de escritura y superficies sin identidad con **almacén compartido con TTL** (core-api §4).
- **H5** índices únicos **parciales** en `idempotency_keys` (NULL no colisiona).
- **H6** normalización del `request_hash` (JSON canónico) con test de payload equivalente.
- **H7** CHECK `(kind='service') = (role_cap IS NOT NULL)`.
- **H8–H11** documentadas: `q` por email como trade-off, `confirm` no es prueba de HITL, `.strict()` + pin del SDK, replay = resultado de aquella mutación.

**Decisiones tomadas** (conversación de diseño, 2026-10-26): MCP por módulo + generales, catálogo con acciones, `role_cap` para claves service, idempotencia por id de cliente, API keys en v1 con OAuth en backlog, `mcp_exposed` en 3 niveles.

**Criterios de aceptación**: tres familias de endpoints con la clave correcta cada una y módulo no disponible → 404; catálogo con acciones y `tools/list` filtrado; tools de módulo solo con `active` + `mcp_exposed` + acceso + scope; `outputSchema`/`structuredContent` compartidos validados por el SDK; escrituras idempotentes; errores con `data.code` sin internos; rate limit y auditoría por tool.

**Referencias**: spec API v1 §3.8 (con delta 2026-10-26), spec de tokens §3/§5 (`2026-10-25-token-model.md`), ADR 0004, ADR 0007, task-02 (recursos), task-03 (manifest), spec diseño §4, backlog `sprint-mcp-oauth`.