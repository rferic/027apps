---
id: sprint-13-task-06
titulo: Supabase — proyecto `027apps-prod`
area: infra
estado: pendiente
plan: docs/superpowers/plans/2026-11-08-staging-production.md
fuente: docs/superpowers/specs/2026-11-08-staging-production-design.md §6
adrs: [0010]
---

**Tarea**: crear el proyecto Supabase de producción y dejarlo operativo.

**Objetivo**: `027apps-prod` (región eu-west) con variables de producción en Vercel, SMTP
(Resend), migraciones aplicadas y flujos de auth verificados.

**Contexto**: Supabase Free permite 2 proyectos activos; hoy solo existe `027apps-dev` (ref
`wrigkwhrihawvwiciouy`). La contraseña de la BD de dev se compartió por chat (2026-10-27) y se
rotará.

**Alcance**:
- Dentro: crear `027apps-prod` (contraseña nueva generada en el dashboard, nunca por chat ni
  en git); variables Production en Vercel `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SETTINGS_ENCRYPTION_KEY`,
  `SUPABASE_DB_URL`; SMTP con Resend (`mail.ericrf.com`); migraciones iniciales; verificación
  de `/api/health`, login por invitación y reset de contraseña; rotar la contraseña de
  `027apps-dev`.
- Fuera: no se configuran backup (tarea 07) ni keep-alive (tarea 08).

**Criterios de aceptación**:
- Existe `027apps-prod` con migraciones aplicadas y SMTP funcional.
- `/api/health` en verde en producción; invitación y reset de contraseña probados.
- Variables Production en Vercel correctas (sin valores en git ni en la tarea).
- Contraseña de `027apps-dev` rotada.

**Puertas de usuario**: crear el proyecto y rotar la contraseña (solo dashboard Supabase);
configurar SMTP (Resend).

**Riesgos**: reutilizar el proyecto dev como prod; perder la contraseña nueva; clave maestra
`SETTINGS_ENCRYPTION_KEY` inconsistente con la de dev (misma clave o re-cifrado explícito).
