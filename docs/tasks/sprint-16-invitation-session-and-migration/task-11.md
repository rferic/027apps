---
id: sprint-16-task-11
titulo: Cierre — i18n, docs, gates, auditoría y verificación real
area: docs + infra
estado: pendiente
plan: docs/superpowers/plans/2026-11-16-invitation-session-migration.md
fuente: docs/superpowers/specs/2026-11-16-invitation-session-migration-design.md
adrs: [0002, 0004, 0007, 0008, 0010]
---

**Tarea**: cerrar el sprint con todo verificado y auditable: i18n completo, flujos actualizados,
gates mecánicos, evidencia real y auditoría de seguridad. Sin esto ninguna tarea pasa a
`finalizada`.

**Punto de partida**: las tareas 03–10 implementadas y aceptadas por sus criterios.

**Alcance**
- Dentro:
  - `docs/flows/invitations.md` (ciclo completo: preview, app-first, web, existente, rol,
    renovación, estados) y `docs/flows/password-recovery.md`.
  - `docs/flows/cicd.md`: App Links y `/migrate/`; `docs/flows/pre-delivery-verification.md` y
    `scripts/verify-local.sh` si hay rutas nuevas.
  - `docs/ai/landing.md` y landing solo si cambia el copy público; si no, constancia.
  - `pnpm lint && pnpm tsc && pnpm test && pnpm i18n:check && pnpm check:openapi` y
    `pnpm --filter admin build`.
  - `pnpm --filter db-tests test` sobre Supabase local limpio.
  - `cd apps/android && ./gradlew :app:testDebugUnitTest :app:assembleDebug`.
  - `scripts/verify-local.sh` con sesión real y las rutas nuevas.
  - CI del PR: `admin`, `android`, `supabase`, `guard-secrets`, `commitlint`, `ai-docs`.
  - Verificación real de la checklist de pre-entrega (suites, build, rutas, endpoints, APK,
    navegador con `lerd diag browser_toggle` + `request lenses`).
  - Auditoría OWASP A01–A11 por un agente distinto del autor, con la checklist
    `docs/conventions/security-checklist.md` (incluye A11 Android); informe con hallazgos,
    severidad y resolución.
  - Revisión/QA y estilo por agentes distintos del autor.
  - Actualizar `estado` de las tareas; PR con la evidencia.
- Fuera: merge sin orden; promoción sin orden; cambiar el alcance del sprint 17.

**Dependencias**: todas.

**Riesgos**: que un gate de CI no se pueda reproducir en local (pegar la salida de `gh pr checks`);
que `db-tests` contra la instancia del propietario falle por datos (usar una base limpia); que la
auditoría encuentre un crítico y haya que parar (se corrige con test de regresión); que la landing
se toque sin necesidad (solo si cambia el copy).

**Criterios de aceptación**
- Todos los comandos de la spec §11.5 en verde, con la salida pegada.
- Rutas y endpoints nuevos verificados con sesión real; sin errores en `request lenses`.
- APK instalado y recorrido; App Links y QR verificados en dispositivos reales.
- Recuperación con email real; sesión (reinicio, avión, actualización, logout web/móvil,
  desactivación, borrado, revocación) verificada.
- Auditoría de seguridad sin hallazgos críticos/altos abiertos; el resto con motivo escrito.
- Informe de revisión/QA/estilo con hallazgos corregidos o rechazados con motivo.
- PR draft contra `staging` con el resumen, los gates del propietario y la evidencia; sin merge.

**Puertas de usuario**
- Aprobar la evidencia y dar la orden de merge (P7) y de promoción (P8).
- Revisar el resumen de seguridad.

**Auditoría de seguridad**: es el cierre de la auditoría incondicional del sprint (A01–A11); se
ejecuta aquí si no se hizo por tarea, y siempre antes de `finalizada`.
