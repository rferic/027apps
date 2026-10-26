---
id: sprint-mcp-oauth
titulo: OAuth 2.1 para MCP (backlog)
area: core
estado: pendiente
---

Sprint de **backlog**: llevar el servidor MCP del Core al modelo de autorización de la **spec MCP vigente (2026-07-28)** para servidores remotos, que exige **OAuth 2.1**.

**Por qué existe:** en v1 el MCP se autentica con **API keys** del modelo de tokens ya aprobado (claves opacas `027_svc_` / `027_usr_`, scopes, revocación instantánea). Es una **desviación documentada** (ver `docs/superpowers/specs/2026-10-26-mcp.md` §3), justificada porque la instancia es autoalojada y privada y las claves las emite su propio administrador. Si el MCP se abre a terceros que no controla el usuario, la spec exige el camino OAuth.

**Alcance previsto (a detallar al planificar):**
- **Servidor de autorización** (o delegación a un proveedor): endpoints de autorización y token, **PKCE**.
- **Registro dinámico de clientes** (DCR) — o metadata de clientes precargados, según lo que admita la spec vigente.
- **Metadata de recurso protegido** (`/.well-known/oauth-protected-resource`, RFC 9728).
- **Validación de audience** del token (RFC 8707): el token debe ser para **esta** instancia.
- **Consentimiento** del usuario y pantalla de autorización.
- **Convivencia con el modelo de tokens**: qué pasa con las API keys actuales (¿se mantienen para `service`?), migración y revocación.
- **Alternativa a evaluar**: si sigue bastando con claves (instancia privada), **no implementar** — el backlog existe para no cerrar la puerta, no para obligar.

**Depende de:** MCP del Core implementado (`docs/superpowers/specs/2026-10-26-mcp.md`) y modelo de tokens `finalizada`.

**Criterios de aceptación (al planificar):** decisión explícita de implementar o descartar OAuth con motivo escrito; si se implementa, un cliente MCP externo se conecta sin clave manual y el token no sirve contra otra instancia.
