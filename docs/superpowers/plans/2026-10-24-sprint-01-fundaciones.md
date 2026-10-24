# Sprint 1 — Fundaciones: Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar el proyecto 027Apps fundado: repositorio público con monorepo (admin Next.js + app Android Kotlin), el flujo CI/CD definido de extremo a extremo e implementado por partes (incluida la distribución del APK Android firmado), convenciones ejecutables (AGENTS.md, linters, flujos, responsabilidades) e identidad visual elegida con tokens base implementados.

**Architecture:** Monorepo pnpm con `apps/admin` (Next.js 16, App Router, solo administración), `apps/android` (Kotlin + Jetpack Compose, APK por enlace) y `packages/*` para contratos y tokens. CI en GitHub Actions con gates; preview/prod del admin vía Vercel. Definiciones vivas en `docs/` — nada de convenciones en memoria.

**Tech Stack:** Next.js 16 + React + TypeScript strict · Kotlin + Jetpack Compose + Gradle (version catalog) · Tailwind CSS v4 · pnpm workspaces · Vitest · GitHub Actions · Vercel · Supabase (conexión, sin lógica de producto).

**Spec:** `docs/superpowers/specs/2026-10-24-027apps-design.md` — el plan discute desde la spec; los ejecutores leen ambas.

## Global Constraints

- Repo **público** en `github.com/rferic/027apps`; licencia **MIT** (el repo antiguo `rferic/027apps` se renombra a `027apps-legacy` y se archiva — SOLO tras confirmación explícita del usuario, ver Task 1).
- Todo commit sigue **conventional commits**; merges squash a `main`; `main` siempre desplegable.
- Infra 100% **free tiers** (GitHub, Vercel, Supabase). Sin cuentas de pago.
- TypeScript **strict** en `apps/admin`; Kotlin con version catalog (`gradle/libs.versions.toml`), versiones estables más recientes en el momento del scaffold, registradas ahí.
- **Prohibido hardcodear colores** en UI del admin: solo tokens semánticos (en Android scaffold se usa el tema Material3 por defecto hasta que existan tokens propios).
- Idiomas objetivo de i18n (es/ca/en/it) — la infraestructura i18n llega en sprint posterior; en este sprint no se introduce texto de producto más allá del nombre de la app.
- El usuario humano **no revisa código**: revisa specs, decisiones y previews. Las puertas de usuario del sprint están marcadas como **[PUERTA USUARIO]**.
- Estados de tarea (`pendiente`/`en curso`/`test`/`finalizada`) viven en ficheros de `docs/tasks/` (Task 1 crea los del sprint).

## Review Focus

1. **Forks sin secrets no deben romper CI**: con secrets ausentes, los pasos de deploy/keep-alive se omiten (no fallan). → Test en Task 4: workflow con `if: env.X != ''` verificado en dry-run local + estructura revisada por QA.
2. **Commit/PR fuera de convención debe ser rechazado por máquina**: PR con título no convencional → check rojo. → Test en Task 5 (job `commitlint` en CI).
3. **Build Android reproducible en CI**: versiones fijadas en `libs.versions.toml` + Gradle wrapper; JDK y SDK declarados en el workflow. → Test en Task 4: `./gradlew assembleDebug` verde en runner limpio.
4. **Secretos nunca en git**: `.env*` ignorados; sin claves Supabase en el árbol. → Test en Task 4: step que falla si `git ls-files` contiene `.env` o valores `sbp_`/`supabase` en texto plano.
5. **Dark mode roto por contraste**: los tokens base deben definir par claro/oscuro y la demo debe verse en ambos. → Test en Task 8: tokens con valores para ambos modos + verificación visual en preview.

---

### Task 1: Repositorio, monorepo base y ficheros de tarea

**Files:**
- Create: `README.md`, `LICENSE` (MIT), `.gitignore`, `.editorconfig`, `pnpm-workspace.yaml`, `package.json` (raíz, privado)
- Create: `docs/tasks/sprint-01/*.md` (un fichero por tarea de este sprint, con metadatos de estado)

