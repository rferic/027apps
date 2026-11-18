---
id: sprint-16-task-06
titulo: Aceptación en la app — precarga, bloqueo, confirmación y auto-login
area: app
estado: finalizada
plan: docs/superpowers/plans/2026-11-16-invitation-session-migration.md
fuente: docs/superpowers/specs/2026-11-16-invitation-session-migration-design.md
mockup: docs/mockups/invitation-flow/index.html
adrs: [0002, 0004, 0007, 0008]
---

**Tarea**: convertir la pantalla de invitación en el formulario aprobado: todos los datos
precargados y bloqueados salvo contraseña y confirmación, cuenta existente con contraseña actual y
auto-login tras el canje, con estados idénticos a la web.

**Implementación completa 2026-11-17; validada en emulador, pendiente la aceptación en el móvil del
propietario y el App Link https de la tarea 05.**

- `InvitationPreviewDto` + `ApiClient.invitationPreview` (GET público); `RedeemRequest` con
  contraseña opcional y `RedeemResponse.user.role` (rol efectivo, `super_admin` incluido).
- `onInviteLink` carga el preview al abrir el enlace; **cancela el boot en curso** para que no
  sobrescriba la invitación con el login. Estados de carga, inválida/404, caducada, usada y error
  de red; el idioma sale del `locale` del preview.
- `InviteScreen`: ficha bloqueada (email, nombre, instancia, invitador, rol, caducidad); cuenta
  nueva con contraseña + confirmación; existente con contraseña actual y «¿Olvidaste tu
  contraseña?» (abre la web de la instancia); errores accionables; el token no se pinta.
- Sesión primero (D21): una cuenta existente firma con Supabase **antes** de canjear y una
  contraseña mala no llama al canje ni lo consume; una buena canjea con esa sesión y no repite
  login. Una cuenta nueva canjea, firma y abre el shell; si el login posterior falla, va a
  `NeedsLogin(invitation_accepted)` una sola vez, sin reintentar el canje.
- Si el enlace apunta a otra instancia, la sesión guardada no se reutiliza ni se cambia en
  silencio: se limpia antes de crear el cliente Supabase de esa instancia.
- El botón web «Abrir en la app» usa `zero27apps://` (un esquema de URL válido: no puede empezar
  por un dígito, y Chrome convertía `027apps://` en una ruta relativa con un 404). La app sigue
  aceptando `027apps://` y `027apps-dev://` para enlaces y `adb` ya existentes.
- Aviso `invitation_accepted` en el login y strings nuevos en los 9 idiomas.
- Paleta Android con los tokens `android`/`android-foreground` para mantener la paridad con
  `tokens.json`.

**Evidencia (emulador Android, instancia local `http://10.0.2.2:3003`):**

- Enlace `027apps-dev://invite/<token>?instance=…` → formulario precargado y bloqueado, en el
  idioma de la invitación. ✔
- La app acepta el mismo contrato de token que el Core (prefijo `027_inv_` + 1..200), no un mínimo
  de 8: un token de prueba corto funcionaba en web/API y la app lo descartaba sin avisar. ✔
- Un boot que termina después del enlace ya no reemplaza la invitación por el login/shell. ✔
- Cuenta nueva: contraseña + confirmación → cuenta creada, auto-login y shell. ✔
- Cuenta existente: pide la contraseña actual; una mala muestra «La contraseña no es correcta» y
  la invitación sigue pendiente; la buena entra al shell y la consume. ✔
- Token desconocido → tarjeta «This invitation does not exist.» sin formulario. ✔
- `./gradlew :app:testDebugUnitTest :app:assembleDebug` en verde; incluye preview, canje sin
  contraseña para cuenta existente y el aviso del login.

**Auditoría de seguridad (2026-11-17)**

- A02/A11: el token viaja en el path del enlace y en la petición, nunca se pinta ni se registra;
  `allowBackup=false` y el Keystore cifran la sesión (sin cambios).
- A07: sesión primero; el cliente Supabase se crea para la instancia del enlace; una sesión de otra
  instancia se descarta; el canje no se reintenta tras un 201.
- El formulario no permite editar email ni nombre (ficha, no inputs); solo contraseña/confirmación.
- Veredicto: sin hallazgos abiertos. Pendiente el App Link https (05) y la prueba en el móvil del
  propietario.

**Punto de partida (verificado)**
- `InviteScreen.kt` pide email, nombre y contraseña; el nombre es editable.
- `AppViewModel.acceptInvite` canjea y firma sesión sola, pero no tiene preview, no distingue
  cuenta existente y no maneja el fallo posterior al canje.
