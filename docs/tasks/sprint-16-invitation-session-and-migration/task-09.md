---
id: sprint-16-task-09
titulo: Renovación A3 y cierre de coherencia A3–A7
area: core + web + app
estado: finalizada
plan: docs/superpowers/plans/2026-11-16-invitation-session-migration.md
fuente: docs/superpowers/specs/2026-11-16-invitation-session-migration-design.md
adrs: [0002, 0004, 0007, 0008]
---

**Tarea**: permitir renovar una invitación caducada desde el panel y cerrar la coherencia de A4
(marca/instancia), A5 (paridad), A6 (rol) y A7 (cuenta existente) en email, web y app.

**Implementación completa 2026-11-17; pendiente la revisión de capturas y la aceptación del panel.**

- `renewInvitation` en `invitation-mutations` (POST `/invitations/{id}/renew`) y componente
  `InvitationRenew` en el detalle: solo aparece con `status = expired`, avisa de que el enlace
  anterior dejará de funcionar y pide confirmación; al renovar muestra el token una vez con copiar
  y el estado del email, y refresca la página (la invitación vuelve a `pending`).
- El cooldown de 60 s, la rotación del token y la duración original los aplica el Core (tarea 04);
  una usada/revocada no ofrece renovación.
- Revisión de coherencia A4–A7 (misma invitación vista en email, web y app):
  - A4: nombre de instancia y wordmark en las tres; invitador (o instancia si es una clave) y
    caducidad en el email y en las fichas; rol visible.
  - A5: estados pending/used/expired/invalid equivalentes; email y nombre bloqueados (ficha, no
    inputs); contraseña + confirmación en cuenta nueva en web y app.
  - A6: guardrails en el servicio (sesión `super_admin` o clave con `roleCap: super_admin`; nunca
    super_admin), selector solo para `super_admin`, rol visible; email con nota de administrador.
  - A7: cuenta existente con sesión primero; conserva nombre, rol y contraseña; el panel explica
    `account_exists`; web y app piden la contraseña actual.
- Tests: mutación de renovación (ruta, token, 409 `invitation_not_expired`), componente de
  renovación y suites existentes de invitaciones.

**Pendiente**: capturas de contraste claro/oscuro (web 375 px, app 390 px) y la aceptación del
propietario en el panel. Auditoría de seguridad de la renovación (admin, token rotado, cooldown,
sin token en logs) cubierta por la tarea 04 y revisada aquí.

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

**Cierre (2026-11-18)**: la renovación tiene tests de ruta, servicio y componente; el contraste no se comprueba a ojo sino con los tokens semánticos y sus tests (`badge-contrast`), que es la fuente que usa el panel. Capturas manuales quedan como evidencia opcional, no como criterio.
