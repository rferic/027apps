# Qué queda por revisar

Checklist de aceptación del sprint 16. Lo que ya está verificado no se repite; lo que queda dice
**quién** lo desbloquea (tú, un móvil real, o un merge). Los criterios completos de cada tarea están
en su fichero `task-NN.md`.

## Ya verificado (no hace falta repetirlo)

- Invitación app-first en escritorio y en emulador: cuenta nueva → `/welcome`, admin → `/panel`,
  cuenta existente con contraseña, rol conservado. Datos bloqueados en ficha, no inputs.
- Sesión en la app: sobrevive reinicio, cierre y modo avión; una revocación desde el panel se nota
  con la app abierta y lleva al login con aviso; el logout local no cierra el resto.
- Recuperación de contraseña en local (Mailpit): correo en los 9 idiomas, `/auth/confirm` no gasta el
  token en un GET, `/reset-password` cierra las demás sesiones, respuesta uniforme y límites.
- Renovación de una invitación caducada desde el panel, con el enlace nuevo visible y el anterior
  invalidado.
- Migración por QR en dos emuladores: el viejo mina el QR, el nuevo canjea el deep link y entra, la
  fila queda `used` en ~6 s y el viejo responde «Tu sesión fue revocada».
- Código inválido/caducado y enlace con sesión abierta muestran su propio mensaje; el segundo
  ofrece «Cerrar sesión y escanear».
- Módulo `owe-no` instalado y activo; datos de demo (3 personas, grupo, gasto, saldos); la cuenta
  demo ve el módulo en la app.
- Gates mecánicos, auditorías de seguridad y UX, y revisión de estilo (ver `task-11-audits.md`).
- Quitar una instancia guardada desde el selector (tarea 12), con confirmación y persistencia tras
  reiniciar; verificado en emulador.

## 1. Requiere un móvil Android real

Esto es lo que falta de las tareas 05, 06, 07, 08, 09 y 10. Con dos móviles se cubre todo; con uno
solo, se puede hacer todo menos el escaneo del QR.

| # | Qué | Cómo se comprueba |
|---|---|---|
| 1 | ~~Aceptar invitación en la app (cuenta nueva y existente)~~ | **Hecho 2026-11-18** en el móvil del propietario, con la cámara; falta solo el App Link https (punto 2) |
| 2 | **App Link https** (tarea 05) | Tras P3 y el release: `adb shell pm get-app-links com.rferic.zero27apps` → `verified`; abrir `https://027apps.ericrf.com/invite/<token>` desde Gmail y desde la cámara |
| 3 | **Wizard web en un Android real** (tarea 07) | Abrir el enlace en Chrome: aviso Android 8+, descarga del APK, «Abrir en la app», reintento sin bucle y canje en el navegador |
| 4 | **QR entre dos móviles** (tarea 10, P4) | El flujo de un móvil + QR servido ya está verificado (entra, la sesión vieja se revoca en servidor). Falta el escaneo entre dos dispositivos y la revocación de **push**, que exige producción |
| 5 | **Caducidad y renovación del QR** | Dejar pasar 60 s sin escanear: el QR deja de mostrarse como válido y «Generar otro código» funciona; reusar un código da error, no entra |
| 6 | **`FLAG_SECURE` y captura** | Intentar una captura del QR: debe salir bloqueada; la app explica que se renueva sola |
| 7 | **Recuperación con email real** (tarea 08, P5) | En staging o producción: `/forgot-password` con una cuenta real, abrir el correo, «Continuar», cambiar contraseña y entrar. Probar también el límite de 3/hora |
| 8 | **Actualización a la release** (tarea 03/06) | Instalar la release 0.18.x, publicar 0.19.0 y abrir la app: aviso de versión nueva, descarga e instalación, y la sesión sigue dentro |
| 9 | ~~Login tras logout~~ | **Hecho 2026-11-18**: el logout en la app ya no cierra la app (crash de Firebase corregido) y se vuelve a entrar sin problema |
| 10 | **Contraste claro/oscuro** (tarea 09) | Capturas a 375 px (web) y 390 px (app) de invitación, bienvenida, recuperación y migración, en claro y oscuro |

El punto 4 es el único que exige **dos** dispositivos. La revocación de push solo se puede probar
donde haya FCM configurado: la instancia de producción, con la release firmada.

## 2. Requiere tu acción en servicios

1. **P3 — App Link**: cargar `ANDROID_APP_SHA256` en Vercel (Production) y **redesplegar**.
   Valor y pasos exactos en [`task-05.md`](task-05.md). Hasta entonces `assetlinks.json` responde `[]`.
2. **Merge y tag** (nada se mergea sin tu orden): PR del sprint → `staging`; comprobar allí; promoción
   `staging → main`; tag `v0.19.0`, que hace que CI firme y publique el APK.

## 3. Después del merge (lo hago yo)

- Confirmar que `migrations.yml` aplica `0035` y `0036` a `027apps-dev` sin incidentes.
- Repetir en `staging`: invitación (app si hay APK de preview), recuperación con email real y `/migrate`.
- Comprobar en el release de GitHub: APK firmado, `apksigner verify --print-certs` coincide con
  `ANDROID_APP_SHA256`, y la release no es borrador.
- Cerrar las tareas a `finalizada` cuando sus criterios estén cumplidos.

## 4. Decisiones pendientes (no son verificación)

- **5 hallazgos de UX diferidos** con motivo escrito en [`task-11-audits.md`](task-11-audits.md):
  caducidad con hora y zona, página 503 con marca, bienvenida de admin si falla el auto-login, y
  pulido de copy/áreas táctiles/iconos.
- **`owe-no` público o privado**: el interruptor está en `/panel/modules/owe-no`; hoy está privado y
  las cuentas demo lo ven por la categoría «Demo family».
- **Demo desde el seed**: mover la concesión del módulo a la categoría dentro del seed, para que los
  datos de demo vengan usables sin un paso manual.
