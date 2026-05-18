# Sprint 7: CI/CD Pipeline — Hardening del flujo local → preview → producción

## Objetivo del sprint

Corregir los gaps críticos en el pipeline de CI/CD: el CI no corre en ramas (solo en PRs), las migraciones de staging se aplican sin validación previa, y el CONTRIBUTING.md tiene una convención de commits obsoleta. El resultado es un pipeline donde ningún código llega a staging sin haber pasado lint + tsc + tests.

## Contexto del proyecto

- **Stack:** Next.js 16.2.4 (App Router, Turbopack), React 19, TypeScript strict, Tailwind CSS v4
- **DB:** Supabase (PostgreSQL + RLS). Sin ORM — cliente Supabase directo con tipos generados.
- **Auth:** Supabase Auth. Roles: `admin` (platform-wide) / `member`.
- **i18n:** next-intl v4, 6 idiomas (en, es, it, ca, fr, de).
- **Package manager:** pnpm
- **Último sprint completado:** Sprint 6 — Grupos Multitenant (TASK-48 a TASK-60)

---

## Diagnóstico: flujo actual vs. flujo deseado

### Flujo actual (con gaps)

```
push sprint/* | feature/* | fix/*
  ├── Vercel: Preview Deployment → Supabase staging         ✅
  ├── migrate-staging.yml: db push → staging                ⚠️  (sin barrera de CI)
  └── (sin CI aquí — CI solo corre cuando se abre PR)       ❌

PR a main
  └── ci.yml: lint + test + build                           ✅ (tarde — daño ya hecho en staging)

merge a main (squash)
  ├── Vercel: Production Deployment → Supabase prod         ✅
  ├── migrate.yml: db push → producción                     ✅
  └── release.yml: release-please (semver tag)              ✅
```

### Flujo objetivo (tras el sprint)

```
push sprint/* | feature/* | fix/*
  ├── ci.yml: lint + tsc + test + build                     ✅  (nuevo: corre en rama)
  │     └── concurrency: cancela runs obsoletos             ✅  (nuevo)
  ├── Vercel: Preview Deployment → Supabase staging         ✅
  └── migrate-staging.yml: db push → staging                ✅  (nuevo: solo si CI pasó)
        └── trigger: workflow_run[CI] success               ✅

PR a main
  └── ci.yml: lint + tsc + test + build                     ✅  (ya existía)

merge a main (squash)
  ├── Vercel: Production Deployment → Supabase prod         ✅
  ├── migrate.yml: db push → producción                     ✅
  └── release.yml: release-please (semver tag)              ✅
```

---

## Stack y decisiones de diseño

| Decisión | Elección | Motivo |
|---|---|---|
| **CI en ramas** | Añadir `push` trigger a `ci.yml` | Detectar errores antes de abrir PR, antes de que staging reciba código roto |
| **Cancelación de runs** | `concurrency` group en `ci.yml` | Evitar colas de runs obsoletos en pushes rápidos |
| **Gate de migraciones staging** | `workflow_run` trigger con `conclusion == 'success'` | Garantiza que las migraciones solo se aplican a staging si el código es válido |
| **tsc explícito en CI** | Añadir `pnpm tsc --noEmit` antes del build | Alineación con el pre-push hook; errores de tipos visibles antes del build completo |
| **CONTRIBUTING.md** | Actualizar convención de commits | El archivo decía `[MODULO] Description` — incompatible con `Sprint N: type(scope): msg` |

---

## Tareas del sprint

---

### TASK-75 — ci.yml: añadir trigger de rama + concurrency group

**Descripción:** `ci.yml` solo se dispara en `pull_request` a `main`. Hay que añadir un trigger `push` para ramas `sprint/**`, `feature/**`, `fix/**` y un grupo de `concurrency` para cancelar runs obsoletos.

**Archivos:** `.github/workflows/ci.yml`

**Cambio:**
```yaml
name: CI
on:
  pull_request:
    branches: [main]
  push:
    branches:
      - 'sprint/**'
      - 'feature/**'
      - 'fix/**'

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  quality:
    ...
```

**Criterio de aceptación:**
- [ ] Push a rama `sprint/7-cicd-pipeline` dispara el job `quality`
- [ ] Segundo push inmediato cancela el run anterior
- [ ] PR a main sigue disparando CI (trigger existente intacto)

