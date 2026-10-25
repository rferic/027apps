---
id: sprint03-task-04
titulo: Spec de autenticación (definición)
area: core
estado: en curso
---

Tarea 4 del sprint 03. Sprint de **definición** (sin código): documentar la autenticación aprobada antes del Core.

**Entregable**: spec `docs/superpowers/specs/2026-10-25-auth.md` — frontera Supabase vs propio, alta por invitación, bootstrap, sesión móvil, recuperación, realtime y envío de emails.

**Estado (2026-10-25):**
- [x] Frontera decidida: **Supabase = identidad (Auth) + transporte (Realtime); nosotros = autorización (guard), invitación, casos de uso, tokens de máquina, eventos de dominio**.
- [x] Alta **solo por invitación**; wizard con email + contraseña **en la app** (el navegador nunca ve la contraseña).
- [x] **Primer super_admin por wizard de instalación** estilo WordPress: `/setup` agrupa los pasos iniciales — conexión con Supabase, SMTP del proyecto (gratis, Resend/Brevo a elegir) y creación del super_admin — y desaparece al existir un admin.
- [x] **Emails**: reset de contraseña vía Supabase Auth + custom SMTP (gratis, incluido en Free) con proveedor **Resend/Brevo** a elegir en la instalación; el email imprescindible es solo el del reset. **Pendiente (sprint de infra, puerta de usuario):** elegir proveedor concreto, confirmar si la app enviará emails propios además del reset, y comportamiento en dev/preview (Mailpit local) — ver §5bis de la spec.
- [x] **Realtime**: Broadcast con eventos de dominio publicados por la API tras el commit; aislamiento por RLS (topic por grupo); `JWT_EXPIRY = 900 s` para acotar la revocación de conexiones abiertas.
- [ ] Pendiente: aprobación del usuario del borrador final; ajuste definitivo de `docs/superpowers/specs/2026-10-25-token-model.md` (ya aplicado en la conversación: token de dispositivo → sesión Supabase) y del diseño §4/§6 si procede.