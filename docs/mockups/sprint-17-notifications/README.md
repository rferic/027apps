# Mockup · Ajustes → Notificaciones (sprint 17, tarea 02)

Pantalla de preferencias de notificación, **antes de escribir la UI**. Es la puerta **P3** del
sprint: sin esta pantalla aprobada no empieza la tarea 02.

**Aprobado por el propietario el 2026-11-23.** La UI puede empezar.

- `index.html` — autocontenido (sin CDN), tokens de `apps/admin/tokens.json`, tema claro y oscuro
  con un botón. Cinco estados en marcos de móvil de 390 px.
- Logo real de OweNo: `packages/owe-no/assets/icon.svg`, incrustado.
- Datos de ejemplo; nada real.

## Estados

| # | Estado | Qué enseña |
|---|---|---|
| 1 | Todo encendido, módulo cerrado | La jerarquía: maestro, generales, módulos |
| 2 | Módulo abierto y a medias | «1 de 2» en la cabecera; el switch del módulo sigue encendido |
| 3 | Maestro apagado | Todo en gris y sin efecto; las casillas se recuerdan |
| 4 | Permiso de Android denegado | Maestro apagado y bloqueado, con salida para volver a pedirlo |
| 5 | Registro de push fallando | Aviso y «Reintentar»; no finge que está listo |

## Decisiones que fija

- **Maestro** por móvil: «Recibir notificaciones en este móvil».
- **Generales** sin logo (no son de un módulo): solicitudes de plazas y respuestas a mis solicitudes.
- **Módulos** en desplegable, con logo, nombre y switch que marca o desmarca todas sus casillas.
  OweNo es el único que envía avisos hoy; los que no envían no aparecen.
- Un módulo a medias dice **«1 de 2»**; el switch no finge.
- Tocar la **fila** abre o cierra; tocar el **switch** no despliega.
- Con el permiso del sistema denegado, nunca se muestra «Listo».

## Fuera de alcance

- Preferencias por cuenta (todos los móviles) o por grupo de OweNo.
- Avisos de módulos que hoy no envían nada.
- Centro de notificaciones o historial.

## Cómo verlo

Abre `index.html` en el navegador. Para verlo desde el móvil, sírvelo en la red local y abre la
dirección del ordenador desde el teléfono:

```bash
python3 -m http.server 8099 --bind 0.0.0.0 --directory docs/mockups/sprint-17-notifications
```

El móvil y el ordenador tienen que estar en la misma Wi-Fi. El botón del tema alterna claro y
oscuro.
