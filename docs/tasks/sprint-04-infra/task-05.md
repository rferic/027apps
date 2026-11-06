---
id: sprint-04-task-05
titulo: SMTP del proyecto (proveedor gratuito)
area: infra
estado: finalizada
plan: docs/superpowers/plans/2026-10-27-sprint-04-infra.md
fuente: spec auth §3bis / §5bis
---

**Tarea**: elegir y configurar el proveedor SMTP gratuito (Resend o Brevo) en el proyecto Supabase (custom SMTP, incluido en Free; en supabase, para el reset de contraseña). Es un paso del wizard de instalación (spec de auth). Puerta de setup del usuario.

## Bitácora (2026-10-31 – 2026-11-01)

- **Proveedor elegido**: **Resend** (free: 100 emails/día, 3.000/mes). Brevo queda como alternativa si el volumen crece (300/día), pero el volumen familiar no lo justifica y el SMTP de Resend está mejor documentado para Supabase.
- **Dominio**: subdominio dedicado `mail.ericrf.com` (el raíz `ericrf.com` está comprado y gestionado en Vercel DNS). Registros creados en Vercel DNS: DKIM (TXT `resend._domainkey.mail`), Return-Path (CNAME `rsend.mail` → `rsend-euw1.forge.rmta.net`) y SPF/send (CNAME `send.mail` → `send.forge.rmta.net`).
- **SMTP en Supabase** (`027apps-dev`, Auth → SMTP): `smtp.resend.com` puerto `465`, usuario `resend`, remitente `no-reply@mail.ericrf.com`, nombre `027Apps`. Verificado por Management API sin imprimir la contraseña.
- **Prueba de envío**: invitación de Auth por API al email del propietario → `HTTP 200`, usuario creado en `auth.users` (pendiente aceptar la invitación y confirmar la entrega en bandeja).
- **API key de Resend rotada por el usuario** (2026-11-01): la clave que se expuso en el chat quedó revocada y la nueva se actualizó en el SMTP de Supabase (`027apps-dev`). Ya no hay clave activa expuesta.
- **Pendiente (higiene, no reabre la tarea)**: revisar las plantillas de email por defecto; ajustar el límite de 30 mensajes/hora si hiciera falta.
