---
id: sprint-19-todo
titulo: Módulo Tareas — post-its por grupo, solicitudes y power
area: producto
estado: aprobada 2026-11-27 · plan pendiente de aprobación
spec: docs/superpowers/specs/2026-11-27-todo.md
plan: docs/superpowers/plans/2026-11-27-todo.md
mockup: docs/mockups/todo/index.html
estado_modulo: docs/tasks/sprint-19-todo/state.md
---

# Sprint 19 — Módulo NotNow

Segundo módulo de la plataforma. Un post-it dentro de un grupo: está pendiente o hecho, se crea
libre o puesto a alguien, y el grupo puede activar **power** para repartir puntos por temporadas.
No es un kanban.

**Referencia funcional:** `~/Sites/027apps-legacy/apps/todo` (lo reutilizable y lo descartado está
en `state.md` §2). **Identidad:** `todo` / «Tareas» / indigo, logo *lista con checks*.

## Decisiones cerradas (propietario, 2026-11-27)

- Grupos propios creados por los usuarios; cada usuario tiene su carpeta personal sin miembros y
  sin power. Power **por grupo y aislado**; el de un grupo no toca el de otro.
- Una sola persona por tarea. **Sin privilegios de creador:** libre la edita cualquiera del grupo;
  asignada, solo su dueño, que además es el único que la completa.
- Pedir una tarea ajena = solicitud con **botones en el push** y bandeja en la app; caduca a
  **24 h**; decide el dueño actual.
- Recurrencia: la **misma** tarea se reinicia, con historial por periodo.
- Power opcional: infinito (cierre manual) o temporada semanal/mensual/anual; al cerrar, ranking
  con puntos y tareas hechas, archivo y reset. **Contador, no libro de puntos.**
- Deshacer resta puntos (solo en la temporada abierta); una tarea hecha no se borra.
- Avisos: creación, asignación, devolución, vencimiento, completar (**al grupo**), solicitud y
  resolución. Nunca al actor. **Cuatro tipos** silenciables por móvil en el Core.

## Tareas

| # | Tarea | Área | Entregable | Depende |
|---|---|---|---|---|
| 01 | Contrato, paquete y base de datos | sql + core | manifest válido, DDL `up`/`down`, RLS, instalación limpia | — |
| 02 | Dominio: grupos, miembros y carpeta personal | core | `groups.ts` + matriz de permisos | 01 |
| 03 | Dominio: tareas | core | `tasks.ts` (crear, editar, borrar, coger, soltar, completar) | 02 |
| 04 | Dominio: recurrencia y ocurrencias | core | `recurrence.ts` (periodos, historial, cierre) | 03 |
| 05 | Dominio: solicitudes, completar y deshacer | core | `requests.ts` + deshacer con resta | 03 |
| 06 | Dominio: power, temporadas y job | core + sql | `power.ts`, `job_hourly`, resultados archivados | 04, 05 |
| 07 | API `/api/v1/todo` | web | 25 endpoints con zod, scopes, idempotencia y rate limits | 06 |
| 08 | Eventos, avisos y push con acciones | core + app | 10 eventos, 4 tipos de aviso, botones en la notificación | 06 |
| 09 | Panel | web | `/panel/todo` y `/panel/todo/categories` | 07 |
| 10 | App Android | app | módulo, grupo, detalle, bandeja, power y resultados | 07, 08 |
| 11 | Widgets, demo, i18n y documentación | core + docs | widgets, `seed_demo`, 9 locales, docs por capacidad | 06 |
| 12 | Landing, auditoría y cierre | docs + web + app | fichas públicas, auditoría OWASP, PR | 09, 10, 11 |

Orden de ejecución: **01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 11 → 12**, con 08, 09 y
11 paralelizables tras 06.

## Puertas

- [ ] Plan aprobado.
- [ ] UI aceptada en staging (APK de debug).
- [ ] Aceptación del resultado y orden de merge del PR del sprint.