- `InvitationLink.kt` ya parsea https y el esquema propio.
- El App Link no verifica hasta la tarea 05; la aceptación en dispositivo depende de ella.

**Alcance**
- Dentro:
  - DTO de preview y `ApiClient.invitationPreview(token)`.
  - `AppViewModel`: carga el preview al abrir el enlace; estados de carga/red/caducada/usada/
    inválida; `acceptInvite` sin `display_name` y **sesión primero** (D21): cuenta existente firma
    con `signInWithPassword` antes de canjear y una contraseña mala **no** llama al canje; cuenta
    nueva canjea → login → shell; 201 + login fallido → `NeedsLogin(invitation_accepted)`, sin
    reintentar el canje. El cliente Supabase de la instancia del enlace se crea antes de firmar (o
    antes del login en una cuenta nueva); una sesión de **otra** instancia no se reutiliza ni se
    cambia de instancia en silencio.
  - `InviteScreen`: wordmark + instancia; datos bloqueados como **ficha** (email, nombre,
    instancia, invitador, caducidad y rol), no inputs deshabilitados; contraseña + confirmación
    (nueva) o solo contraseña (existente) con «¿Olvidaste tu contraseña?»; el idioma sale del
    `locale` del preview; errores accionables (contraseña incorrecta de Supabase Auth,
    `existing_account_signin_required`, caducada, usada, rate limit).
  - `LoginScreen`: avisos `invitation_accepted` y `revoked`.
  - Strings en los 9 idiomas.
- Fuera: el wizard web (07); el QR (10); el reset in-app (08 enlaza a la web); el nombre editable.

**Dependencias**: 02 (mockup), 04 (preview/rol/cuenta existente) y 05 para la prueba real de App
Links. La UI no empieza sin P2.

**Riesgos**: que el preview se cargue antes de tener la instancia/Supabase (no la necesita); que el
formulario permita editar el email por un `TextField` mal configurado (test y revisión); que el
canje se reintente tras un 201 y dé `invitation_used` (no reintentar); que el cambio de contraseña
existente aplique la validación de 12 caracteres (solo para cuentas nuevas).

**Criterios de aceptación**
- En dispositivo real, el enlace abre la app y el formulario aparece precargado y bloqueado; solo
  se editan contraseña y confirmación.
- Cuenta nueva: crear + auto-login + shell.
- Cuenta existente: pide la contraseña actual; una mala **no llama al canje** y la invitación sigue
  pendiente; una buena firma y canjea con la sesión, sin segundo login.
- Caducada/usada/inválida: sin formulario, con el texto correcto.
- Fallo de red tras el canje: aviso y login, sin segundo canje.
- `./gradlew :app:testDebugUnitTest :app:assembleDebug` en verde.
- La UI corresponde con el mockup aprobado.

**Puertas de usuario**
- Aprobar el mockup de la app (P2).
- Aceptar en un dispositivo real (P4).
- Confirmar A1/A5 y el flujo de cuenta existente.

**Auditoría de seguridad**: obligatoria antes de `finalizada` (A02, A07, A11): token no visible ni
en logs, Keystore, `allowBackup=false`, formulario bloqueado, sin reenvío del canje.

**Aceptación real (2026-11-18, móvil del propietario)**: verificados los dos caminos.
- **Cuenta nueva**: `invitado.demo@example.test`; la cámara de Android abrió la app (esquema de
  debug), contraseña elegida y la invitación quedó `used`; perfil `user`, idioma `es` y módulo
  `owe-no` concedido.
- **Cuenta existente**: `demo.ana@example.test` con su contraseña actual, rol conservado.
- **Web**: canje completo desde el navegador con una invitación de cuenta nueva.
El escáner **de la app** no sirve para invitaciones (solo migración): comportamiento diseñado.

**Correcciones de la aceptación**:
- Con otra sesión abierta (o guardada en arranque en frío) la invitación ahora pide confirmación y
  ofrece «Cerrar sesión y aceptar» en vez de cambiar de cuenta en silencio.
- `FcmRegistrar.revoke()` mataba el proceso al cerrar sesión en una instancia **sin FCM** (Firebase
  sin inicializar, excepción en un hilo). Ahora comprueba `FirebaseApp.getApps()` y captura el
  fallo; afectaba a cualquier logout local.

**App Link https (2026-11-18)**: verificado en producción desde el correo y desde la cámara; el enlace abre la app de release sin pasar por el navegador.
