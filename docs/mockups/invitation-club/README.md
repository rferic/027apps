# Mockup — Invitaciones de club

Pantallas del sprint 18 antes de escribir UI. Un solo HTML autocontenido (`index.html`), sin CDN ni
dependencias, con los tokens de `apps/admin/tokens.json` en claro y oscuro.

## Cómo verlo

```bash
open docs/mockups/invitation-club/index.html
```

El botón **Tema** alterna claro/oscuro. Las anclas de la barra superior saltan a **App**, **Web**,
**Panel** y **Decisiones**. Hay dos capturas de página completa para revisión rápida:
`preview-full-light.png` y `preview-full-dark.png`.

## Qué cubre

| Área | Pantalla | Estados |
|---|---|---|
| App | Inicio | tarjeta del club con plazas, 0 plazas, solicitud pendiente |
| App | Ajustes | fila «Invitaciones» siempre visible, con barra de cuota |
| App | Invitaciones | con plazas, sin plazas, cargando, sin conexión, 429, invitados, enlace pendiente |
| App | Mostrar QR | cuenta atrás 90 s, renovación, aviso de pantalla protegida |
| App | Sin plazas / solicitud | formulario, pendiente, aprobada, rechazada, cancelada |
| App | Canje anónimo | nombre, email y contraseña; variante «ya tienes cuenta» en web |
| App | Revocar | confirmación |
| App | Solicitudes (admin) | lista de solo lectura y paso al panel |
| Web | `/join/[code]` | pendiente, caducado, usado, club lleno |
| Web | `/invite/[token]` | anónima y cuenta existente |
| Panel | Ajustes → Invitaciones | 3 niveles, añadir/quitar, total estimado |
| Panel | Solicitudes | pendientes primero, aprobar con cantidad, rechazar, vacío |
| Panel | Miembros → ficha | nivel, base + concedidas, usadas/reservadas, concesiones |
| Panel | Miembros → árbol | subárbol y huérfanos por purga |
| Panel | Invitaciones | origen admin/member/qr, anónima, acciones por origen |
| Panel | Módulos → ficha | interruptor `delegable` |

## Decisiones que fija

- **Dos puertas y una sola invitación.** El QR vive 90 s y acuña una invitación de 15 min; el
  enlace compartible dura 48 h. La cuota se gasta al canjear.
- **El QR no se canjea en el GET.** `/join/[code]` pinta y el botón «Continuar» hace el POST, para
  que un prefetch de WhatsApp no gaste el código. Un segundo canje dice «ya se usó».
- **La cuota es ocupación viva.** «Usadas + reservadas / base + concedidas». Desactivar ocupa,
  purgar libera y una pendiente reserva.
- **La solicitud no cambia el nivel.** Suma plazas permanentes y revocables a esa persona.
- **El panel no usa realtime.** El contador de Solicitudes se refresca por polling.
- **La app no aprueba.** Lista y abre el panel; la gestión es del panel.
- **El push es genérico.** «Nueva solicitud de invitación», sin importes ni nombres.
- **La app muestra el árbol solo al administrador.** El miembro ve sus invitados directos.

## Copy y jerarquía

- La acción primaria de la pantalla de invitación es **Mostrar QR**; la secundaria, **Crear enlace**.
- La barra de cuota y el estado («Sin plazas») van juntos: nunca se ofrece un botón que el servidor
  va a rechazar.
- Los estados de invitación y solicitud llevan texto además de color (`Pendiente`, `Usada`,
  `Revocada`, `Aprobada`, `Rechazada`).
- Los importes no aparecen en los avisos de invitación; el detalle está al abrir.

## Tokens y accesibilidad

- Colores solo desde los tokens de `apps/admin/tokens.json`; el HTML declara los mismos valores en
  `:root` y `[data-theme="dark"]`.
- Contraste AA en texto y controles; foco visible con `:focus-visible`.
- Los botones deshabilitados se distinguen por opacidad y por texto, no solo por color.
- El QR es un patrón de maqueta (no legible); la pantalla real usa ZXing con `FLAG_SECURE`.

## Fuera

- Login, shell de módulos y el canje existente del sprint 16, salvo sus variantes nuevas.
- Descarga del APK, wizard de la app y push en iOS.
- Aprobación de solicitudes desde la app.
- Capturas reales de datos de la familia; todos los nombres son de ejemplo.

## Puerta P2

Ninguna tarea de UI (6–9) empieza hasta que el propietario apruebe este mockup por escrito. Si un
cambio del mockup altera un flujo, se actualiza la spec antes de implementarlo.
