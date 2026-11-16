---
id: sprint-16-task-09
titulo: Renovación A3 y cierre de coherencia A3–A7
area: core + web + app
estado: pendiente
plan: docs/superpowers/plans/2026-11-16-invitation-session-migration.md
fuente: docs/superpowers/specs/2026-11-16-invitation-session-migration-design.md
adrs: [0002, 0004, 0007, 0008]
---

**Tarea**: permitir renovar una invitación caducada desde el panel y cerrar la coherencia de A4
(marca/instancia), A5 (paridad), A6 (rol) y A7 (cuenta existente) en email, web y app.

**Punto de partida**
- `renewInvitation` y su ruta llegan en la tarea 04; aquí se cablea el panel.
- A4/A5/A6/A7 se implementan en las tareas 04/06/07; esta tarea los revisa como un solo flujo y
  corrige lo que falte.

**Alcance**
- Dentro:
  - `POST /api/v1/invitations/{id}/renew` + operación OpenAPI (si no se cerró en 04).
  - Detalle de invitación: «Renovar» solo si caducada, confirmación, token una vez con Copy/Done,
    estado del email; la lista sigue en `pending`.
  - Revisión A4: wordmark/icono + `instance.name` + invitador + caducidad + rol en email, web y
    app; sin logo configurable.
  - Revisión A5: mismos estados y textos, nombre bloqueado, confirmación en app y web.
  - Revisión A6: guardrails de rol en API/panel, nunca `super_admin`; `role` visible.
  - Revisión A7: cuenta existente conserva rol/nombre/contraseña; el panel lo explica.
  - Capturas de contraste en claro/oscuro (web 375 px, app 390 px).
  - Tests de regresión de los cuatro puntos.
- Fuera: cambiar el modelo de rol; promocionar automáticamente una cuenta existente; el QR (10).

**Dependencias**: 04, 06 y 07. La 09 no empieza hasta que esos formularios estén estables.

**Riesgos**: que la renovación invalide un enlace que alguien está usando (confirmación y aviso);
que el token nuevo se pierda si el email falla (se muestra una vez); que la coherencia A4 se
confunda con un rediseño (solo nombre/wordmark); que A5 duplique copy en vez de compartir estados.

**Criterios de aceptación**
- Una invitación caducada se renueva, el enlace viejo deja de valer, el nuevo llega por email (o se
  copia si falla) y vuelve a `pending`.
- No se renueva una usada/revocada; el cooldown de 60 s se respeta.
- A4/A5/A6/A7 verificados con una lista de comprobación pegada en la tarea.
- Las tres superficies muestran el mismo nombre de instancia y los mismos estados.
- `pnpm --filter admin build`, `pnpm check:openapi`, `pnpm i18n:check` en verde.
- La UI corresponde con el mockup aprobado.

**Puertas de usuario**
- Confirmar D6, D10 y D16.
- Aceptar la pantalla de renovación en el preview.
- Aceptar las capturas de coherencia.

**Auditoría de seguridad**: obligatoria antes de `finalizada` (A01, A03, A04, A07): renovación solo
por admin, token rotado, cooldown y sin filtrar el token en logs.
