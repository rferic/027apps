---
id: sprint-13-task-05
titulo: Entorno de preview y rama staging (editar)
area: infra
estado: test
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

## Ejecución (2026-11-09)

Hecho hasta ahora, con evidencia leída de la API de Vercel (sin valores de secretos):

- **A.1 — variables Preview.** Las 5 existen con `target: ["preview"]` y **sin** `gitBranch` ni
  override de rama. Solo `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` son de
  tipo `plain` (valor visible por diseño); las otras tres son `sensitive` y Vercel las muestra
  en blanco siempre, también al propietario.
- **A.2 — contraseña de `027apps-dev`.** Rotada por el propietario. `SUPABASE_DB_URL` editada
  en Vercel el `2026-11-09T14:56:49Z` (Preview, todas las ramas) con la cadena del *session
  pooler* nueva.
- **`.env.local`**: **no** necesita la contraseña de la nube porque apunta al stack local
  (`127.0.0.1:54322`); se regeneró desde `supabase status` al arreglar el 502 local. Le falta
  `SETTINGS_ENCRYPTION_KEY` (el asistente lo marcará como ausente en local); añadirla solo si se
  necesita cifrar secretos en local, y sin pisar una clave previa con datos ya cifrados.
- **Redeploy de verificación**: `dpl_3dQCWHmG4CdmXcR3iMjz4XzqGBpV` (heredado de
  `dpl_3HW2MJNQTN1myK8DPnU4KQBiQ2Qe`, rama `sprint/13-staging-prod`, commit `1e788d6`), estado
  `READY`. Peticiones a través de Vercel Authentication:
  - `/api/health` → `200 {"status":"ok"}`.
  - `/login` → `200`, `<title>027Apps</title>`. Es la verificación que importa: el proxy consulta
    Postgres en cada request (`readInstanceState` → pool `pg`), así que un 200 demuestra que la
    contraseña nueva autentica; con la vieja daría 500.
- **Incidencia local resuelta**: `http://027apps.local` daba 502 porque el dev server no estaba
  escuchando en `3003` (Caddy devolvía `connection refused`). Levantado con
  `PORT=3003 pnpm --filter admin dev`; `login:200`, `/api/health:200`.

- **A.1/A.2 verificados en la API de Vercel** el 2026-11-09.

### A.4/A.5 — modelo real de Hobby y decisión de dominio

- **Branch Tracking no se puede editar en Preview**: la cuenta tiene `accountLimit.total = 0`
  custom environments (Hobby). Preview queda fijado a **“All unassigned branches”**, así que
  `staging` despliega como preview sin configurar nada. El intento de A.4.1 como “elegir rama en
  Preview” no aplica: la rama se elige **en el dominio**, no en el entorno.
- **A.5 ya estaba activo**: `ssoProtection = { enabled: true, deploymentType:
  "all_except_custom_domains" }`, que es *Standard Protection*. No se toca.
- **Decisión (2026-11-09): plan B, sin dominio custom para staging.** `all_except_custom_domains`
  significa literalmente que **cualquier** dominio custom queda fuera de Vercel Authentication, y
  *All Deployments* protegería también el dominio de producción y dejaría fuera a la familia. Por
  tanto `staging.027apps.ericrf.com` sería público por diseño de Hobby.
  - URL de staging: **`https://027apps-git-staging-eric-rf.vercel.app`** (alias de rama, protegido
    por Standard Protection). Patrón confirmado en el proyecto con otra rama
    (`027apps-git-docs-sprint-infra-vercel-eric-rf.vercel.app`).
  - El dominio `staging.027apps.ericrf.com` **no se asigna**; queda reservado para producción.
- **El dominio comprado en Vercel no cambia la protección.** `ericrf.com` está registrado en
  Vercel con NS `ns1/ns2.vercel-dns.com` y un comodín `*.ericrf.com ALIAS
  cname.vercel-dns-017.com`, así que cualquier subdominio resuelve a Vercel y el certificado se
  emite al asignarlo. Evidencia del estado previo: `027apps.ericrf.com` → `404`
  (`DEPLOYMENT_NOT_FOUND`, no asignado), `staging.027apps.ericrf.com` → error TLS (sin
  certificado por no estar asignado).
- **A.3** ejecutado por el propietario en el dashboard de `027apps-dev` (Site URL y redirect
  URLs con `https://staging.027apps.ericrf.com`). No es verificable por API sin token; se valida
  funcionalmente con el email de prueba del asistente en producción.
- **A.6 verificado el 2026-11-09**, tras el merge del sprint a `staging` (squash `90a54eb`):
  - Deployment `027apps-ig3zjy0m7-eric-rf.vercel.app`, branch `staging`, estado `READY`;
    alias de rama `https://027apps-git-staging-eric-rf.vercel.app`.
  - Sin cookie: `302` a `vercel.com/sso-api` → protegido por Standard Protection.
  - Con sesión de Vercel: `/api/health` → `200 {"status":"ok"}`; `/login` → `200`,
    `<title>027Apps</title>` (consulta Postgres en cada request, así que valida también la
    contraseña nueva de `027apps-dev`).
  - CI de `staging` en verde (`90a54eb`).
  - El job `migrate-dev` **no se ejecutó**: el merge no tocó `supabase/migrations/**` (staging ya
    contenía `0014`–`0019` desde el PR #42). Su primera validación real será una migración nueva.

**Fuera de esta tarea, pero anotado**: el 2026-11-09 el propietario puso *Production Branch* =
`main` en el dashboard, que es el estado objetivo de ADR 0010 (adelanta parte de B.4; la rama
`production` se borra en la tarea 06). Mientras el scope Production tenga 0 variables y no exista
`027apps-prod`, un merge a `main` generaría un deployment degradado (`/api/health` 503, sin Auth
ni BD) en `027apps.vercel.app`, cubierto por Vercel Authentication. La protección es el gate de
merge: **no se promociona `staging → main` hasta cerrar la tarea 06**.
