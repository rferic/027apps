---
id: sprint-web-task-04
titulo: "Settings batch write para evitar rate limiting"
area: web
estado: finalizada
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

## Informe de auditoría (2026-11-06)

**QA + OWASP (`ingeniero`) — APROBABLE CON CAMBIOS, sin críticos.**

- *Alto, corregido (pre-existente, en la ruta que reutiliza el lote)*: `isEnabled` del puerto de monedas descartaba el cliente transaccional y consultaba con `pool` (max 5). Durante la coherencia de una escritura se retenía un cliente y se pedía otro; con 5 escrituras concurrentes el pool se agotaba y caía toda la API. Ahora usa `client ?? pool`, así que la coherencia corre dentro de la misma transacción.
- *Medio, corregido*: `JSON.parse` sin `try/catch` en el esquema de `notifications.push.fcm_service_account`. Un JSON truncado lanzaba fuera de `safeParse` y el mensaje de Node filtraba un fragmento del secreto a logs y Sentry, además de responder 500. Ahora devuelve `validation_failed` con `details.key`.
- *Medio, corregido*: el cifrado del secreto ocurría dentro del bucle de escrituras; sin `withTransaction` un lote `[instance.name, fcm_service_account]` dejaba la primera clave escrita. Ahora los secretos se cifran antes del primer `UPDATE`.
- *Medio, corregido*: la atomicidad no se probaba de verdad (el doble no simulaba rollback y el test de "none applied" solo cubría el fallo previo a la transacción). Añadidos tests de fallo a mitad de lote, de fallo de cifrado antes de escribir y de JSON inválido.
- *Bajo, corregido*: objetos de `updates` sin `.strict()`; `writeSetting` podía devolver `undefined` si faltaba la fila.
- *Bajo, pendiente con motivo*: la coherencia lanza `validation_failed` sin `details.key`, así que un fallo de regla cruzada (p. ej. `provider=fcm` sin todas las claves) muestra el mensaje genérico. Requiere que las reglas del catálogo identifiquen la clave culpable: fuera del alcance de este cambio.
- *Bajo, pendiente con motivo*: el detalle del error embebe el mensaje canónico del servidor sin traducir (`Details: Validation failed`). Mapear código a texto traducido exige un catálogo de códigos: mejora posterior.
- *Bajo, pendiente con motivo*: `rate_limit.write_per_min` sigue sembrado a 10 en `catalog.ts` y en la migración `0002_settings.sql` mientras el límite efectivo es 30. No se edita una migración ya aplicada; se resolverá cuando el límite sea configurable.
- *Bajo, reconocido*: `db-tests` depende del estado de la instancia local (asume `localization.default_currency` sembrada); es un problema de aislamiento pre-existente de la suite, no de este cambio.
- Verificado sin hallazgo: autorización por clave antes de la transacción (`superAdminOnly` y `readOnly` siguen rechazados), SQL parametrizado, `KEY_PATTERN` en el borde, límite de 30 y duplicados, cifrado con la clave como AAD y sin plaintext en respuestas, envelope de errores sin stack, y contrato intacto de la ruta individual.

**Gates finales**: `pnpm lint`, `pnpm tsc`, `pnpm test` (26 i18n + 121 core + 106 admin + 94 db-tests), `pnpm i18n:check` y `pnpm --filter admin build`, en verde.