---
id: sprint-19-task-08
titulo: Eventos, avisos y push con acciones
area: core + app
estado: pendiente
plan: docs/superpowers/plans/2026-11-27-todo.md
spec: docs/superpowers/specs/2026-11-27-todo.md
fuente: docs/tasks/sprint-19-todo/README.md
---

**Objetivo:** Los diez eventos con su destino, los cuatro tipos de aviso en el catálogo del Core y los botones Aceptar/Denegar de la notificación.

**Ficheros:** `packages/core/src/notifications/catalog.ts` (+ test) · `PushMessagingService.kt`, `PushText.kt`, `res/values*/strings.xml`

**Hecho cuando:** Cada aviso llega a quien toca y nunca al actor; el silenciado por tipo funciona; la solicitud se resuelve desde la notificación.
