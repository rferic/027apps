---
id: sprint-16-task-08
titulo: Recuperación de contraseña (web + enlace desde la app)
area: web + core + app
estado: test
plan: docs/superpowers/plans/2026-11-16-invitation-session-migration.md
fuente: docs/superpowers/specs/2026-11-16-invitation-session-migration-design.md
mockup: docs/mockups/invitation-flow/index.html
adrs: [0002, 0004, 0007, 0008]
---

**Tarea**: implementar el flujo de recuperación de contraseña que hoy no existe, en los 9 idiomas y
sin enumeración: solicitud, email propio, confirmación por `token_hash`, nueva contraseña y vuelta
al login con las otras sesiones revocadas.

**Implementación completa 2026-11-17; pendiente la aceptación del propietario con un email real
(P5 en producción) y la revisión/QA.**

- Core `requestPasswordReset`: normaliza el email, aplica `recovery:ip:<ip>` (5/h) y
  `recovery:email:<sha256>` (3/h), no envía para cuenta desconocida o desactivada, acuña el token
  con `generateLink({ type: "recovery" })` y mantiene un **suelo común de 700 ms** en todos los
  caminos. Nunca lanza: un fallo del mailer o del servicio no se convierte en oráculo.
- Email propio `RECOVERY_COPY` en 9 idiomas (`recovery-catalog.ts` + `recovery.ts`), con el enlace
  `public_url/auth/confirm?token_hash=…&type=recovery&next=%2Freset-password`; el token solo viaja
  en el enlace, nunca en el copy.
- `/forgot-password` (formulario + mensaje neutro), `/auth/confirm` (el GET solo pinta el botón; el
  POST valida `type` y el `next` exacto y verifica el OTP, así los escáneres de enlaces no gastan el
  token) y `/reset-password` (exige la sesión de recuperación, 12–200, `updateUser`,
  `signOut({ scope: "others" })` + `local`, vuelta a `/login?notice=password-reset`).
- `/login` localizado (D7) con `instance.name`, enlace «¿Olvidaste tu contraseña?» y avisos
  `password-reset`, `access-revoked` (también `reason=access_revoked` del `/logout`),
  `session-expired` e `invitation-redeemed`.
- En la app, «¿Olvidaste tu contraseña?» en el login abre `http://<instancia>/forgot-password` con
  el navegador; no hay reset dentro de la app.
- `public-paths.ts`: `/forgot-password` y `/auth/confirm` públicos; `/reset-password` no (necesita
  el refresco de sesión del proxy y sin sesión redirige a `/forgot-password`).
- i18n: 20 claves nuevas en 9 idiomas; `email#recovery` en el catálogo.

**Tests**: Core (cuenta desconocida/desactivada sin envío, límites por IP y email, fallo del
mailer, suelo de tiempo, enlace codificado), catálogo y plantilla del email, action de solicitud,
action de confirmación (`next` fuera de allowlist, tipo incorrecto, token vacío/ inválido) y action
de reset (corta, no coinciden, sin sesión, límite, `updateUser` + `signOut` otros/local, fallo de
`updateUser`). `pnpm --filter core test` (522), `pnpm --filter admin test` (1230), `pnpm tsc`,
`pnpm --filter admin lint`, `pnpm --filter admin build`, `pnpm i18n:check` en verde.
Verificado en local: `/forgot-password` 200, `/auth/confirm` 200, `/reset-password` redirige a
`/forgot-password` sin sesión.

**Auditoría de seguridad (2026-11-17)**

- A01/A09: misma respuesta y suelo temporal exista o no la cuenta; no se envía a desactivados; el
  `next` es una allowlist exacta (`/reset-password`); el `GET` no consume el token.
- A02: el token de Supabase solo viaja en el enlace (hash); el email no lo pinta en el copy; no se
  registra. `noindex`/`no-referrer` en las tres páginas y ninguna carga de terceros.
