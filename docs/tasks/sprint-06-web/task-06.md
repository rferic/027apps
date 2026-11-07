---
id: sprint-06-task-06
titulo: Dashboard con datos reales
area: web
estado: finalizada
adrs: [0004, 0005, 0007]
plan: docs/superpowers/plans/2026-11-06-web-admin.md
spec: docs/superpowers/specs/2026-11-06-web-admin-design.md
---

**Alcance**: salud, KPIs, banners y tarjetas de módulos compuestos por rol en servidor; sin actividad reciente (`/admin-actions` no existe).

**TDD**: ok/degraded, composición por rol, error con `request_id`, KPIs a 0.

**DoD**: igual.

## Informe de auditoría (2026-11-06)

**Veredicto**: cambios menores, sin hallazgos críticos. Se corrigieron los
siguientes:

- **M1 — KPI de miembros activos**: `GET /api/v1/users` calcula ahora
  `active_total` en la misma consulta del total
  (`count(*) filter (where p.deactivated_at is null)`), y el dashboard usa ese
  agregado en vez de contar la página (capiada a 100). Con más de 100 perfiles
  el KPI ya no miente. Cubierto con un test de `packages/db-tests` (2 activos +
  1 desactivado) y con un test del dashboard donde la página y `active_total`
  no coinciden.
- **M2 — tests del TDD**: la página cubre a la vez `setupIncomplete` y
  `health.degraded` (el `h1` sigue siendo "Setup is incomplete." y el banner de
  degradado permanece visible); los cuatro KPIs del fixture tienen valores
  distintos. El dashboard prueba de forma parametrizada un 500 y una forma
  inválida para cada una de las cuatro rutas autenticadas, además del fallo de
  `computeHealth` y de `readInstanceState`.
- **B1/B2 — correlación de errores**: una respuesta 2xx con forma inválida
  conserva el `x-request-id` de la cabecera en `DashboardFailure`; si fallan
  varias fuentes se devuelve la primera que aporta `request_id`. Los `catch` de
  `readHealth`/`readSetupIncomplete` ya no se silencian: registran la línea de
  error por `deps.logger` con correlación (`requestId`, `route`, `code`) y sin
  texto de error, cuerpos ni datos personales.
- **B3 — i18n del código desconocido**: `errorCodeLabel` traduce
  `Unexpected error: {code}` en vez de pintar el código crudo y añade
  `unauthorized` → "Your session has expired. Sign in again.".
- **B4 — jerarquía**: el estado de error tiene `<h1>` (el título visible del
  bloque de error).
- **B5 — vacío de módulos**: incluye el enlace "Install a module" a
  `/modules`.
- **B6 — vacío global**: solo se muestra cuando no hay miembros, ni
  invitaciones pendientes, ni categorías, ni módulos. Un test cubre que una
  invitación o categoría existente mantiene los KPIs.
- **B7 — agregados**: `total`/`active_total` no numéricos invalidan la
  respuesta (error), sin sustituirlos por el tamaño de página.
- **B8 — estados de módulo**: un estado desconocido se muestra como "Unknown",
  nunca como "Installed".

**Desviaciones aceptadas con motivo**:

- **`computeHealth`/`readInstanceState` en vez de `/health` y `/instance`**:
  ambas son lecturas de servicio, no datos de negocio. Llamar a las rutas
  públicas en proceso compartiría su cubo de rate-limit por IP
  (`ip:unknown`) con clientes anónimos reales y podría devolver 429 al panel
  tras unos cuantos refrescos.
- **Lectura server-only sin SWR**: el dashboard es un Server Component de solo
  lectura; la llamada en proceso mantiene el patrón de `/modules`. ADR 0005
  (SWR) aplica a las páginas interactivas 07–09.
- **`/maintenance/status` diferido**: no forma parte del alcance de esta tarea;
  se incorporará cuando exista el flujo de mantenimiento.
