# Sprint 13 — Entornos `staging` y `main` (plan de implementación)

**Goal:** Activar producción y staging con deploy automático al mergear, dos proyectos
Supabase, migraciones por entorno, backup cifrado y keep-alive — todo contra el modelo del
[ADR 0010](../../adr/0010-entornos-y-ramas.md).

**Architecture:** Ocho tareas secuenciales, de documentación a infraestructura. (1) alinear
docs con el modelo; (2) protección de ramas; (3) CI en dos entornos; (4) migraciones por
entorno; (5) Vercel (ramas, dominios, variables, protección); (6) Supabase `027apps-prod`;
(7) backup cifrado real; (8) keep-alive y runbook de release. Las tareas 5–8 tienen puertas
de usuario (acciones solo de administrador/dashboard); las 7 y 8 vienen de
`sprint-11-prod-activation`.

**Tech Stack:** Markdown (docs), GitHub (branch protection, environments, secrets), Vercel
dashboard (ramas, dominios, variables), Supabase dashboard/CLI, Resend, Cloudflare R2/B2.
Sin código de producto.

**Spec:** `docs/superpowers/specs/2026-11-08-staging-production-design.md` (aprobada
2026-11-08). **ADR:** `docs/adr/0010-entornos-y-ramas.md`.

## Arranque

- [ ] Trabajar en `sprint/13-staging-prod` (ya creada). No tocar `main`.
- [ ] Abrir el PR del sprint en **draft** contra `staging` desde el arranque (un PR por
  sprint; squash merge solo con orden explícita del usuario).

## Global Constraints

- **No se reabre la decisión del usuario**: dos ramas desplegables, deploy automático,
  `main` = producción, sin `develop`, rama `production` eliminada.
- **No se escribe código de aplicación** en las tareas 1–2; las tareas 3–4 describen cambios
  de CI pero no los implementan aquí (los ejecuta el Soldado en su propia tarea, con TDD y
  auditoría).
- **Secretos por nombre, nunca valores.** No se inventan refs de proyecto ni dominios: los
  dominios son los de la decisión (`staging.027apps.ericrf.com`, `027apps.ericrf.com`).
- **Acciones de administrador son puertas de usuario**: no las ejecuta un agente; se
  documentan con sus pasos exactos.
- **`AGENTS.md` es contrato**: si el modelo nuevo exige cambiar una regla suya, se hace como
  tarea explícita (tarea 01), no como edición silenciosa.
- **Auditoría de seguridad incondicional** antes de `finalizada` en toda implementación.

## Review Focus

1. **Contradicción entre flujos y spec** → tarea 01: `cicd.md`, `git.md`, `release.md`,
   `infrastructure.md` y `AGENTS.md` deben describir el mismo modelo sin contradicciones.
2. **Rama `production` y `develop`** → tarea 01/02: `production` se elimina; no aparece
   `develop` en ningún flujo.
3. **Migraciones de prod sin aprobación** → tarea 04: el job de `main` queda detrás del
   Environment `production` con required reviewer; sin eso no puede tocar datos reales.
4. **Staging público por accidente** → tarea 05: se registra la decisión pendiente
   (público vs protegido); no se resuelve por cuenta propia.
5. **Fork alcanza producción** → tarea 03: ningún PR de fork recibe secrets ni dispara deploy
   de producción.
6. **Backup no probado** → tarea 07: primer snapshot + simulacro de restauración antes de
   `finalizada`.

---

### Task 1 — sprint-13-task-01: Modelo de entornos y ramas (ADR + spec + flujos)

**Files:**
- Create: `docs/adr/0010-entornos-y-ramas.md` (ya existe; verificar que no contradice la spec)
- Modify: `docs/flows/cicd.md` (sustituir «deploy solo desde `main`» y la pausa por el modelo
  de dos ramas; actualizar triggers, migraciones y la sección B)
- Modify: `docs/flows/git.md` (añadir `staging` al modelo: rama de trabajo → PR a `staging` →
  PR `staging → main`; sincronización `main → staging`)
- Modify: `docs/flows/release.md` (cada merge a `main` despliega producción, vía `staging`)
- Modify: `docs/infrastructure.md` (§9 y §1: `027apps-prod`, *Production Branch* = `main`,
  borrar `production`)
- Modify: `AGENTS.md` (sección Git: flujo de promoción con `staging`; la regla dura
  «nada a `main` sin pasar por `staging`»)

**Verificación:**
- `grep -rn "production" docs/flows docs/infrastructure.md AGENTS.md` → solo aparece como
  «borrar/eliminar», nunca como rama vigente.
- `grep -rn "develop" docs/flows docs/infrastructure.md AGENTS.md` → sin ocurrencias como
  rama del modelo.
- Lectura cruzada: `cicd.md`, `git.md`, `release.md`, `infrastructure.md` y `AGENTS.md` no se
  contradicen entre sí ni con la spec.
- Comprobar que las rutas citadas existen (`test -f`).

---

### Task 2 — sprint-13-task-02: Protección de ramas y contrato de promoción

**Files:**
- Modify: `docs/flows/git.md` (protección de `staging` y `main`)
- Modify: `docs/flows/cicd.md` (checks requeridos y puerta de administrador)

