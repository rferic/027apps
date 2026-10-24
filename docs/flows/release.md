# Flujo: release

Cómo se versiona y publica una versión de la app Android. **La mecánica (jobs, secrets, firma, verificación extremo a extremo, rollback) vive en [`cicd.md`](cicd.md#distribución-android-y-actualizaciones)**; aquí solo se define el orden de decisiones y quién hace qué. El admin web no tiene releases versionadas: cada merge a `main` despliega producción (ver [`cicd.md`](cicd.md#despliegues)).

## Versionado (semver)

- Versiones `MAJOR.MINOR.PATCH` ([semver](https://semver.org/lang/es/)): `fix` → PATCH, `feat` → MINOR, cambio incompatible (`!` / `BREAKING CHANGE`) → MAJOR. El tipo sale de los commits convencionales mergeados desde la versión anterior.
- `versionName` = `X.Y.Z`; `versionCode` es un entero que **siempre sube** (Android no permite bajar). Ambos en `apps/android/app/build.gradle.kts`.
- Tag `vX.Y.Z`. Un tag con `-` (p. ej. `v0.1.0-sprint1`) se publica como pre-release.

## Pasos

| # | Paso | Ejecuta | Revisa / verifica | Decide el usuario |
|---|---|---|---|---|
| 1 | **Proponer versión**: resumen de cambios desde el último tag y número semver resultante | Orquestador | Commits convencionales desde el último tag | **Puerta: aprueba publicar y la versión** |
| 2 | **Subir `versionCode` y `versionName`** en una rama `chore/*`, PR con título `chore(release): vX.Y.Z`, flujo de [`feature.md`](feature.md) (tipo infra/config) | Implementador | CI (`admin`, `android`, `guard-secrets`, `commitlint`); QA y auditoría según DoD | **Puerta: orden de merge** |
| 3 | **Crear y empujar el tag** sobre el commit de `main` mergeado: `git tag vX.Y.Z && git push origin vX.Y.Z` | Orquestador | — | **Puerta: orden explícita** (el tag publica un binario instalable) |
| 4 | **Job `release`**: espera los gates, comprueba secrets, compila `assembleRelease` firmado, `apksigner verify`, crea el GitHub Release con la APK y notas autogeneradas | GitHub Actions | Falla si falta un secret, si la firma no verifica o si no hay APK ([cicd.md](cicd.md#flujo-nueva-versión)) | — |
| 5 | **Verificación extremo a extremo**: descargar la APK del Release, comprobar el certificado propio, instalar y abrir la app ([cicd.md](cicd.md#verificación-de-extremo-a-extremo-tag--instalación)) | Orquestador (o el usuario en dispositivo) | `apksigner verify --print-certs` | **Puerta: acepta la APK instalada** |
| 6 | **Comunicar**: enlace `https://github.com/rferic/027apps/releases/latest` a los usuarios | Usuario | — | El usuario avisa a su familia |

Release malo: se corrige con un tag nuevo de `versionCode` mayor, no se reescribe el anterior ([Rollback](cicd.md#rollback)). Hotfix de una release: [`hotfix.md`](hotfix.md).

## Changelog

- Hoy: las **notas del GitHub Release se autogeneran** desde los commits/PRs mergeados (`gh release create`, ver [cicd.md](cicd.md#flujo-nueva-versión)). Como el squash merge usa el título del PR como commit, los títulos convencionales son la fuente del changelog.
- **TODO:** `CHANGELOG.md` en la raíz generado desde releases/commits (la spec exige que no se edite a mano). Aún no existe ni su generador; se define en una tarea propia del backlog. Hasta entonces el changelog es la página de Releases.

## Puerta previa (una sola vez)

Hasta que el usuario cree el keystore y suba los secrets ([cicd.md, sección A](cicd.md#a-keystore-de-release-y-secrets-de-github)) el job `release` falla en el repo original: ningún tag real se publica antes.

## Flujo de git (pendiente de decisión)

**Sin decidir:** el modelo de ramas — rama por sprint (con commits por tarea y un PR único, patrón del sprint 01) frente a rama por tarea —, además de protección de `main` y relación de tags con `main`. Es el elemento «Flujo de git» del backlog de la [spec de diseño §11](../superpowers/specs/2026-10-24-027apps-design.md) y debe documentarse en `docs/flows/git.md` antes del Core. Hasta entonces rigen las reglas de [`AGENTS.md`](../../AGENTS.md#git): rama de trabajo (no `main`), un PR por cambio, squash merge, sin merge ni force push sin orden del usuario. Estos flujos no asumen el modelo: donde dicen «PR» y «merge», valen para ambos.

## Criterio de cierre

La release está cerrada cuando existe el GitHub Release con la APK firmada, `apksigner verify` muestra el certificado propio, la APK se instaló sobre un dispositivo y abre, y el usuario lo ha aceptado.
