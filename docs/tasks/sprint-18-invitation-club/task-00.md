---
id: sprint-18-task-00
titulo: Mockups de todas las pantallas (puerta P2)
area: diseño
estado: finalizada
plan: docs/superpowers/plans/2026-11-18-invitation-club.md
fuente: docs/superpowers/specs/2026-11-18-invitation-club-design.md
adrs: []
---

**Entregado 2026-11-18**: `docs/mockups/invitation-club/index.html`, `README.md` y capturas
`preview-full-light.png` / `preview-full-dark.png`.
**Aprobado P2 2026-11-19** al ordenar el inicio del sprint; incluye la entrada desde Inicio y
Ajustes con la barra de cuota.

**Tarea**: que el propietario recorra y apruebe todas las pantallas del club —app, web pública y
panel— antes de escribir UI.

**Alcance**

- `docs/mockups/invitation-club/index.html` autocontenido: móvil 390 px, web pública y panel
  1100 px, claro y oscuro, tokens de `apps/admin/tokens.json`.
- App: invitaciones, QR rotativo, crear enlace, sin plazas, solicitud (pendiente/aprobada/
  rechazada), canje anónimo, revocar, solicitudes de administrador de solo lectura, y las dos
  entradas (tarjeta del club en Inicio y fila en Ajustes).
- Web: `/join/[code]` (pendiente, caducado, usado, lleno) y `/invite/[token]` (anónima y cuenta
  existente).
- Panel: ajustes de niveles, solicitudes, ficha del miembro, árbol, listado de invitaciones y
  `delegable` de un módulo.
- `README.md` con la tabla de pantallas/estados, copy, contraste y lo que queda fuera.
- Capturas `preview-*.png` de las superficies principales.

**Aceptación**

- **P2**: el propietario recorre el HTML y aprueba por escrito (o pide cambios que se aplican antes
  de la UI).
- No hay colores fuera de tokens; el copy está en español y los estados se distinguen sin color.
- Ninguna tarea de UI (6–9) empieza sin esta aprobación.

**Plan**: Task 0.
