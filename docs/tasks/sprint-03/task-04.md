---
id: sprint03-task-04
titulo: Spec de autenticación (definición)
area: core
estado: finalizada
---

Tarea 4 del sprint 03. Sprint de **definición** (sin código): documentar la autenticación aprobada antes del Core.

**Entregable**: spec `docs/superpowers/specs/2026-10-25-auth.md` — frontera Supabase vs propio, alta por invitación, bootstrap, sesión móvil, recuperación, realtime y envío de emails.

**Estado (2026-10-25):**
- [x] Frontera decidida: **Supabase = identidad (Auth) + transporte (Realtime); nosotros = autorización (guard), invitación, casos de uso, tokens de máquina, eventos de dominio**.
- [x] Alta **solo por invitación**; wizard con email + contraseña **en la app** (el navegador nunca ve la contraseña).
- [x] **Primer super_admin por wizard de instalación** estilo WordPress: `/setup` agrupa los pasos iniciales — conexión con Supabase, SMTP del proyecto (gratis, Resend/Brevo a elegir) y creación del super_admin — y desaparece al existir un admin.
- [x] **Emails**: reset de contraseña vía Supabase Auth + custom SMTP (gratis, incluido en Free) con proveedor **Resend/Brevo** a elegir en la instalación; el email imprescindible es solo el del reset. **Pendiente (sprint de infra, puerta de usuario):** elegir proveedor concreto, confirmar si la app enviará emails propios además del reset, y comportamiento en dev/preview (Mailpit local) — ver §5bis de la spec.
- [x] **Realtime**: Broadcast con eventos de dominio publicados por la API tras el commit; aislamiento por RLS (topic por grupo); `JWT_EXPIRY = 900 s` para acotar la revocación de conexiones abiertas.
- [x] **Aprobada por el usuario** (sesión anterior, 2026-10-25): spec `docs/superpowers/specs/2026-10-25-auth.md` aprobada y commiteada (`499a883`); el ajuste de la spec de tokens (token de dispositivo → sesión Supabase) quedó aplicado en la conversación. El sprint de infra (SMTP concreto, emails propios, dev/preview) queda en su backlog de tareas, no bloquea esta tarea.