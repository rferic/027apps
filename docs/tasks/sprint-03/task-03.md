---
id: sprint03-task-03
titulo: ADRs de arquitectura del Core (definición)
area: core
estado: finalizada
---

Tarea 3 del sprint 03. Sprint de **definición**: no genera código, solo documentación aprobada.

**Entregables**: ADRs de arquitectura en `docs/adr/`, según el ítem del backlog de la spec §11 («Patrones arquitectónicos por ADR: server actions vs API routes, validación (zod), manejo de errores, estado y fetching, fechas y moneda»), cada uno tras conversación de diseño con el usuario.

**Estado (2026-10-25):**
- [x] **ADR 0004 — Bordes y capa de aplicación** (`docs/adr/0004-bordes-y-capa-de-aplicacion.md`): puertas delgadas (API `/api/v1`, MCP, comandos), guard de autorización compartido con scopes por acción expuesta, zod en el borde + invariantes en casos de uso, casos de uso básicos y orquestadores, transacciones por orquestador (patrón Laravel), representación compartida, admin vía API routes (sin server actions). Aprobado por el usuario (2026-10-25).
- [x] **ADR 0005 — Estado y fetching del admin** (`docs/adr/0005-estado-y-fetching-del-admin.md`): patrón híbrido "provided by the server" (Server Components dan el dato inicial; librería cliente SWR/TanStack lo gestiona en vivo; mutaciones por `/api/v1` con invalidación coordinada vía `revalidateTag`; `updateTag` descartado por ser solo de Server Actions). Pendiente de aprobación del usuario (2026-10-25).
- [x] **ADR 0006 — Realtime** (`docs/adr/0006-realtime.md`): **Supabase Realtime (Broadcast) con eventos de dominio publicados por la API tras el commit**, aislamiento por RLS (topic por grupo, `private: true`), `JWT_EXPIRY = 900 s`, admin web fuera (ADR 0005). **Aprobado por el usuario** (2026-10-25) tras revisión de segundo agente con las 3 correcciones aplicadas. Nota: el sprint de infra quedó registrado en `docs/tasks/sprint-infra/task-01..07.md` (pendientes).
- [x] **ADR 0007 — Manejo de errores** (`docs/adr/0007-manejo-de-errores.md`): modelo de error único y estable en el borde con `code` máquina-legible + `message` que los clientes traducen; envelope `{ error: { code, message, request_id, details? } }`; taxonomía (zod → `validation_failed`; invariante de dominio → código específico); 401≠403 sin enumeración; mapeo HTTP mínimo 400/401/403/404/409/429/500; sin fuga de internos (OWASP, ni en dev); `request_id` de correlación; efectos externos tras commit sin revertir el dato. Aprobado por el usuario (2026-10-25).
- [x] **ADR 0008 — Fechas y moneda** (`docs/adr/0008-fechas-y-moneda.md`): instantes UTC ISO 8601 + fechas de calendario `date` explícitas; zona horaria de instancia como default (instalador); dinero en enteros de céntimos (`amount_minor`) + ISO 4217; moneda por grupo con default de instancia; divisa original + tipo de cambio por transacción; redondeo determinista; servidor no formatea; idiomas activables en el instalador (set `en, es, ca, it, fr, de, pt, gl, eu`, actualiza la spec §3/§11); mecanismo de cumplimiento en 3 niveles + DoD con `adrs:` en frontmatter. Aprobado por el usuario (2026-10-25).
- [x] **Validación (zod)**: se cierra sin ADR propio — el ADR 0004 §3 ya fija zod en el borde (forma) + invariantes dentro del caso de uso, y la estrategia de testing lo convierte en contrato testable (tests de puerta del contrato zod). Cualquier detalle operativo adicional se resolverá en la spec de API v1.

**Nota**: el ADR 0004 precisa la spec de tokens (§5): los scopes se declaran **por acción expuesta**, no solo por endpoint HTTP — la spec `2026-10-25-token-model.md` quedó actualizada en consecuencia.