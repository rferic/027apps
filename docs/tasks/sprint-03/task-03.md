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
- [ ] **ADR — Estado y fetching del admin** (cómo el panel consume su propia API): pendiente de conversación de diseño.
- [ ] **ADR — Manejo de errores**: pendiente de conversación de diseño.
- [ ] **ADR — Validación (zod)**: mayormente fijado en el ADR 0004; se detalla si procede.
- [ ] **ADR — Fechas y moneda**: pendiente de conversación de diseño.

**Nota**: el ADR 0004 precisa la spec de tokens (§5): los scopes se declaran **por acción expuesta**, no solo por endpoint HTTP — la spec `2026-10-25-token-model.md` quedó actualizada en consecuencia.