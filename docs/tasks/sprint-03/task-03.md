---
id: sprint03-task-03
titulo: ADRs de arquitectura del Core (definición)
area: core
estado: en curso
---

Tarea 3 del sprint 03. Sprint de **definición**: no genera código, solo documentación aprobada.

**Entregables**: ADRs de arquitectura en `docs/adr/`, según el ítem del backlog de la spec §11 («Patrones arquitectónicos por ADR: server actions vs API routes, validación (zod), manejo de errores, estado y fetching, fechas y moneda»), cada uno tras conversación de diseño con el usuario.

**Estado (2026-10-25):**
- [x] **ADR 0004 — Bordes y capa de aplicación** (`docs/adr/0004-bordes-y-capa-de-aplicacion.md`): puertas delgadas (API `/api/v1`, MCP, comandos), guard de autorización compartido con scopes por acción expuesta, zod en el borde + invariantes en casos de uso, casos de uso básicos y orquestadores, transacciones por orquestador (patrón Laravel), representación compartida, admin vía API routes (sin server actions). Aprobado por el usuario (2026-10-25).
- [x] **ADR 0005 — Estado y fetching del admin** (`docs/adr/0005-estado-y-fetching-del-admin.md`): patrón híbrido "provided by the server" (Server Components dan el dato inicial; librería cliente SWR/TanStack lo gestiona en vivo; mutaciones por `/api/v1` con invalidación coordinada vía `revalidateTag`; `updateTag` descartado por ser solo de Server Actions). Pendiente de aprobación del usuario (2026-10-25).
- [~] **ADR 0006 — Realtime** (`docs/adr/0006-realtime.md`): **Supabase Realtime (Broadcast) con eventos de dominio publicados por la API tras el commit**, aislamiento por RLS (topic por grupo, `private: true`), `JWT_EXPIRY = 900 s`, admin web fuera (ADR 0005). Borrador revisado por segundo agente (3 correcciones aplicadas: enlace de Base, matiz de la task-03, mecanismo `sb_secret_*` por deprecación de `service_role`). **Pendiente de aprobación del usuario** (2026-10-25). Nota: el sprint de infra quedó registrado en `docs/tasks/sprint-infra/task-01..07.md` (pendientes).
- [ ] **ADR — Manejo de errores**: pendiente de conversación de diseño.
- [ ] **ADR — Validación (zod)**: mayormente fijado en el ADR 0004; se detalla si procede.
- [ ] **ADR — Fechas y moneda**: pendiente de conversación de diseño.

**Nota**: el ADR 0004 precisa la spec de tokens (§5): los scopes se declaran **por acción expuesta**, no solo por endpoint HTTP — la spec `2026-10-25-token-model.md` quedó actualizada en consecuencia.