---
id: sprint-13-task-05
titulo: Entorno de preview y rama staging (editar)
area: infra
estado: pendiente
plan: docs/superpowers/plans/2026-11-08-staging-production.md
fuente: docs/superpowers/specs/2026-11-08-staging-production-design.md §A
adrs: [0010]
---

**Tarea**: editar el entorno de preview existente y crear la rama `staging` en Vercel, según la
checklist §A de la spec.

**Objetivo**: dejar `staging` desplegando a `staging.027apps.ericrf.com` (protegido) contra
`027apps-dev`, con las variables y el Auth correctos, sin tocar nada de producción (eso es la
tarea 06).

**Contexto**: hoy *Production Branch* = `production` (placeholder) y no hay dominio de
producción. Vercel Hobby no admite entornos custom; el equivalente es la rama `staging`
asignada al entorno Preview con dominio y variables por rama. Vercel Authentication no aplica a
dominios custom.

**Alcance**:
- Dentro (§A de la spec): variables Preview en todas las ramas (sin scope limitado a una);
  rotar la contraseña de `027apps-dev` y actualizar `SUPABASE_DB_URL` en Vercel Preview y
  `.env.local`; Auth de `027apps-dev` con redirect URL `https://staging.027apps.ericrf.com`;
  rama `staging` con branch tracking, dominio y variables heredadas de Preview; Deployment
  Protection *Standard Protection*; verificación de deploy y `/api/health`.
- Fuera: *Production Branch* = `main`, borrado de `production`, variables de producción y
  proyecto `027apps-prod` (tarea 06); no se toca `vercel.json` (no existe; la config vive en
  el dashboard).

**Criterios de aceptación**:
- Las 5 variables tienen scope Preview en todas las ramas (ninguna limitada a una rama).
- `027apps-dev` con contraseña rotada; `SUPABASE_DB_URL` actualizado en Vercel y `.env.local`.
- Auth de dev cubre `http://027apps.local`, el puerto local y `staging.027apps.ericrf.com`.
- `staging` despliega a `staging.027apps.ericrf.com` con `/api/health` en `ok`.
- **Staging protegido**: `curl -I https://staging.027apps.ericrf.com` sin cookie devuelve login
  (no la app). **Plan B si no queda protegido**: no asignar dominio custom a staging y usar la
  URL fija de rama (`<branch>-<project>-<team>.vercel.app`), que Standard Protection protege
  por definición.

**Puertas de usuario**: rotar la contraseña de `027apps-dev` (Supabase); asignar el dominio y
la protección (Vercel). **Decisión tomada (2026-11-09): staging protegido** con Deployment
Protection (Vercel Authentication); la familia no podrá acceder a staging en Hobby; los agentes
usan *Protection Bypass for Automation* si hace falta.

**Riesgos**: *Standard Protection* no cubra el dominio custom asignado a la rama Preview (se
comprueba con `curl -I`; plan B documentado); olvidar el check de Vercel en los checks
requeridos (se hace en la tarea 02).
