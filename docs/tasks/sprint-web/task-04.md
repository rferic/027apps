---
id: sprint-web-task-04
titulo: "Settings batch write para evitar rate limiting"
area: web
estado: en curso
adrs: [0007]
plan: docs/superpowers/plans/2026-11-06-settings-batch-write.md
spec: docs/superpowers/specs/2026-11-06-settings-batch-write-design.md
---

**Alcance**: implementación de escritura por lotes de settings y aumento del límite de rate limiting de 10 a 30 requests/minuto para resolver el bug del wizard de instalación con FCM.

**TDD**: implementación de `writeSettings` en core con validaciones previas y transacción atómica; nueva ruta `PATCH /api/v1/settings`; actualización del admin para usar lotes; cambio del cliente wizard a una sola llamada; tests unitarios, integración y de cliente cubriendo atomicidad, errores de validación y regresión.

**DoD**: tests primero (rojo → verde → refactor), `pnpm lint`, `pnpm tsc`, `pnpm test`, builds afectados en verde, auditorías QA/OWASP y estilo antes de `finalizada`, actualización de la spec de API del core con la nueva ruta.

## Informe de auditoría (pendiente)

**QA + OWASP (`ingeniero`) — PENDIENTE**

- Verificar rate limiting de 30/min en ambas rutas
- Verificar atomicidad: no hay escrituras parciales en caso de error
- Verificar manejo de errores con `details.key` para señalización de campos
- Verificar compatibilidad con la ruta individual existente

**Estilo (`cocinero`) — PENDIENTE**

- Verificar código en inglés, sin `any`, sin código muerto
- Verificar convenciones de naming y uso de tokens semánticos
- Verificar formato JSON y Conventional Commits

**Gates finales**: `pnpm lint`, `pnpm tsc`, `pnpm test` (core + db-tests + admin), `pnpm --filter admin build`, todos en verde.