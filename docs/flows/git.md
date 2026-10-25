# Flujo: git

Cómo se organiza el trabajo en ramas, cómo entra a `main` y cómo se versiona. Define el modelo de ramas, la integración, la protección de `main` y la relación de tags con `main`. Complementa [`cicd.md`](cicd.md) (gates y despliegues) y [`release.md`](release.md) (versiones y APK); aquí solo el flujo de git. Las reglas operativas están en [`AGENTS.md`](../../AGENTS.md#git); este flujo las ordena y concreta.

## 1. Modelo: un sprint = un concepto

**Un sprint es un concepto completo y concreto** (ej. "Definición del modelo de tokens", "Design System v1"). No es un time-box: es una unidad de trabajo que entra a `main` como un todo. Un sprint **no** mezcla varios conceptos; si el trabajo son varios conceptos independientes, son varios sprints (aunque compartan número, ej. `sprint/02-branding` y `sprint/02-design-system`).

- **Una rama por sprint:** `sprint/NN-<slug-del-concepto>` (ej. `sprint/03-token-model`), creada desde `main`.
- **Commits por tarea** dentro de la rama: cada tarea del sprint (con su fichero en `docs/tasks/sprint-NN/`) deja su commit o commits propios, en Conventional Commits (`feat`, `fix`, `docs`, `chore`, `ci`, `refactor`, `test`, `perf`, `build`). Una tarea puede estar "inacabada" a mitad de sprint: es una pieza interna, no un punto de integración.
- **Un PR por sprint**, **abierto en draft desde el arranque** y pasado a listo al cierre. El PR del sprint es la presentación del concepto completo en GitHub: sus commits por tarea quedan visibles como el histórico del concepto, y tenerlo abierto en draft desde el inicio es lo que activa el CI continuo (ver §2).

## 2. Calidad: por tarea; integración: por sprint

- **CI continuo en el PR del sprint (en draft):** los gates (`admin`, `android`, `guard-secrets`, `commitlint`) corren en cada push a la rama del sprint porque el PR está abierto en draft ([`cicd.md`](cicd.md)). La rama se mantiene en verde mientras se construye; el sprint no se pasa a listo ni se mergea si no está en verde. (El CI del repo solo se dispara en `pull_request`, push a `main` y tags `v*`; un PR en draft es lo que hace que los push a la rama del sprint corran los checks.)
- **QA con ojos nuevos y auditoría de seguridad OWASP por tarea**, antes de marcar esa tarea `finalizada` ([`definition-of-done.md`](../conventions/definition-of-done.md)). La calidad no se aplaza al merge: se aplica a cada tarea en su momento, mientras el autor tiene la intención fresca.
- **El merge del PR del sprint es la puerta de integración:** cuando todas las tareas del sprint están `finalizada` (QA + auditoría) en la rama, el usuario acepta el conjunto y el PR se mergea. Ver la nota provisional de [`feature.md`](feature.md#pasos).

## 3. Integración a `main`

- **Squash merge:** el título del PR es el mensaje del commit en `main` (validado por `commitlint`). El PR del sprint se convierte en **un solo commit** en `main`.
- `main` **siempre desplegable**: cada merge deja `main` en verde y con el concepto completo integrado. No hay merge de piezas a medias.
- **Nunca** commits directos a `main`, force-push ni reescritura de historia compartida sin orden explícita del usuario (`AGENTS.md`).
- Un sprint nuevo empieza desde `main` actualizado (nunca desde la rama del sprint anterior salvo que el concepto lo requiera y se documente).

## 4. Protección de `main` (puerta de usuario / admin)

Proteger `main` en GitHub (*Settings → Branches* o un ruleset), exigiendo:

- PR obligatorio (sin commits directos) y aprobación del propietario en el PR del sprint.
- Checks requeridos: `admin`, `android`, `guard-secrets`, `commitlint` y el check de Vercel cuando esté conectado ([`cicd.md`](cicd.md#pendiente-de-ejecución-puerta-de-usuario)).
- Sin force-push ni borrado de `main`.

Es acción de administrador del repositorio; no la puede ejecutar un agente. Hasta que esté activa, la disciplina la impone `AGENTS.md` (rama de trabajo, un PR por concepto, squash, sin merge sin orden del usuario).

## 5. Tags y releases

- Los **tags se crean siempre sobre commits de `main`**, nunca sobre ramas. Un tag `v*` dispara el job `release` del CI ([`cicd.md`](cicd.md#distribución-android-y-actualizaciones)), que verifica que el commit etiquetado es ancestro de `main`.
- La secuencia por versión: integrar el/los sprint(s) a `main` → tag sobre el commit de `main` → CI firma y publica el APK → enlace de Releases.
- El `CHANGELOG.md` (generado desde commits/releases, pendiente de su tarea propia) se alimenta de los commits de `main`, no de ramas.

## 6. Hotfix y bugfix

- **Bugfix:** rama `fix/*` desde `main`, PR contra `main`, mismos gates, squash merge. Con rama de sprint en curso, se integra a `main` (y se rebasea en la rama del sprint si hace falta, con orden del usuario).
- **Hotfix (producción rota):** lo más rápido y seguro es `git revert` del commit en `main` ([`cicd.md`](cicd.md#rollback)) o una rama `fix/*` con PR; los gates de CI no se saltan ([`hotfix.md`](hotfix.md)).
