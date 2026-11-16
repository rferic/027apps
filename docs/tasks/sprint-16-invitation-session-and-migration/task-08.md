---
id: sprint-16-task-08
titulo: Recuperación de contraseña (web + enlace desde la app)
area: web + core + app
estado: pendiente
plan: docs/superpowers/plans/2026-11-16-invitation-session-migration.md
fuente: docs/superpowers/specs/2026-11-16-invitation-session-migration-design.md
mockup: docs/mockups/invitation-flow/index.html
adrs: [0002, 0004, 0007, 0008]
---

**Tarea**: implementar el flujo de recuperación de contraseña que hoy no existe, en los 9 idiomas y
sin enumeración: solicitud, email propio, confirmación por `token_hash`, nueva contraseña y vuelta
al login con las otras sesiones revocadas.

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
    `/auth/confirm`.
  - `/forgot-password` (formulario + mensaje neutro), `/auth/confirm` (route handler,
    `verifyOtp`, `next` allowlist), `/reset-password` (sesión de recuperación, `updateUser`,
    `signOut({ scope: "others" })` y `local`).
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