**Verificación:**
- Documentados los pasos exactos de protección (Settings → Branches/rulesets): PR obligatorio,
  checks `admin`, `android`, `supabase`, `guard-secrets`, `commitlint`, `ai-docs` y el check de
  Vercel, sin force-push ni borrado, para `main` y `staging`.
- Documentado el contrato de promoción (rama → PR a `staging` → pruebas → PR `staging → main`)
  y la sincronización `main → staging`.
- Acción de administrador registrada como **puerta de usuario** (no la ejecuta un agente).
- Evidencia: la lista de checks requeridos coincide con los jobs reales de `ci.yml`.

---

### Task 3 — sprint-13-task-03: CI en dos entornos

**Files:**
- Modify: `.github/workflows/ci.yml` (extender `push` a `staging`; mantener el resto)

**Verificación:**
- El push a `staging` corre los mismos checks que `main` (evidencia: lectura del YAML + run de
  prueba al abrir el PR del sprint).
- Ningún PR de fork recibe secrets ni dispara deploy de producción (sin `pull_request_target`;
  los jobs con secrets van con guarda `if`/`env`).
- `commitlint` sigue validando solo en `pull_request`.
- Coste anotado: repo público → minutos de Actions sin coste (nota en `cicd.md`).

---

### Task 4 — sprint-13-task-04: Migraciones por entorno

**Files:**
- Modify: `.github/workflows/ci.yml` (o un workflow nuevo): job de migraciones a
  `027apps-dev` al mergear a `staging`; job a `027apps-prod` al mergear a `main`, detrás del
  Environment `production`.
- Modify: `docs/flows/cicd.md` (sección Migraciones: por entorno) y `docs/infrastructure.md`.

**Verificación:**
- El job de `staging` usa `SUPABASE_ACCESS_TOKEN` + ref de `027apps-dev`
  (`wrigkwhrihawvwiciouy`) y `supabase db push` (o `supabase migration up --linked`).
- El job de `main` declara `environment: production` con *required reviewer* y verifica el
  nivel de migraciones (`supabase migration list --linked`) antes de aplicar; antes de
  cambios destructivos, backup manual (`workflow_dispatch`).
- Sin `SUPABASE_ACCESS_TOKEN` (fork), el job se omite sin fallar (mismo patrón que backup).
- Evidencia real: un run del job sobre `staging` aplica (o reporta «nada que aplicar») y el
  de `main` espera aprobación.

---

### Task 5 — sprint-13-task-05: Vercel (ramas, dominios, variables, protección)

**Files:**
- Modify: `docs/infrastructure.md` (§1 Vercel y §9) y `docs/flows/cicd.md` (sección B).

**Verificación (puertas de usuario documentadas, no ejecutadas):**
- *Production Branch* = `main`; borrar la rama `production` de GitHub.
- Rama `staging` con dominio `staging.027apps.ericrf.com` y variables por rama (scope Preview
  apuntando a `027apps-dev`).
- Variables Production (scope Production) para `027apps-prod`.
- **Decisión pendiente registrada**: staging público (login normal de la app) vs Deployment
  Protection sobre el dominio custom (Vercel Authentication no aplica a dominios custom).
- Check de Vercel añadido a los checks requeridos de `staging` y `main`.
- Evidencia: capturas/estado del dashboard referenciadas en la tarea; sin valores de secretos.

---

### Task 6 — sprint-13-task-06: Supabase `027apps-prod`

**Files:**
- Modify: `docs/infrastructure.md` (inventario: ref de `027apps-prod`, SMTP) y
  `docs/flows/cicd.md` (variables de producción).

**Verificación (puertas de usuario documentadas):**
- Crear `027apps-prod` (región eu-west, contraseña nueva generada en el dashboard, nunca por
  chat).
- Variables Production en Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `SETTINGS_ENCRYPTION_KEY`, `SUPABASE_DB_URL`.
- SMTP con Resend (`mail.ericrf.com`).
- Migraciones iniciales aplicadas.
- Verificación: `/api/health` en verde, login por invitación y reset de contraseña.
- Rotar la contraseña de `027apps-dev` (se compartió por chat 2026-10-27).

---

### Task 7 — sprint-13-task-07: Backup cifrado real (movida de sprint-11 task-02)

**Files:**
- (scripts y workflow ya existen) Modify: `docs/tasks/sprint-13-staging-prod/task-07.md`
  (estado/bitácora), `docs/infrastructure.md` (BD objetivo `027apps-prod`).

**Verificación:**
- Bucket R2/B2 + token S3 + secrets cargados (puerta de usuario).
- `workflow_dispatch` deja un snapshot restaurable en el bucket.
- `restore.sh` recupera `public` con datos verificables en un Postgres limpio.
- Simulacro de restauración anotado en el runbook.
- Sin secretos, el workflow queda en verde.

---

### Task 8 — sprint-13-task-08: Keep-alive y runbook de release (movida de sprint-11 task-01)

**Files:**
- Modify: `docs/flows/cicd.md` (runbook de promoción/rollback: código y migraciones) y
  `docs/flows/release.md`.

**Verificación (puertas de usuario documentadas):**
- Secret `PROD_URL` con `https://027apps.ericrf.com` (puerta de usuario).
- Runbook documentado: promoción (rama → staging → main), rollback de código (`git revert` +
  Vercel) y de migraciones (corregir hacia delante).
- Keep-alive diario activo y en verde.
