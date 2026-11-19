---
id: sprint-18-task-09
titulo: "App: push y deep links"
area: app
estado: finalizada
plan: docs/superpowers/plans/2026-11-18-invitation-club.md
fuente: docs/superpowers/specs/2026-11-18-invitation-club-design.md
adrs: [0007, 0009]
---

**Tarea**: que el administrador reciba el aviso de una solicitud y que el QR abra la app.

**Alcance**

- `PushText` reconoce `push.invitation_requested` y `push.invitation_request_resolved` con dos
  textos fijos localizados (9 idiomas), sin importes ni nombres; el camino de `owe-no` no cambia.
- App Link `/join/` en `AndroidManifest.xml` y parseo en `MainActivity`/`AppRoot`.
- La push de solicitud abre la sección de solicitudes; el invitado que escanea un QR entra por
  `/join/<code>`.

**Aceptación**

- Un push de gasto sigue pintando importe y descripción (regresión).
- El push de solicitud no muestra «0,02 €» ni el nombre de quien pide.
- `cd apps/android && ./gradlew :app:testDebugUnitTest` en verde, incluido `PushTextTest`.

**Plan**: Task 9.
