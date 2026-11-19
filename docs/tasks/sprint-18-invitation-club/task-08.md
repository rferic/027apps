---
id: sprint-18-task-08
titulo: "App: pantalla de invitación"
area: app
estado: pendiente
plan: docs/superpowers/plans/2026-11-18-invitation-club.md
fuente: docs/superpowers/specs/2026-11-18-invitation-club-design.md
adrs: [0004, 0007]
---

**Tarea**: que un miembro invite desde el móvil con QR o enlace y pida plazas al administrador.

**Alcance**

- `InviteMembersScreen`: barra de cuota, QR rotativo (reutiliza `ui/migration/QrCode.kt`,
  `FLAG_SECURE`, 90 s con autorrenovación), enlace copiable, invitados directos, revocar y solicitar.
- DTO y métodos de `ApiClient`; estado en `AppViewModel`/`AppState`; entrada desde Inicio (tarjeta
  del club) y desde Ajustes (fila «Invitaciones»).
- Subida a `0.20.0` (2000) y entrada de `Changelog` en los 9 locales.

**Aceptación**

- Con 0 plazas no se ofrece QR ni enlace; se ofrece solicitar.
- La barra coincide con «usadas + reservadas / base + concedidas».
- `cd apps/android && ./gradlew :app:testDebugUnitTest` y `:app:assembleDebug` en verde, incluido
  `ChangelogTest`.

**Plan**: Task 8.
