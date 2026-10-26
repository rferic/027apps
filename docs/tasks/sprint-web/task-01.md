---
id: sprint-web
titulo: Web de administración — base y páginas de gestión (backlog)
area: web
estado: pendiente
---

Sprint de **backlog** (pendiente de planificar): montar la base real del admin web sobre el scaffold existente (`apps/admin`: layout, `/api/health`, DS v1 del sprint-02) y, después, las páginas de gestión privadas.

**Por qué existe / alcance previsto (a detallar al planificar):**
- **Base para empezar a trabajar**: login + sesión (Supabase Auth SS, roles super_admin/admin — spec de auth §6, ADR 0005), wizard de instalación `/setup` (primer super_admin — spec de auth §3bis, task-06 del Core).
- **Página de documentación de la API**: render del **OpenAPI generado** (spec API v1 A2) con **Swagger UI o alternativa** (Scalar/RapiDoc) — para que quien integre vea el contrato vivo.
- **Parte privada**: shell con navegación + **dashboard** y las páginas de gestión — **configuraciones de instancia** (task-06), **listado y gestión de usuarios** (roles, revocar sesión), **invitaciones**, **grupos** (miembros, roles), **API keys/MCP** (task-02/05). Definida en la task-12 del Core (shell).

**Depende de (puerta de entrada, cumplirse antes de planificar/implementar):**
- API del Core **implementada** (`/api/v1` con los recursos transversales — task-02 del Core; API-first, ADR 0004: el panel solo consume su API).
- **OpenAPI generado** desde los schemas zod compartidos (spec API v1 A2) — fuente de la página de documentación.
- **Supabase Auth** conectado (sprint de infra, login) y `JWT_EXPIRY` configurado (ADR 0006).
- Definición del Core (specs 01, 02, 06, 12) `finalizada` para que la implementación no redecida arquitectura (ADR 0005).

**Nota:** no es un sprint del Core; es el panel de administración (web de administración, spec §2), su implementación sigue ADR 0004/0005 y el flujo de `docs/flows/feature.md`.