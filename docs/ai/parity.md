# Matriz de paridad móvil

Estado de cada capacidad en Android e iOS. La fuente de verdad del comportamiento es
`spec/mobile/`; esta tabla dice **qué existe en cada app** y qué divergencias están aceptadas.

Se rellena auditando la app real en el commit del baseline (ver
[spec iOS](../superpowers/specs/2026-11-21-ios-app.md) §12), no de memoria. `pnpm check:parity` falla
si una fila `android: hecho` no tiene `ios: hecho` ni un motivo declarado en `divergencia`.

Estados: `hecho` · `en curso` · `pendiente` · `n/a` (no aplica a esa plataforma).

## Shell y cuenta

| ID | Capacidad | Android | iOS | Divergencia / nota |
|---|---|---|---|---|
| `shell.instance` | Instancia por defecto y cambio en Ajustes, con validación estricta de URL | hecho | pendiente | iOS: ATS limita HTTP a hosts privados |
| `shell.login` | Login Supabase, recuperación de contraseña, sesión persistente | hecho | pendiente | Keychain en iOS |
| `shell.session-refresh` | Reintento único tras 401 y fin de sesión explicado | hecho | pendiente | Escenarios `session-refresh.yaml` |
| `shell.navigation` | Arranque, home, módulos, ajustes, atrás | hecho | pendiente | |
| `shell.privacy` | Ojo de importes, recordado entre arranques | hecho | pendiente | Incluye widget y push |
| `shell.i18n` | 9 idiomas, cambio sin reiniciar, fallback a inglés | hecho | pendiente | Textos generados |
| `shell.theme` | Tokens claro/oscuro | hecho | pendiente | Tokens generados |
| `shell.changelog` | Changelog en Ajustes | hecho | pendiente | Generado desde la fuente Android |
| `shell.updates` | Aviso de versión nueva | hecho | pendiente | **Divergencia**: Android auto-instala; iOS informa y enlaza a TestFlight |

## Módulos y perfil

| ID | Capacidad | Android | iOS | Divergencia / nota |
|---|---|---|---|---|
| `account.profile` | Perfil, nombre, idioma, moneda | hecho | pendiente | |
| `modules.list` | Lista de módulos del dashboard | hecho | pendiente | |
| `modules.icon` | Icono de módulo con sesión | hecho | pendiente | |
| `modules.widgets` | Widgets del módulo en home | hecho | pendiente | |

## Invitaciones

| ID | Capacidad | Android | iOS | Divergencia / nota |
|---|---|---|---|---|
| `invites.link` | Enlace compartible y QR de invitación | hecho | pendiente | |
| `invites.qr` | QR rotativo con caducidad | hecho | pendiente | AVFoundation/Vision |
| `invites.members` | Cuota, invitados directos, solicitud al administrador | hecho | pendiente | |
| `invites.requests` | Lista de solicitudes pendientes (administrador) | hecho | pendiente | |
| `invites.redeem` | Canje de invitación por enlace/QR | hecho | pendiente | |
| `invites.deep-link` | Abrir la invitación desde el enlace o el QR | hecho | pendiente | Universal Links + scheme de reserva |

## Traspaso de dispositivo

| ID | Capacidad | Android | iOS | Divergencia / nota |
|---|---|---|---|---|
| `migration.transfer` | Traspaso de sesión de un móvil a otro por QR | hecho | pendiente | Mismo protocolo de `device-transfers` |
| `migration.deep-link` | Abrir el traspaso desde el enlace | hecho | pendiente | |

## OweNo

| ID | Capacidad | Android | iOS | Divergencia / nota |
|---|---|---|---|---|
| `owe.summary` | Grupos, saldos y resumen | hecho | pendiente | |
| `owe.group` | Detalle de grupo: movimientos, miembros, categorías | hecho | pendiente | |
| `owe.movement` | Crear, editar y borrar movimiento | hecho | pendiente | |
| `owe.split` | Reparto igual y exacto, con previsualización | hecho | pendiente | Escenarios `owe-equal-share.yaml` |
| `owe.format` | Importes, fechas y moneda según el perfil | hecho | pendiente | Escenarios `owe-format.yaml` |
| `owe.settlement` | Liquidación del grupo | hecho | pendiente | Calculada en el Core |
| `owe.import` | Importación de CSV: identidades, mapeo, previsualización | hecho | pendiente | |
| `owe.widget` | Widget de saldo | hecho | pendiente | **Divergencia**: WidgetKit refresca cuando el sistema quiere |

## Notificaciones

| ID | Capacidad | Android | iOS | Divergencia / nota |
|---|---|---|---|---|
| `push.receive` | Push de gasto con importe y privacidad | hecho | pendiente | APNs vía FCM |
| `push.invitations` | Push de solicitud y de decisión, localizado | hecho | pendiente | Extensión de servicio en iOS |
| `push.deep-link` | Tocar la push abre la pantalla correcta | hecho | pendiente | |

## Pendiente de rellenar

Las filas se confirman en el arranque auditando la app con `apps/android` en el commit del baseline.
Cualquier capacidad que aparezca ahí y no esté en esta tabla se añade antes de empezar la fase 4.
