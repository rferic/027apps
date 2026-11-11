---
id: sprint-14-task-03
titulo: Invitaciones por email con plantilla reutilizable
area: producto
estado: en curso
plan: pendiente de redactar
fuente: docs/superpowers/specs/2026-11-10-invitation-email-design.md
adrs: [0002, 0004, 0007, 0008]
---

**Tarea**: enviar por email el enlace de invitación con Resend, con idioma elegible, entrega
seleccionable, reenvío y respaldo manual; y construir la plantilla de email reutilizable.

**Punto de partida**: hoy crear una invitación solo devuelve el token y el panel lo muestra una
vez; no se envía ningún correo (`docs/tasks/sprint-13-staging-prod/task-06.md`, cierre). Resend
solo está configurado como SMTP de Supabase Auth: no hay `RESEND_API_KEY` en la app.

**Orden interno obligatorio**
1. **Fase de diseño**: 3 direcciones de mockup en `docs/mockups/email/invitation/` (HTML +
   PNG, claro/oscuro, 9 idiomas de muestra), iteración y aprobación explícita del propietario.
2. Spec ya aprobada → plan y tests (TDD).
3. Migración `0020_invitation_email.sql` (`locale`, `email_sent_at`, `email_failed_at`,
   `email_error`).
4. Módulo `packages/core/src/email/` (layout + plantilla + catálogo 9 idiomas + check).
5. Adaptador Resend en `apps/admin` (`fetch`, timeout 5 s, sin SDK).
6. API: `delivery` y `locale` en el alta; `email.status` en la respuesta; `POST
   /api/v1/invitations/:id/resend-email` con cooldown de 60 s y `POST
   /api/v1/invitations/:id/link` (enlace nuevo para copiar). Ambos rotan el token y solo
   actúan sobre pendientes.
7. Panel: selectores de entrega e idioma, aviso de fallo con el enlace, estado del email y, en
   el detalle de una pendiente, *Reenviar email* y *Generar enlace nuevo* con aviso de que el
   anterior deja de valer.
8. Docs: `docs/infrastructure.md` (variables y remitente), `docs/flows/cicd.md` si toca
   despliegue.

**Criterios de aceptación** (detalle en la spec §12): correo real de punta a punta en
producción; fallo del proveedor sin perder la invitación; reenvío que rota el token y respeta
el cooldown; 9 idiomas sin placeholders ni fechas mal localizadas; nada de tokens ni correos en
logs; CI y builds en verde; mockup aprobado antes de implementar.

**Puertas de usuario**
- `RESEND_API_KEY` en Vercel (Production, Preview, Development), distinta de la contraseña SMTP.
- Confirmar que `mail.ericrf.com` y `no-reply@mail.ericrf.com` siguen verificados.
- Dirección de prueba para la verificación end-to-end.
- Aprobar el mockup.

**Riesgos**: cuota de 100 emails/día (cooldown + enlace manual), entrega en spam (HTML sobrio +
texto plano), fallo del proveedor (no bloquea el alta). Deuda anotada: webhooks de Resend.

## Diseño (2026-11-11)

Tres direcciones de mockup en [`docs/mockups/email/invitation/`](../../mockups/email/invitation/README.md):
`v1` tarjeta clásica, `v2` editorial, `v3` acción primero. Cada una con los 9 idiomas, claro y
oscuro, HTML + PNG y datos ficticios. **Elegida por el propietario: `v1` con el logo A** (latido + wordmark sin tagline). Pendiente
solo `RESEND_API_KEY` + dirección de prueba para el envío real; la implementación puede empezar.

## Ejecución (2026-11-11)

- Migración `0020_invitation_email.sql`: `locale`, `email_sent_at`, `email_failed_at`,
  `email_error`; backfill del idioma por defecto de la instancia.
- `packages/core/src/email/`: plantilla aprobada (`v1` + logo A), catálogo en 9 idiomas,
  versión texto, escapado, fecha por locale y paleta oscura con `prefers-color-scheme`.
- Lockups `email-lockup-light/dark.png` en `apps/admin/public/brand/` (610×94, se muestran a
  156×24).
- Tests: paridad del catálogo y render (escapado, asunto en una línea, fecha, enlaces, fallback
  de idioma y zona). `@027apps/core` en verde (428).
- Servicio: `locale` al crear, rotación de token con `for update`, registro del intento de
  email y cooldown de 60 s.
- API: `delivery`/`locale` en el alta, `POST /invitations/:id/resend-email` y
  `POST /invitations/:id/link`; esquemas y `docs/api/openapi.json` regenerados.
- Adaptador de Resend en el admin (`fetch`, timeout de 5 s, sin SDK); sin clave degrada a
  `skipped`.
- CI del PR en verde, incluido el job `supabase` con la migración `0020`.
- Pendiente: UI del panel (selectores en el alta, estado y acciones en el detalle).
