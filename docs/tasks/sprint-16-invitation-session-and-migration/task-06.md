---
id: sprint-16-task-06
titulo: Aceptación en la app — precarga, bloqueo, confirmación y auto-login
area: app
estado: pendiente
plan: docs/superpowers/plans/2026-11-16-invitation-session-migration.md
fuente: docs/superpowers/specs/2026-11-16-invitation-session-migration-design.md
mockup: docs/mockups/invitation-flow/index.html
adrs: [0002, 0004, 0007, 0008]
---

**Tarea**: convertir la pantalla de invitación en el formulario aprobado: todos los datos
precargados y bloqueados salvo contraseña y confirmación, cuenta existente con contraseña actual y
auto-login tras el canje, con estados idénticos a la web.

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
    inválida; `acceptInvite` sin `display_name`; canje → login → shell; 201 + login fallido →
    `NeedsLogin(invitation_accepted)`, sin reintentar el canje.
  - `InviteScreen`: wordmark + instancia; datos bloqueados como **ficha** (email, nombre,
    instancia, invitador, caducidad y rol), no inputs deshabilitados; contraseña + confirmación
    (nueva) o solo contraseña (existente) con «¿Olvidaste tu contraseña?»; el idioma sale del
    `locale` del preview; errores accionables (`invitation_password_invalid`, caducada, usada,
    rate limit).
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
- Cuenta existente: pide la contraseña actual; una mala no consume; una buena entra.
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
