---
id: sprint-13-task-05
titulo: Vercel — ramas, dominios, variables y protección
area: infra
estado: pendiente
plan: docs/superpowers/plans/2026-11-08-staging-production.md
fuente: docs/superpowers/specs/2026-11-08-staging-production-design.md §3, §6, §12
adrs: [0010]
---

**Tarea**: configurar Vercel para el modelo de dos ramas (configuración de dashboard, no de
código).

**Objetivo**: *Production Branch* = `main`, rama `staging` con dominio y variables propias, y
variables de producción para `027apps-prod`.

**Contexto**: hoy *Production Branch* = `production` (placeholder) y no hay dominio de
producción. Vercel Hobby no admite entornos custom; el equivalente es la rama `staging`
asignada al entorno Preview con dominio y variables por rama. Vercel Authentication no aplica a
dominios custom.

**Alcance**:
- Dentro: *Production Branch* = `main`; borrar la rama `production`; dominio
  `staging.027apps.ericrf.com` con variables por rama (scope Preview → `027apps-dev`);
  variables Production (scope Production → `027apps-prod`); check de Vercel en los checks
  requeridos de `staging` y `main`.
- Fuera: no se toca `vercel.json` (no existe; la config vive en el dashboard).

**Criterios de aceptación**:
- `main` despliega producción; `staging` despliega a `staging.027apps.ericrf.com`.
- La rama `production` está borrada de GitHub.
- Variables de Preview (dev) y Production (prod) correctas por entorno.
- Check de Vercel requerido en ambas ramas.

**Puertas de usuario**: *Production Branch* y borrado de `production` (Vercel/GitHub);
**decisión pendiente — staging público o protegido**: dejar `staging.027apps.ericrf.com`
público con el login normal de la app, o aplicarle Deployment Protection.

**Riesgos**: dejar staging público sin quererlo (se registra como decisión pendiente, no se
resuelve); olvidar el check de Vercel en los checks requeridos.
