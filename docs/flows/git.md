# Flujo: git

Cómo se organiza el trabajo en ramas, cómo se promociona de `staging` a `main` y cómo se versiona. Define el modelo de ramas, la integración, la protección de `staging` y `main` y la relación de tags con `main`. Complementa [`cicd.md`](cicd.md) (gates, despliegues y migraciones) y [`release.md`](release.md) (versiones y APK); aquí solo el flujo de git. Las reglas operativas están en [`AGENTS.md`](../../AGENTS.md#git); este flujo las ordena y concreta. Decisión de fondo: [ADR 0010](../adr/0010-entornos-y-ramas.md).

## 1. Ramas y entornos

| Rama | Entorno | Qué recibe |
|---|---|---|
| `main` | Producción (`027apps.ericrf.com`, `027apps-prod`) | Solo PRs `staging → main` y, en emergencia, un `revert` ([§7](#7-hotfix-y-bugfix)) |
| `staging` | Pruebas (`staging.027apps.ericrf.com`, `027apps-dev`) | PRs de las ramas de trabajo |
| `sprint/*`, `fix/*`, `chore/*`, `docs/*` | Preview del PR (`027apps-dev`) | Commits de trabajo |

- `main` y `staging` son las dos únicas ramas de larga vida. **No existe `develop`.** La rama placeholder `production` (que Vercel exigía como *Production Branch*) se **elimina**: el *Production Branch* pasa a `main`.
- **Regla dura: nada llega a `main` sin pasar por `staging`.**
- **Flujo de promoción:** rama de trabajo → PR a `staging` (deploy y migraciones a `027apps-dev`) → pruebas → PR `staging → main` (deploy y migraciones a `027apps-prod`, estas últimas tras la aprobación del *required reviewer*) → merge `main → staging` para sincronizar.

## 2. Modelo: un sprint = un concepto

**Un sprint es un concepto completo y concreto** (ej. "Definición del modelo de tokens", "Design System v1"). No es un time-box: es una unidad de trabajo que entra a `staging` como un todo. Un sprint **no** mezcla varios conceptos; si el trabajo son varios conceptos independientes, son varios sprints (aunque compartan número, ej. `sprint/02-branding` y `sprint/02-design-system`).

- **Una rama por sprint:** `sprint/NN-<slug-del-concepto>` (ej. `sprint/03-token-model`), creada desde `main` actualizado (o desde `staging` si se encadena con un sprint aún no promocionado).
- **Commits por tarea** dentro de la rama: cada tarea del sprint (con su fichero en `docs/tasks/sprint-NN/`) deja su commit o commits propios, en Conventional Commits (`feat`, `fix`, `docs`, `chore`, `ci`, `refactor`, `test`, `perf`, `build`). Una tarea puede estar "inacabada" a mitad de sprint: es una pieza interna, no un punto de integración.
- **Un PR por sprint contra `staging`**, **abierto en draft desde el arranque** y pasado a listo al cierre. El PR del sprint es la presentación del concepto completo en GitHub: sus commits por tarea quedan visibles como el histórico del concepto, y tenerlo abierto en draft desde el inicio es lo que activa el CI continuo (ver §3).

## 3. Calidad: por tarea; integración: por sprint

- **CI continuo en el PR del sprint (en draft):** los gates (`admin`, `android`, `supabase`, `guard-secrets`, `commitlint`, `ai-docs`) corren en cada push a la rama del sprint porque el PR está abierto en draft ([`cicd.md`](cicd.md)). La rama se mantiene en verde mientras se construye; el sprint no se pasa a listo ni se mergea si no está en verde. (El CI del repo se dispara en `pull_request`, en push a `staging` y `main` y en tags `v*`; un PR en draft es lo que hace que los push a la rama del sprint corran los checks.)
- **QA con ojos nuevos y auditoría de seguridad OWASP por tarea**, antes de marcar esa tarea `finalizada` ([`definition-of-done.md`](../conventions/definition-of-done.md)). La calidad no se aplaza al merge: se aplica a cada tarea en su momento, mientras el autor tiene la intención fresca.
- **El merge del PR del sprint a `staging` es la puerta de integración:** cuando todas las tareas del sprint están `finalizada` (QA + auditoría) en la rama, el usuario acepta el conjunto y el PR se mergea a `staging`. Ver la nota provisional de [`feature.md`](feature.md#pasos).

## 4. Integración y promoción

- **PR del sprint → `staging`:** squash merge, con orden explícita del usuario. El título del PR es el mensaje del commit en `staging` (validado por `commitlint`): el sprint se convierte en **un solo commit** en `staging`. Vercel despliega `staging.027apps.ericrf.com` y el job de migraciones aplica a `027apps-dev` ([`cicd.md`](cicd.md#migraciones-supabase)).
- **Pruebas en `staging`** (login, datos de prueba, `/api/health`): las hace el propietario o un agente con *Protection Bypass for Automation*; `staging` está protegido y la familia no accede en Hobby.
- **PR `staging → main`:** **merge commit** (no squash: así `main` contiene los commits de `staging` y la sincronización `main → staging` es trivial), con orden explícita del usuario y los checks en verde. Vercel despliega producción y el job de migraciones de `027apps-prod` queda detrás del Environment `production`: el propietario aprueba antes de que toque datos reales.
- **Sincronización `main → staging`:** tras cada release se hace merge de `main` en `staging` para que no diverja; al ser la promoción un merge commit, no hay conflictos salvo trabajo de `staging` posterior a la promoción.
- `main` **siempre desplegable** y `staging` siempre en verde: cada merge deja la rama con el concepto completo integrado. No hay merge de piezas a medias.
- **Nunca** commits directos a `main` ni a `staging`, force-push ni reescritura de historia compartida sin orden explícita del usuario (`AGENTS.md`).
- Un sprint nuevo empieza desde `main` actualizado (nunca desde la rama del sprint anterior salvo que el concepto lo requiera y se documente).
- **Promoción y sincronización con merge commit.** La promoción `staging → main` y la
  sincronización `main → staging` posterior a cada release se hacen con **merge commit**, no
  con squash: así `main` conserva el historial de `staging` y la siguiente promoción no exige
  rama al día ni bypass de administrador. Los PRs de trabajo (`sprint/*`, `fix/*`…) siguen
  squash-mergeándose a `staging`. El ruleset `protect-staging` admite ambos métodos desde el
  2026-11-10; `main-protection` mantiene los checks requeridos y el *strict up to date*.

## 5. Protección de `staging` y `main` (puerta de usuario / admin)

Es acción de administrador del repositorio; **no la ejecuta un agente** (editar rulesets exige acceso admin). Sí se puede **leer** su estado con `gh api repos/rferic/027apps/rulesets` y `.../rules/branches/<rama>`.

**Estado verificado el 2026-11-09 (lectura con `gh api`), tras ejecutarlo:** `main-protection` (activo) exige PR con 0 aprobaciones, conversaciones resueltas y descarte de aprobaciones obsoletas, sin force-push ni borrado, rama al día, los siete checks y merge por `merge` o `squash`; `protect-staging` (activo) exige lo mismo salvo «rama al día» (solo `squash`); `tags-v-protection` protege los tags `v*`. A nivel de repo: rebase merge desactivado y borrado automático de ramas desactivado. Existen los Environments `staging` (*Deployment branches* = `staging`) y `production` (*required reviewer* = el propietario, *Deployment branches* = `main`), **sin secrets ni variables**. La bypass list de los rulesets no es verificable sin acceso admin.

**Checks requeridos** (los seis jobs de [`ci.yml`](../../.github/workflows/ci.yml) que corren en `pull_request`, más Vercel): `admin`, `android`, `supabase`, `guard-secrets`, `commitlint`, `ai-docs` y el check de Vercel. `release` no es requerido: solo corre en tags.

**Pasos exactos** (para `main`, *editar* `main-protection`; para `staging`, crear `protect-staging`):

1. *Settings → Rules → Rulesets*: en `main`, abrir `main-protection`; en `staging`, *New ruleset → New branch ruleset* con nombre `protect-staging`. *Enforcement status*: **Active**.
2. *Bypass list*: vacía (ni siquiera el propietario se salta el PR; si hace falta una emergencia, edita el ruleset a propósito).
3. *Target branches → Add target → Include by pattern*: `main` (o `staging`).
4. Reglas a marcar: **Restrict deletions**; **Block force pushes**; **Require a pull request before merging**; **Require conversation resolution before merging** (como `main`); **Require status checks to pass** con los siete checks anteriores (el de Vercel se llama `Vercel`). *Require branches to be up to date* está activo en `main`; en `staging` es opcional (añade rebases con una rama larga).
5. *Required approvals*: en `main` hoy es **0** y debe seguir así con un único mantenedor: GitHub no deja aprobar el propio PR y 1 aprobación **bloquearía todo merge**. Solo con un segundo revisor subirlo a 1; mientras tanto, la aprobación del propietario es su orden explícita de merge (no hay revisión humana forzada por GitHub; el control real son el PR, los checks y esa orden) (`AGENTS.md`). En `staging`, 0.
6. *Settings → General → Pull Requests*: dejar activos **squash** y **merge commit** y desactivar **rebase merge** (los métodos efectivos por rama los fija el ruleset, ver «Métodos de merge»), y comprobar que *Automatically delete head branches* está **desactivado** (o que el ruleset de `staging` impide su borrado) para que `staging → main` no borre `staging`.
7. Verificación (solo lectura, sin cookie ni secretos): `gh api repos/rferic/027apps/rules/branches/main --jq '.[].type'` y lo mismo con `staging` deben listar `deletion`, `non_fast_forward`, `pull_request` y `required_status_checks`.

**Métodos de merge (decisión a confirmar):** el ruleset prevalece sobre *Settings → General → Pull Requests*. La promoción `staging → main` está definida como **merge commit** (§4), pero `main-protection` hoy solo permite `squash`, así que ese PR **no se podría mergear**. Para ejecutarlo: en `main-protection`, *Require a pull request → Allowed merge methods* = **merge** y **squash** (squash sigue valiendo para un `revert` de hotfix); en `protect-staging` = **squash** (PRs de sprint y de `fix/*`). Si se prefiere mantener squash también en la promoción, `main` no contendría los commits de `staging` y el merge `main → staging` dejaría de ser trivial (posibles conflictos tras cada release).

**Orden:** los checks solo aparecen en el selector tras haber corrido en el repo (el PR del sprint los ejecuta); el check de Vercel aparece cuando Vercel comenta el primer deployment. Las protecciones van **antes** de subir secretos de firma, de backup o de migraciones ([`cicd.md`](cicd.md#a-protecciones-del-repo-y-solo-después-keystore-y-secrets-de-github)). El ruleset de tags `v*` es independiente (`cicd.md`, paso A.2).

**Contrato de promoción** (resumen; detalle en §1 y §4): rama de trabajo → PR a `staging` → pruebas → PR `staging → main` (merge commit) → merge `main → staging` tras cada release; nada a `main` sin pasar por `staging`.

## 6. Tags y releases

- Los **tags se crean siempre sobre commits de `main`**, nunca sobre ramas. Un tag `v*` dispara el job `release` del CI ([`cicd.md`](cicd.md#distribución-android-y-actualizaciones)), que verifica que el commit etiquetado es ancestro de `main`.
- La secuencia por versión: sprint(s) a `staging` → pruebas → PR `staging → main` → tag sobre el commit de `main` → CI firma y publica el APK → enlace de Releases → merge `main → staging`.
- El `CHANGELOG.md` (generado desde commits/releases, pendiente de su tarea propia) se alimenta de los commits de `main`, no de ramas.

## 7. Hotfix y bugfix

- **Bugfix:** rama `fix/*` desde `main` actualizado, PR contra `staging`, mismos gates, squash merge, y después sigue el flujo de promoción. Con rama de sprint en curso, se integra a `staging` (y se rebasea en la rama del sprint si hace falta, con orden del usuario).
- **Hotfix (producción rota):** lo más rápido y seguro es `git revert` del commit en `main` ([`cicd.md`](cicd.md#rollback)) mediante PR contra `main` y sin saltarse los gates de CI ([`hotfix.md`](hotfix.md)). Es la **única excepción** a «nada a `main` sin pasar por `staging`» (spec §9) y obliga a sincronizar después `main → staging`. Un arreglo hacia delante (no un revert) sí pasa por `staging`.