**Interfaces:**
- Produces: repo git inicializado en `~/Sites/rferic` con remote `origin` → `github.com/rferic/027apps`; estructura `apps/`, `docs/`, `packages/` vacías pero creadas; scripts raíz `pnpm lint` / `pnpm tsc` / `pnpm test` que delegan en workspaces.

- [ ] **Step 1: Verificar prerrequisitos locales**

Run: `git --version && pnpm --version && gh auth status`
Expected: git y pnpm ≥10 disponibles; `gh` autenticado como `rferic`. Si `gh` no está autenticado → **[PUERTA USUARIO]** pedir login.

- [ ] **Step 2: Inicializar git y ficheros raíz**

Crear los ficheros raíz (LICENSE MIT copyright "rferic", `.gitignore` con `node_modules/`, `.env*`, `apps/android/.gradle/`, `apps/android/build/`, `.next/`, coverage, `.DS_Store`), `pnpm-workspace.yaml` con `apps/*` y `packages/*`, `package.json` raíz `private: true` con `packageManager` fijado a la versión local de pnpm y scripts `lint`/`tsc`/`test` que recorran workspaces.

- [ ] **Step 3: Crear ficheros de tarea del sprint**

Un fichero por Task de este plan en `docs/tasks/sprint-01/` con frontmatter: `id`, `titulo`, `area: fundaciones`, `estado: pendiente`, `plan: docs/superpowers/plans/2026-10-24-sprint-01-fundaciones.md`.

- [ ] **Step 4: Commit inicial**

```bash
git init -b main
git add -A
git commit -m "chore: initialize 027apps monorepo"
```

- [ ] **Step 5: [PUERTA USUARIO] Liberar el nombre del repo antiguo**

Preguntar al usuario y, con su sí: `gh repo rename 027apps-legacy --repo rferic/027apps` + archivar el repo antiguo (`gh repo edit rferic/027apps-legacy --archive`).

- [ ] **Step 6: Crear repo público y push**

```bash
gh repo create 027apps --public --source . --remote origin --push
```
Run: `gh repo view rferic/027apps --json name,visibility,licenseInfo`
Expected: nombre `027apps`, `PUBLIC`, licencia MIT.

### Task 2: Scaffold del admin (Next.js 16) con tooling TypeScript

**Files:**
- Create: `apps/admin/**` (scaffold create-next-app), `apps/admin/src/lib/brand.ts`, `apps/admin/src/app/api/health/route.ts`
- Test: `apps/admin/src/lib/brand.test.ts`

**Interfaces:**
- Consumes: estructura del monorepo (Task 1).
- Produces: app admin que compila y responde `/api/health` con `{"status":"ok"}` cuando hay credenciales Supabase (y `{"status":"degraded"}` sin ellas); `APP_NAME` exportado desde `src/lib/brand.ts` usado por el layout; scripts raíz `pnpm --filter admin lint|tsc|test|build` funcionando.

- [ ] **Step 1: Scaffold de la app**

```bash
pnpm create next-app@latest apps/admin --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git --use-pnpm --turbopack
```
Si aparece algún prompt interactivo no cubierto por los flags, elegir las opciones por defecto y registrarlas en el commit. Añadir Vitest (config node) como devDependency del workspace `admin`.

- [ ] **Step 2: Escribir el test que falla**

```ts
// apps/admin/src/lib/brand.test.ts
import { describe, expect, it } from "vitest";
import { APP_NAME } from "./brand";

describe("brand", () => {
  it("expone el nombre de la app", () => {
    expect(APP_NAME).toBe("027Apps");
  });
});
```

- [ ] **Step 3: Ejecutar y verificar fallo**

Run: `pnpm --filter admin test`
Expected: FAIL (`brand.ts` no existe).

- [ ] **Step 4: Implementar `brand.ts` + `/api/health`**

