# ADR 0010 — Entornos y ramas: `staging` y `main` como ramas desplegables

**Fecha:** 2026-11-08
**Estado:** Aceptada
**Decisora:** usuario (rferic), en conversación de diseño
**Sustituye:** la rama placeholder `production`, la nota «*Production Branch* → `main` al cierre de sprint-08-core-base» ([`cicd.md`](../flows/cicd.md#b-conectar-vercel) paso 4 y [`infrastructure.md`](../infrastructure.md#9-producción--activación-sprint-13) paso 3), y la pausa de despliegue por falta de Core ([`cicd.md`](../flows/cicd.md#despliegues)).
**Base:** [`cicd.md`](../flows/cicd.md) · [`git.md`](../flows/git.md) · [`infrastructure.md`](../infrastructure.md) · [`release.md`](../flows/release.md)

## Contexto

El modelo anterior tenía una única rama desplegable (`main`) y una rama placeholder
`production` que existía solo porque Vercel exige una *Production Branch*; los merges a `main`
generaban únicamente previews y el despliegue a producción estaba **en pausa** hasta que
existiera un Core funcional (decisión del usuario, 2026-10-25). Supabase solo tenía el
proyecto `027apps-dev`.

Ese Core ya existe y hay que activar producción. El usuario decide un modelo de **dos ramas
desplegables con deploy automático** que separa lo que se prueba (`staging`) de lo que se
sirve a la familia (`main`), con un proyecto Supabase por entorno y una regla dura: nada
llega a producción sin pasar por `staging`.

Dos límites del plan gratuito condicionan la decisión:

- **Vercel Hobby no permite entornos *custom*** (solo Pro/Enterprise). El equivalente válido
  en Hobby es una **rama asignada al entorno Preview** con dominio y variables por rama.
- **Supabase Free permite 2 proyectos activos** (los pausados no cuentan). *Branching* de
  Supabase (entorno por PR) requiere **Pro+**.

## Decisión

Se adopta un modelo de dos ramas desplegables con deploy automático:

| Rama | Vercel | Dominio | Supabase | Deploy |
|---|---|---|---|---|
| `sprint/*`, `fix/*` (PR) | Preview | URL del deployment | `027apps-dev` | automático |
| **`staging`** | Preview con variables por rama | `staging.027apps.ericrf.com` | `027apps-dev` | automático al mergear |
| **`main`** | Production | `027apps.ericrf.com` | `027apps-prod` | automático al mergear |

1. **`main` es producción.** No existe rama `develop`. La rama placeholder `production` se
   **elimina** y el *Production Branch* de Vercel pasa a `main`.
2. **Flujo de promoción:** rama de trabajo → PR a `staging` (deploy automático a staging) →
   pruebas → PR `staging → main` → deploy automático a producción.
3. **Regla dura:** nada llega a `main` sin haber pasado por `staging`.
4. **Anti-divergencia:** tras cada release, `main` se sincroniza hacia `staging` (merge
   `main → staging`).
5. **Tags `vX.Y.Z`** sobre `main` = releases que despliegan otras familias autoalojadas y el
   momento en que CI firma el APK.
6. **Migraciones:** `staging` aplica sobre `027apps-dev`; `main` aplica sobre `027apps-prod`
   en un job protegido por el Environment de GitHub `production` con *required reviewer*.

## Alternativas consideradas

- **GitFlow con `develop`:** descartado — añade una tercera rama de larga vida y un modelo de
  releases por rama que no aporta nada a una instancia familiar con un solo desarrollador; el
  par `staging`/`main` cubre la separación prueba/producción con menos superficie.
- **Promoción manual en Vercel (*staged production deployment*):** descartado — el usuario
  quiere deploy automático al mergear; la promoción manual reintroduce un paso propenso a
  olvido y rompe el determinismo «el merge es el deploy».
- **Entornos custom de Vercel:** descartado — requieren plan **Pro**. En Hobby, el equivalente
  es la rama `staging` asignada al entorno Preview con dominio y variables por rama.
- **Supabase Branching (entorno por PR):** descartado — requiere **Pro+**; con Free (2
  proyectos) se usa un proyecto por entorno (`027apps-dev` y `027apps-prod`).

## Consecuencias

- `docs/flows/cicd.md`, `docs/flows/git.md`, `docs/flows/release.md`, `docs/infrastructure.md`
  y `AGENTS.md` se alinean con este modelo (tarea 01 del sprint 13).
- Se crean el proyecto Supabase `027apps-prod`, las variables de producción en Vercel y el job
  de migraciones por entorno.
- `staging` queda asignado al dominio `staging.027apps.ericrf.com` y **protegido** (decisión
  del usuario, 2026-11-09, ver spec §3 y §A.5): con *Standard Protection* la familia no
  accede a staging en Hobby; lo prueba el propietario y los agentes usan *Protection Bypass
  for Automation*.
- La contraseña de la BD de `027apps-dev` se rotará al crear la de producción (se compartió
  por chat el 2026-10-27).
- El backup cifrado y el keep-alive, antes bloqueados en `sprint-11-prod-activation`, se
  absorben en este sprint contra `027apps-prod`.

## Enmienda (2026-11-10)

- **Plan B de staging**: `staging.027apps.ericrf.com` **no se asigna**. En Hobby, *Standard
  Protection* no cubre dominios custom, así que staging se usa por el alias de rama
  `027apps-git-staging-eric-rf.vercel.app`, que sí queda protegido.
- **Métodos de merge**: `protect-staging` admite `squash` y `merge`. Los PRs de trabajo se
  squash-mergean; la promoción `staging → main` y la sincronización `main → staging` usan
  merge commit para conservar el historial compartido.