- A04: límites por IP, email y usuario; token de un solo uso; la sesión de recuperación se cierra
  al terminar.
- A05/A07: la recuperación usa el cliente SSR con cookies; `generateLink` solo en el servidor con
  la service role; tras el reset se revocan las demás sesiones y la local.
- Veredicto: sin hallazgos abiertos. Pendiente la prueba con un email real (P5) y la revisión.

**Punto de partida (verificado)**
- No hay «¿Olvidaste tu contraseña?», ni página de reset, ni `/auth/confirm`.
- Solo `apps/admin/src/app/api/v1/setup/test-email/route.ts` llama `resetPasswordForEmail` como
  prueba de SMTP.
- El SMTP de Supabase Auth (Resend) está configurado; límite 30 emails/hora.
- `apps/admin/src/lib/email/` ya tiene el patrón de Resend y `renderEmailLayout`.

**Alcance**
- Dentro:
  - Core `requestPasswordReset` con límites `recovery:ip:<ip>` (5/h) y
    `recovery:email:<sha256>` (3/h); no revela si el email existe; no envía a desactivados.
  - Email propio en 9 idiomas con `generateLink({ type: "recovery" })` → `token_hash` y enlace a
    `/auth/confirm`; **suelo de respuesta común de ~700 ms** exista o no la cuenta (S3).
  - `/forgot-password` (formulario + mensaje neutro), `/auth/confirm` (**página** con botón
    «Continuar»; el `GET` no consume el token, el `POST` verifica con `verifyOtp` y `next`
    allowlist; S2) y `/reset-password` (sesión de recuperación, `updateUser`,
    `signOut({ scope: "others" })` y `local`).
  - Enlace «¿Olvidaste tu contraseña?» para la cuenta existente del flujo de invitación: en la app
    abre la web de la instancia; en la web va a `/forgot-password`; tras el reset se vuelve al
    enlace de invitación, que sigue pendiente (U2).
  - `/login` localizado (D7) con wordmark + `instance.name`, el enlace y avisos `password-reset`,
    `access-revoked`, `session-expired`.
  - App: «¿Olvidaste tu contraseña?» en el login abre la web de la instancia.
  - `public-paths.ts` para `/forgot-password` y `/auth/confirm`; `/reset-password` **no** es
    pública (necesita el refresco de sesión del proxy y redirige a `/forgot-password` sin sesión).
    `noindex`/`no-referrer` en las tres.
  - Tests de Core, web y Android (URL de la instancia).
- Fuera: reset dentro de la app; cambiar la contraseña desde Ajustes; MFA; plantillas de Supabase.

**Dependencias**: tarea 02 (mockup). No depende de la 04; comparte el layout de email.

**Riesgos**: enumeración (respuesta y UI idénticas); que el enlace de Supabase pase por un redirect
no controlado (se usa `token_hash` y una ruta propia); que el reset deje la sesión de recuperación
abierta (se cierra); que el login localizado rompa tests existentes (actualizarlos); que Resend
agote el límite (3/h por email).

**Criterios de aceptación**
- Email real → enlace → nueva contraseña → login; sin revelar si el email existe.
- Un email desconocido recibe la misma respuesta y no envía nada.
- Tras el reset, las demás sesiones (incluido el móvil) quedan fuera; la web vuelve al login.
- El enlace caducado muestra «pide otro» y no un error interno.
- La app abre la web de la instancia correcta.
- `pnpm i18n:check`, tests de web y Core en verde.
- La UI corresponde con el mockup aprobado.

**Puertas de usuario**
- Aprobar el mockup del reset (P2).
- Confirmar D3 (email propio) y P5 (`RESEND_API_KEY`/`EMAIL_FROM`).
- Confirmar D7 (login localizado) y D8 (volver al login).

**Auditoría de seguridad**: obligatoria antes de `finalizada` (A01, A02, A04, A05, A07, A09):
enumeración, tokens en logs, `next` allowlist, rate limits, sesión de recuperación y revocación de
otras sesiones.