`brand.ts` exporta `APP_NAME = "027Apps"`. `route.ts` hace `select 1` contra Supabase si las env vars existen (cliente `@supabase/supabase-js` creado con service role SOLO en servidor) y responde `{"status":"ok"}` / `{"status":"degraded"}` (503) según resultado. `.env.example` con `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

- [ ] **Step 5: [PUERTA USUARIO] Crear proyecto Supabase free**

Pedir al usuario crear el proyecto (guía en una línea: supabase.com → New project) y pegar las 3 claves en `apps/admin/.env.local`. El ejecutor nunca pide las claves por chat: instruir que el usuario las deje en el fichero.

- [ ] **Step 6: Verificar**

Run: `pnpm --filter admin test && pnpm --filter admin tsc --noEmit && pnpm --filter admin lint && pnpm --filter admin build`
Expected: todo PASS. `curl localhost:3000/api/health` tras `pnpm --filter admin dev` → `{"status":"ok"}`.

- [ ] **Step 7: Commit**

```bash
git add apps/admin pnpm-lock.yaml
git commit -m "feat(admin): scaffold Next.js 16 with health endpoint and tooling"
```

### Task 3: Scaffold Android (Kotlin + Jetpack Compose)

**Files:**
- Create: `apps/android/settings.gradle.kts`, `apps/android/build.gradle.kts`, `apps/android/gradle/libs.versions.toml`, `apps/android/app/build.gradle.kts`, `apps/android/app/src/main/AndroidManifest.xml`, `apps/android/app/src/main/java/com/rferic/zero27apps/MainActivity.kt`, `apps/android/gradle/wrapper/*`
- Test: `apps/android/app/src/test/java/com/rferic/zero27apps/ServerUrlTest.kt`

**Interfaces:**
- Consumes: estructura del monorepo (Task 1).
- Produces: `./gradlew assembleDebug` genera `app/build/outputs/apk/debug/app-debug.apk`; util `ServerUrl.normalize(raw: String): String?` (valida http(s), recorta `/` final, devuelve null si inválida) que la app usará para la URL de instancia; aplicación con `applicationId com.rferic.zero27apps` que muestra el nombre de la app en Compose.

- [ ] **Step 1: Crear el esqueleto Gradle del proyecto**

Ficheros de `Files:` con version catalog (Kotlin 2.x + compose plugin, AGP estable, minSdk 26, targetSdk/compileSdk latest stable, JDK 17 toolchain), `applicationId com.rferic.zero27apps`. Generar wrapper con `gradle wrapper --gradle-version <última estable>` (instalar Gradle vía Homebrew si no existe) y registrar la versión en el commit. Sin código de app aún más allá del mínimo compilable (manifest vacío válido).

- [ ] **Step 2: Escribir el test que falla (Kotlin)**

`ServerUrlTest.kt`: `normalize("https://mi-instancia.vercel.app/")` == `"https://mi-instancia.vercel.app"`; `normalize("ftp://x")` == null; `normalize("https://x")` == `"https://x"`.

- [ ] **Step 3: Ejecutar y verificar fallo**

Run: `cd apps/android && ./gradlew :app:testDebugUnitTest`
Expected: compilación falla (`ServerUrl` no existe).

- [ ] **Step 4: Implementar `ServerUrl` y `MainActivity`**

`ServerUrl` como objeto con la función del test. `MainActivity` con `setContent { MaterialTheme { Text(APP_NAME) } }` — `APP_NAME = "027Apps"` como constante local (los tokens de marca llegan con el DS; tema Material3 por defecto, sin colores custom hardcodeados).

- [ ] **Step 5: Verificar**

Run: `cd apps/android && ./gradlew :app:testDebugUnitTest :app:assembleDebug`
Expected: tests PASS, APK generado.

- [ ] **Step 6: Commit**

```bash
git add apps/android
git commit -m "feat(android): scaffold Kotlin Compose app with ServerUrl validation"
```

### Task 4: Flujo CI/CD de extremo a extremo (definido completo, implementado por partes) y distribución Android

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/keep-alive.yml`, `docs/flows/cicd.md`, `apps/android/keystore/README.md` (instrucciones, NUNCA el keystore)
- Modify: `apps/android/app/build.gradle.kts` (signing config desde env)

**Interfaces:**
- Consumes: scripts `pnpm --filter admin ...` (Task 2), `./gradlew` (Task 3), convención de commits (Task 5 habilita el job `commitlint`; crear el job aquí y quedará en rojo→verde al aterrizar Task 5; si Task 5 no ha aterrizado, dejar el job deshabilitado con comentario).
- Produces: `docs/flows/cicd.md` — la definición completa del flujo (triggers, gates, secretos, migraciones, rollback, degradación en forks, distribución Android y actualizaciones); en cada PR y push a `main` — checks `admin` (install/lint/tsc/test/build), `android` (testDebugUnitTest + assembleDebug + assembleRelease firmado + artifact), `guard-secrets`; APK de release firmado publicado en GitHub Releases cuando se marca un tag `v*`; deploys Vercel (preview en PR, prod en merge); `keep-alive.yml` diario que hace ping SOLO si existe el secret `PROD_URL`.

**Definición que el flujo documenta (resumen):** todo lo que entra a `main` pasa gates mecánicos; preview por PR; producción solo desde `main` verde; migraciones Supabase se aplican tras el deploy del admin y antes del keep-alive; rollback = revert del commit de main; forks sin secrets ejecutan solo gates locales y omiten deploy/keep-alive/migraciones sin fallar; el APK de release se firma con un keystore que vive SOLO en GitHub Secrets (base64) y su backup en el gestor de contraseñas del usuario; la distribución familiar es un enlace de descarga (GitHub Release), y el flujo de "nueva versión" es: tag → CI firma y publica → los usuarios instalan la nueva APK.

- [ ] **Step 1: Redactar `docs/flows/cicd.md` con la definición anterior** (extender, no resumir: cada paso con quién lo ejecuta y qué lo verifica).

- [ ] **Step 2: Workflow CI**

Jobs con runners `ubuntu-latest`: `admin` (pnpm install frozen lockfile → lint → tsc → test → build), `android` (setup-java 17 temurin → gradle/actions/setup-gradle → `:app:testDebugUnitTest :app:assembleDebug` → upload artifact), `guard-secrets` (falla si `git ls-files` incluye `.env.local` o encuentra patrones `sbp_`/`service_role` en el árbol). Pasos dependientes de secrets protegidos con `if:` sobre env vacía (Review Focus #1). Job de release `on: push: tags: ['v*']` que ensambla y firma el release APK con el keystore de secrets y publica GitHub Release.

- [ ] **Step 3: Keystore de release + firma en Gradle**

**[PUERTA USUARIO]**: generar keystore local (`keytool -genkeypair`, validez larga), subirlo como secret `ANDROID_KEYSTORE_BASE64` con sus contraseñas (`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`) e instruir al usuario para guardar una copia del keystore y las contraseñas en su gestor de contraseñas — si se pierde, no habrá actualizaciones firmadas. `build.gradle.kts` lee la config de firma de env y solo firma cuando las 4 variables existen.

- [ ] **Step 4: [PUERTA USUARIO] Conectar Vercel**

Guía al usuario para conectar el repo en Vercel (import project → root `apps/admin`) y añadir las env vars del proyecto Supabase. Verificar: PR de prueba → preview deploy visible; merge → producción.

- [ ] **Step 5: Verificar en PR real**

Abrir PR con un cambio trivial (p. ej. typo en README): todos los checks en verde, artifact `apk-debug` presente, preview de Vercel desplegado. Un push a main despliega producción.

- [ ] **Step 6: Verificar la distribución Android de extremo a extremo**

Crear tag `v0.1.0-sprint1` → CI publica GitHub Release con APK firmado → descargar el APK desde el enlace e instalarlo en un dispositivo Android (del usuario o emulador) → app abre y muestra "027Apps".

- [ ] **Step 7: Commit**

```bash
git add .github docs/flows/cicd.md apps/android
git commit -m "ci: end-to-end cicd flow with signed Android APK distribution"
```

### Task 5: Convenciones ejecutables — AGENTS.md, clean code y enforcement

**Files:**
- Create: `AGENTS.md`, `docs/conventions/code-style.md`, `docs/conventions/definition-of-done.md`, `.commitlintrc.json` (o equivalente), ajustes a `apps/admin/eslint.config.mjs`
- Modify: `.github/workflows/ci.yml` (habilitar job `commitlint` de PR titles)

**Interfaces:**
- Consumes: CI (Task 4).
- Produces: `AGENTS.md` cargable por cualquier sesión/skill con obligaciones por tipo de tarea; reglas ESLint propias activas (fail en CI); PR titles validados por commitlint.

- [ ] **Step 1: Redactar `AGENTS.md`**

Secciones: misión de 3 líneas; mapa de docs (qué leer y en qué orden); obligaciones por tipo de tarea (feature/bugfix/docs/infra) con checklist obligatoria pre-commit; regla de contextos inyectados para subagentes; puntero a `docs/conventions/*` y flujos.

- [ ] **Step 2: Reglas de clean code + ESLint propio**

`code-style.md`: naming, estructura de carpetas, patrones permitidos/prohibidos (p. ej. sin colores hardcodeados, sin strings de UI sin clave i18n cuando exista i18n, validación con zod en bordes de API), límites de complejidad. Configurar reglas ESLint que las fuerzen donde sea posible (regla custom o `no-restricted-syntax` para colores Tailwind no semánticos en el admin).

- [ ] **Step 3: Definition of Done**

`definition-of-done.md` por tipo de tarea: código (tests + lint + CI verde + QA ojos nuevos + **auditoría de seguridad OWASP antes de `finalizada`**), docs (revisada por segundo agente), diseño (mockup aceptado por usuario).

- [ ] **Step 4: Habilitar commitlint en CI**

Config conventional; job que valida el título del PR.

- [ ] **Step 5: Verificar el rechazo mecánico**

Abrir PR de prueba con título `update stuff`: el check `commitlint` debe FALLAR; renombrar el PR a `docs: update readme` y verificar que pasa. Eliminar el PR de prueba si ya no aporta.

- [ ] **Step 6: Commit**

```bash
git add AGENTS.md docs/conventions .commitlintrc.json apps/admin/eslint.config.mjs .github
git commit -m "docs: executable conventions with lint and commitlint enforcement"
```

### Task 6: Flujos de trabajo y responsabilidades de agentes

**Files:**
- Create: `docs/flows/feature.md`, `docs/flows/bugfix.md`, `docs/flows/hotfix.md`, `docs/flows/release.md`, `docs/flows/new-module.md` (esqueleto: se completa con el instalador del Core), `docs/flows/agents.md`

**Interfaces:**
- Consumes: `AGENTS.md` (Task 5) para referenciarse mutuamente.
- Produces: cada flujo como lista de pasos numerada con puertas y responsables; `agents.md` con el mapa orquestador/implementador/QA/estilo/seguridad/traductor y qué le llega al usuario en cada paso.

- [ ] **Step 1: Redactar los flujos**

`feature.md` refleja el SDD de la spec (spec → plan → TDD → QA ojos nuevos → PR squash → preview). Cada flujo nombra: quién ejecuta, quién revisa, qué verificación mecánica aplica, qué decide el usuario.

- [ ] **Step 2: Mapa de responsabilidades**

`agents.md`: tabla rol → responsabilidad → artefacto que produce → quién valida su salida. Incluir la regla de contexto inyectado desde ficheros y "determinismo antes que agentes".

- [ ] **Step 3: Verificación cruzada**

Un subagente de revisión lee `AGENTS.md` + flujos y comprueba: sin contradicciones, cada puerta de usuario explícita, cada flujo termina con criterio de cierre. Corregir lo que señale.

- [ ] **Step 4: Commit**

```bash
git add docs/flows
git commit -m "docs: workflows and agent responsibility map"
```

### Task 7: Identidad visual y branding — direcciones y elección [PUERTA USUARIO]

**Files:**
- Create: `docs/brand/identities/{a,b,c}.md` (una por dirección: paleta, tipografía, tono, dirección de logo), `docs/brand/brand.md` (la elegida), `docs/superpowers/specs/2026-10-24-brand-decision.md` (mini-ADR)

**Interfaces:**
- Consumes: nombre "027Apps"; contexto de producto (familia, admin web + app Android).
- Produces: decisión de identidad registrada que Task 8 implementa; insumos para logo/icono/splash (tarea de branding completa en sprint 2).

- [ ] **Step 1: Proponer 2–3 direcciones distinguibles**

Cada dirección: paleta con roles semánticos (no solo colores), propuesta tipográfica, personalidad/tone-of-voice en una frase, y 1 pantalla de muestra del admin renderizada con esa dirección (mockup HTML para comparar en el navegador). Nada de assets finales de logo aún.

- [ ] **Step 2: [PUERTA USUARIO] Presentar y elegir**

Mostrar side-by-side al usuario (companion visual) y registrar su elección y porqué.

- [ ] **Step 3: Documentar la decisión**

`brand.md` con la dirección elegida (paleta con valores hex por rol claro/oscuro, tipografía con fallbacks, tono) + ADR corto del porqué.

- [ ] **Step 4: Commit**

```bash
git add docs/brand docs/superpowers/specs/2026-10-24-brand-decision.md
git commit -m "docs: brand identity decision"
```

### Task 8: Tokens de diseño base en el admin (según identidad elegida)

**Files:**
- Create: `apps/admin/src/design-tokens.css`, `apps/admin/tokens.json`
- Modify: `apps/admin/src/app/globals.css`, `apps/admin/src/app/page.tsx`

**Interfaces:**
- Consumes: identidad elegida (Task 7); app admin (Task 2).
- Produces: tokens semánticos (color por rol, espaciado, radios) definidos para claro/oscuro en CSS variables + `tokens.json` espejo para el futuro consumo de Android; página demo que usa solo tokens.

- [ ] **Step 1: Definir tokens y su espejo JSON**

Roles mínimos: `background`, `surface`, `foreground`, `muted`, `primary`, `primary-foreground`, `border`, `destructive` — valores de Task 7 para light y dark. `tokens.json` con la misma información (fuente única exportable).

- [ ] **Step 2: Página demo con solo tokens**

`page.tsx` muestra: fondo, tarjeta con texto, botón primario, botón destructivo — todo vía clases semánticas de Tailwind mapeadas a las variables. Verificación visual en preview en claro y oscuro (Review Focus #5): contraste correcto en ambos.

- [ ] **Step 3: Verificar**

Run: `pnpm --filter admin lint && pnpm --filter admin tsc --noEmit && pnpm --filter admin build`
Expected: PASS. Revisión de estilo (subagente): cero colores fuera de tokens en el diff.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/design-tokens.css apps/admin/tokens.json apps/admin/src/app
git commit -m "feat(admin): semantic design tokens for light and dark"
```

---

## Cierre del sprint

Al terminar las 8 tareas: **auditoría de seguridad** (subagente de seguridad, checklist OWASP adaptado al sprint — esta fase es infra, así que foco en secretos, permisos de workflows, exposición de endpoints y la cadena de firma del APK) + QA con ojos nuevos sobre la rama, marcar todas las tareas como `finalizada` en `docs/tasks/sprint-01/` (o devolver al backlog las que queden), squash merge a `main`, y resumen para el usuario con: qué quedó, enlaces a preview/APK y las decisiones pendientes para el sprint 2 (resto de definiciones: estrategia de testing, seguridad/OWASP, i18n pipeline, componentes DS, branding completo).
