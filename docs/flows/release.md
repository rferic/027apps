# Flujo: release

Cómo se versiona y publica una versión de la app Android. **La mecánica (jobs, secrets, firma, verificación extremo a extremo, rollback) vive en [`cicd.md`](cicd.md#distribución-android-y-actualizaciones)**; aquí solo se define el orden de decisiones y quién hace qué. El admin web no tiene releases versionadas: cada merge a `main` despliega producción (ver [`cicd.md`](cicd.md#despliegues)).

## Versionado (semver)

- Versiones `MAJOR.MINOR.PATCH` ([semver](https://semver.org/lang/es/)): `fix` → PATCH, `feat` → MINOR, cambio incompatible (`!` / `BREAKING CHANGE`) → MAJOR. El tipo sale de los commits convencionales mergeados desde la versión anterior.
- `versionName` = `X.Y.Z`; `versionCode` es un entero que **siempre sube** (Android no permite bajar). Ambos en `apps/android/app/build.gradle.kts`.
- Tag `vX.Y.Z`. Un tag con `-` (p. ej. `v0.1.0-sprint1`) se publica como pre-release.
- **TODO:** automatizar el versionado (calcular el semver desde los commits y subir `versionName`/`versionCode`). Hoy es manual: lo propone el orquestador (paso 1) y lo aplica el implementador (paso 2).

## Pasos

| # | Paso | Ejecuta | Revisa / verifica | Decide el usuario |
|---|---|---|---|---|
| 1 | **Proponer versión**: resumen de cambios desde el último tag y número semver resultante | Orquestador | Commits convencionales desde el último tag | **Puerta: aprueba publicar y la versión** |
| 2 | **Subir `versionCode` y `versionName`** en una rama `chore/*`, PR con título `chore(release): vX.Y.Z`, flujo de [`feature.md`](feature.md) (tipo infra/config); **la puerta del paso 1 sustituye a la de spec/plan** en los bumps de versión | Implementador | CI (`admin`, `android`, `guard-secrets`, `commitlint`); QA y auditoría según DoD | **Puerta: orden de merge** |
| 3 | **Crear y empujar el tag** sobre el commit de `main` mergeado: `git tag vX.Y.Z && git push origin vX.Y.Z` | Orquestador | — | **Puerta: orden explícita** (el tag publica un binario instalable) |
| 4 | **Job `release`**: espera los gates, comprueba secrets, compila `assembleRelease` firmado, `apksigner verify`, crea el GitHub Release con la APK y notas autogeneradas | GitHub Actions | Falla si falta un secret, si la firma no verifica o si no hay APK ([cicd.md](cicd.md#flujo-nueva-versión)) | — |
| 5 | **Verificación extremo a extremo**: descargar la APK del Release, comprobar el certificado propio, instalar y abrir la app ([cicd.md](cicd.md#verificación-de-extremo-a-extremo-tag--instalación)) | Orquestador (o el usuario en dispositivo) | `apksigner verify --print-certs` | **Puerta: acepta la APK instalada** |
| 6 | **Comunicar**: enlace `https://github.com/rferic/027apps/releases/latest` a los usuarios | Usuario | — | El usuario avisa a su familia |

Release malo: se corrige con un tag nuevo de `versionCode` mayor, no se reescribe el anterior ([Rollback](cicd.md#rollback)). Hotfix de una release: [`hotfix.md`](hotfix.md).

## Changelog

- Hoy: las **notas del GitHub Release se autogeneran** desde los commits/PRs mergeados (`gh release create`, ver [cicd.md](cicd.md#flujo-nueva-versión)). Como el squash merge usa el título del PR como commit, los títulos convencionales son la fuente del changelog.
- **TODO:** `CHANGELOG.md` en la raíz generado desde releases/commits (la spec exige que no se edite a mano). Aún no existe ni su generador; se define en una tarea propia del backlog. Hasta entonces el changelog es la página de Releases.

## Puerta previa (una sola vez)

Hasta que el usuario cree el keystore y suba los secrets ([cicd.md, sección A](cicd.md#a-protecciones-del-repo-y-solo-después-keystore-y-secrets-de-github)) el job `release` falla en el repo original: ningún tag real se publica antes.

## Flujo de git

El modelo de ramas, la integración a `main`, la protección y los tags se definen en [`git.md`](git.md): un sprint es un concepto (rama `sprint/NN-<concepto>`, commits por tarea, un PR por sprint, squash merge); `main` siempre desplegable y protegido con los checks de [`cicd.md`](cicd.md#pendiente-de-ejecución-puerta-de-usuario); tags siempre sobre commits de `main`. Este flujo (release) solo ordena las decisiones de versionado; la mecánica (jobs, secrets, firma, verificación extremo a extremo, rollback) vive en [`cicd.md`](cicd.md#distribución-android-y-actualizaciones). El admin web no tiene releases versionadas: cada merge a `main` despliega producción (ver [`cicd.md`](cicd.md#despliegues)).

## Criterio de cierre

La release está cerrada cuando existe el GitHub Release con la APK firmada, `apksigner verify` muestra el certificado propio, la APK se instaló sobre un dispositivo y abre, y el usuario lo ha aceptado.