---

### TASK-76 — ci.yml: añadir pnpm tsc --noEmit explícito

**Descripción:** El pre-push hook corre `tsc --noEmit` antes del build, pero CI no lo hace explícitamente. Aunque `pnpm build` type-chequea, añadirlo antes del build da feedback más rápido y alinea CI con el pre-push hook.

**Archivos:** `.github/workflows/ci.yml`

**Cambio:** Añadir step después del build (Fumadocs genera `.source/server` durante `next build` — `tsc` debe correr después para que el módulo exista):
```yaml
- run: pnpm lint
- run: pnpm test --run
- name: Build
  env: ...
  run: pnpm build
- run: pnpm tsc --noEmit
```

**Criterio de aceptación:**
- [ ] Job `quality` falla en errores de tipos antes de llegar al build
- [ ] Salida de CI muestra el step `pnpm tsc --noEmit` independiente

---

### TASK-77 — migrate-staging.yml: gate de CI con workflow_run

**Descripción:** `migrate-staging.yml` se dispara en push a ramas sin saber si CI pasó. Convertirlo a `workflow_run` trigger garantiza que las migraciones solo se aplican si el workflow CI completó con éxito.

**Archivos:** `.github/workflows/migrate-staging.yml`

**Cambio:**
```yaml
name: Migrate (Staging)
on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]
    branches:
      - 'sprint/**'
      - 'feature/**'
      - 'fix/**'
  workflow_dispatch:

jobs:
  migrate:
    if: |
      github.event_name == 'workflow_dispatch' ||
      github.event.workflow_run.conclusion == 'success'
    runs-on: ubuntu-latest
    steps:
      # También filtrar: solo si hay cambios en supabase/migrations/
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.workflow_run.head_sha || github.sha }}

      - name: Check for migration changes
        id: migrations
        run: |
          git fetch origin main --depth=1
          CHANGED=$(git diff --name-only origin/main...HEAD -- supabase/migrations/ | wc -l)
          echo "changed=$CHANGED" >> $GITHUB_OUTPUT

      - name: Skip if no migrations
        if: steps.migrations.outputs.changed == '0'
        run: echo "No migration changes — skipping db push"

      - uses: supabase/setup-cli@v1
        if: steps.migrations.outputs.changed != '0'
        with:
          version: latest

      - run: supabase link --project-ref $SUPABASE_PROJECT_ID
        if: steps.migrations.outputs.changed != '0'
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

      - run: supabase db push --include-all
        if: steps.migrations.outputs.changed != '0'
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

env:
  SUPABASE_PROJECT_ID: tsphkmbtnahjgsivdhaj
```

**Criterio de aceptación:**
- [ ] Push con migraciones + CI fallido → migrate-staging NO se ejecuta
- [ ] Push con migraciones + CI exitoso → migrate-staging aplica la migración
- [ ] Push sin migraciones + CI exitoso → migrate-staging se salta el db push
- [ ] `workflow_dispatch` manual sigue funcionando

---

### TASK-78 — CONTRIBUTING.md: actualizar convención de commits

**Descripción:** `CONTRIBUTING.md` define `[MODULO] Description` como formato de commit. `AGENTS.md` define `Sprint N: type(scope): mensaje`. Son incompatibles. Actualizar CONTRIBUTING.md para que sea coherente.

**Archivos:** `.github/CONTRIBUTING.md`

**Criterio de aceptación:**
- [ ] CONTRIBUTING.md refleja el formato `Sprint N: type(scope): mensaje`
- [ ] Ejemplos actualizados (eliminar `[LISTA-COMPRA]`, `[RECETAS]`, etc.)
- [ ] Branch strategy y PR process siguen siendo correctos (no cambiar)

---

## Rama del sprint

```
sprint/7-cicd-pipeline
```

## Estimación

| TASK | Descripción | Esfuerzo |
|---|---|---|
| TASK-75 | ci.yml: trigger + concurrency | XS (2 líneas) |
| TASK-76 | ci.yml: tsc explícito | XS (1 línea) |
| TASK-77 | migrate-staging: gate CI | S (reescritura del trigger + job condition) |
| TASK-78 | CONTRIBUTING.md actualizado | XS (texto) |

Total estimado: **~1h**
