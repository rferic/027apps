# Spec — Board: GitHub Issues + etiquetas como fuente única del estado del trabajo

**Fecha:** 2026-11-06 · **Estado:** Borrador para aprobación del usuario
**Base:** [flujo feature](../../flows/feature.md) (spec → plan → implementación con TDD) · [flujo git](../../flows/git.md) (un sprint = un concepto, rama `sprint/NN-<slug>`, un PR por sprint con squash) · [Definition of Done](../conventions/definition-of-done.md) (estados `pendiente` → `en curso` → `test` → `finalizada`) · [spec de API del Core](2026-10-26-core-api.md) (contrato `/api/v1`, envelope de errores, rate limiting) · [ADR 0007](../../adr/0007-manejo-de-errores.md) (errores) · [ADR 0005](../../adr/0005-estado-y-fetching-del-admin.md) (estado y fetching del panel) · [spec de settings por lotes](2026-11-06-settings-batch-write-design.md) (referencia de formato) · [migración settings](../../../supabase/migrations/0002_settings.sql) (catálogo, `is_secret`/`is_public`, cifrado con `SETTINGS_ENCRYPTION_KEY`)

## 1. Objetivo

Convertir **GitHub Issues + etiquetas en la única fuente de verdad del estado del trabajo**, sin romper el flujo SDD/superpowers ni el modelo de ramas/PR. Hoy el estado vive solo en `docs/tasks/**` (frontmatter `estado`) y en las ramas `sprint/NN`; el dueño de la instancia no tiene una vista rápida de qué está abierto, planificado, en curso o cerrado. El panel de control se convierte en un cliente de **lectura rápida** de ese tablero.

**Principio rector:** GitHub Issues es la superficie de estado **visible y agregable**; `docs/tasks/**` y `docs/superpowers/plans/**` siguen siendo el **plan interno** (pasos, TDD, bitácora). Ninguno reemplaza al otro; se sincronizan con reglas deterministas, no con memoria de agente.

## 2. Problema verificado

- El estado del trabajo vive hoy en el frontmatter `estado` de `docs/tasks/sprint-*/task-*.md` (verificado en `docs/tasks/sprint-09-core-data/task-01.md`: `id`, `titulo`, `area`, `estado: finalizada`, `adrs`, `plan`) y en las ramas `sprint/NN-<slug>` de [git.md](../../flows/git.md).
- Un sprint es un concepto (`sprint-09-core-data` con **6 tareas** y una tabla de entregables en su `README.md`), pero no hay ninguna entidad de GitHub que lo represente como un todo: no hay issue, milestone ni etiqueta. El estado agregado no se puede consultar sin leer ficheros locales.
- El modelo de ramas exige **un PR por sprint** con squash merge y el título como commit (`git.md` §1/§3). No existe hoy un vínculo mecánico entre el PR del sprint y "qué quedó hecho y qué quedó abierto".
- No hay vista de antigüedad, contadores por estado/módulo ni flujo creadas-vs-cerradas: el dueño no puede responder "¿qué está bloqueado desde hace semanas?" sin inspección manual.

## 3. Decisiones del usuario (cerradas; no se reabren aquí)

Las decisiones de esta sección son **cerradas por el usuario**. La spec las transcribe y las hace verificables; no las reinterpreta.

### 3.1 Granularidad

- **Una issue = una entrega** (módulo, feature, bug, sugerencia). **Nunca una issue por tarea.**
- Las tareas viven en el plan local (`docs/tasks/`, `docs/superpowers/plans/`). El progreso se ve como **checklist dentro de la issue**, generado desde los `task-*.md` de `docs/tasks/` y mantenido por el CLI. No se escribe a mano.
- Si una entrega no cabe en un PR, se parte en **entregas** (issues con valor propio), no en sub-issues.

### 3.2 Sprint

- **Sprint = milestone de GitHub**, con título igual al **nombre del directorio del sprint** (`sprint-06-core-data`, `sprint-web`). No es etiqueta. No hay invariante de «un solo sprint abierto»: `sprint new` avisa si hay otro abierto (no falla); `sprint close` falla solo si quedan issues abiertas en ese milestone.

### 3.3 Taxonomía (fuente única: `board.labels.json`, en inglés)

- `type:bug`, `type:feature`, `type:chore`, `type:docs`, `type:infra`
- `status:backlog`, `status:approved`, `status:ready`, `status:in-progress`, `status:in-review`, `status:done`, `status:discarded`
- `module:<key>` generado desde `packages/*/manifest.json`, más `module:core` y `module:admin`
- Exactamente **un** `status:*`, un `module:*` y un `type:*` por issue.

### 3.4 Ciclo de vida y encaje con el flujo SDD actual

`backlog` (capturada) → `approved` (el usuario aprueba; la spec se escribe en local) → `ready` (spec+plan aprobados) → `in-progress` (rama abierta) → `in-review` (PR marcado como listo para revisión; mientras esté en draft, la issue sigue en `in-progress`) → `done` (mergeada y desplegada) | `discarded`. Cerrada = `done` o `discarded`; la etiqueta dice cuál.

Mapeo con los estados actuales de `docs/tasks`: `backlog`→`pendiente`, `in-progress`→`en curso`, `in-review`→`test`, `done`→`finalizada`. (`approved` y `ready` no tienen equivalente en `docs/tasks` y corresponden a `pendiente` hasta que se abre rama; `discarded` no tiene equivalente.)

El modelo de ramas y el PR-por-sprint **no cambian**: el PR del sprint **referencia** sus issues con `Refs #…` (no las cierra). La issue se cierra con `board close <n> done` **después** del merge y de verificar el despliegue (`/api/health` `ok`).

### 3.5 CLI determinista `board` (los agentes nunca etiquetan a mano)

Comandos mínimos: `labels sync` (idempotente), `new` (crea la issue en `status:backlog`), `start` (exige `status:ready`; asigna milestone, escribe `<!-- board:meta -->` + checklist, pasa a `in-progress`; no crea issues), `move`, `close`, `check` (solo lectura, detecta drift), `sprint new`, `sprint close`, `status`, `checklist sync`. `--dry-run` imprime las operaciones. Guarda `BOARD_CONFIRM=1` para permitir escrituras contra el repo de producción. Configuración por `GITHUB_API_URL`, `GITHUB_REPO`, `GITHUB_TOKEN`.

### 3.6 Panel

- **No es un módulo familiar.** Es capacidad del admin tras un ajuste `github_board.enabled` (`is_public: false`), con el token como **ajuste secreto cifrado** usando `SETTINGS_ENCRYPTION_KEY`. Token **solo en servidor**, nunca al cliente.
- Ruta `/board`, **solo lectura en v1**: contadores por estado/módulo/sprint, progreso `n/m` de cada entrega en curso, antigüedad de lo abierto, creadas vs cerradas por semana, filtros. Sin tablas nuevas: endpoints `/api/v1/board/*` que leen con Octokit en el servidor, con caché de Next (60 s) y refresco manual.
- Desactivado o sin token: la pantalla no aparece y no falla nada.

### 3.7 Fase C (no es v1, pero va en la spec)

Cambiar estado/milestone y comentar desde el panel; snapshots para flujo acumulado.

## 4. Alcance

**Dentro:**

1. `board.labels.json` como fuente única de la taxonomía (nombres, colores, descripciones).
2. CLI `board` con los 10 comandos de §3.5 y `--dry-run`.
3. Máquina de estados de issue y su guard de etiquetas (invariantes, §7/§10).
4. Contrato de la sección generada `<!-- board:meta -->` y del checklist (§8).
5. Panel `/board` de solo lectura (fase B) con su ajuste `github_board.enabled` + token secreto `github_board.token`.
6. Cliente `GitHubClient` (Octokit) como único punto de contacto con `api.github.com`.
7. Integración con el flujo SDD: documentación `docs/flows/board.md` y parches en `feature.md`, `git.md`, `bugfix.md`, `definition-of-done.md`, `AGENTS.md` (y `cicd.md` si se añade workflow).
8. Migración/arranque único y manual (§17).

**Fuera de alcance**, cada uno con su **disparador para revisarlo**:

| # | Fuera de alcance | Disparador para revisarlo |
|---|---|---|
| 1 | Projects v2 como fuente de estado | Vista opcional agrupada por `status:*`, manual; se documenta en `board.md` cuando se active |
| 2 | Sub-issues nativas | Una entrega que de verdad exija jerarquía (hoy se resuelve partiendo en entregas) |
| 3 | Webhooks | Flujo acumulado en BD, notificaciones a la familia, varios espectadores |
| 4 | Una issue por tarea | Nunca: viola §3.1 |
| 5 | Copiar la spec al body | Solo la sección generada `<!-- board:meta -->` con enlaces a spec/plan y el checklist; el resto del body no se toca |
| 6 | Reporte de bugs desde la app familiar | Siguiente entrega; se siembra como issue `type:feature` en `status:backlog` |
| 7 | Multi-repo | Punto único de configuración `GITHUB_REPO` (hoy `rferic/027apps`) |
| 8 | GitHub Enterprise Server | Punto único `GITHUB_API_URL` |

## 5. Modelo conceptual: entrega vs sprint vs tarea

| Entidad | Qué es | Dónde vive | Ejemplo |
|---|---|---|---|
| **Entrega** | Una unidad de valor para la familia: módulo, feature, bug, sugerencia | Una issue de GitHub con `type:*`, `module:*`, `status:*` | "Core data platform" |
| **Sprint** | Un concepto completo que entra a `main` como un todo (git.md §1) | Un milestone con el nombre del directorio | `sprint-09-core-data` |
| **Tarea** | Un paso interno del plan (TDD, bitácora) | `docs/tasks/sprint-NN/task-NN.md` + `docs/superpowers/plans/**` | `task-01` Usuarios y roles |

**Ejemplo real del repo** — el sprint `sprint-09-core-data` ("Core datos y plataforma — personas, claves, módulos, realtime y jobs", verificado en `docs/tasks/sprint-09-core-data/README.md`) tiene **6 tareas** (`task-01`…`task-06`). En el board eso es:

- **Una** issue "Core data platform" con `type:feature`, `module:core`, `status:in-progress`, milestone `sprint-09-core-data`, y un checklist **0/6** con una casilla por `task-*.md` (`Usuarios y roles`, `Categorías de usuarios`, `Invitaciones`, `API keys y dispositivos`, `Módulos`, `Realtime, outbox, push y jobs`).
- El checklist avanza a medida que cada `task-NN` pasa a `finalizada`; se regenera **entero** con `checklist sync` desde `docs/tasks/` (cada casilla = un fichero, con su `titulo` y `estado`; nunca a mano).
- El PR del sprint **referencia** la issue con `Refs #…` (no la cierra); al merge, el orquestador verifica el despliegue (`/api/health` `ok`) y cierra con `board close <n> done`, que pasa la etiqueta a `status:done`.

**Regla de no-encaje:** si una entrega no cabe en un solo PR (por tamaño o porque toca varias áreas independientes), se parte en **dos entregas** con valor propio (dos issues), nunca en sub-issues ni en una issue gigante.

## 6. Taxonomía completa de etiquetas

Fuente única: `board.labels.json`. Los nombres son **en inglés** (superficie de GitHub); los colores son hex de 6 caracteres (propuesta, ajustable en el JSON). `labels sync` las crea/actualiza de forma idempotente.

### 6.1 `type:*` (qué es; exactamente una)

| Etiqueta | Color | Descripción |
|---|---|---|
| `type:bug` | `d73a4a` | A defect to fix |
| `type:feature` | `0e8a16` | A new capability or module |
| `type:chore` | `e4e669` | Housekeeping, refactor with no observable change |
| `type:docs` | `0075ca` | Documentation only |
| `type:infra` | `7057ff` | CI, deploy, dependencies, secrets, tooling |

### 6.2 `status:*` (dónde está; exactamente una)

| Etiqueta | Color | Descripción | Equivalente `docs/tasks` |
|---|---|---|---|
| `status:backlog` | `eeeeee` | Captured, not approved | `pendiente` |
| `status:approved` | `c2e0c6` | Approved; spec written locally | `pendiente` |
| `status:ready` | `0e8a16` | Spec + plan approved | `pendiente` |
| `status:in-progress` | `fbca04` | Branch open + milestone | `en curso` |
| `status:in-review` | `1d76db` | PR marked ready for review | `test` |
| `status:done` | `a2eeef` | Merged and deployed (closed) | `finalizada` |
| `status:discarded` | `b60205` | Closed, won't do | — |

### 6.3 `module:*` (dónde; exactamente una)

| Etiqueta | Color | Descripción |
|---|---|---|
| `module:core` | `c5def5` | Core platform and shared capabilities |
| `module:admin` | `c5def5` | The admin panel itself |
| `module:<key>` | `c5def5` | One per `packages/*/manifest.json` `key` (p. ej. `module:split-expenses`) |

Las `module:<key>` se generan leyendo los `manifest.json` presentes en `packages/*/`; `labels sync` añade las que falten. No se borran etiquetas `module:*` que tengan issues asignados (solo se crean las ausentes).

### 6.4 Reglas de unicidad

- Exactamente **un** `type:*`, **un** `status:*` y **un** `module:*` por issue, en todo momento.
- `labels sync` es **idempotente**: converge al catálogo sin cambiar issues; solo garantiza que las etiquetas existen.
- Las invariantes de unicidad las hace cumplir el **guard** (§7) y el CLI en cada comando de escritura; GitHub en sí no impone cardinalidad por prefijo.

## 7. Máquina de estados de la issue

Estados: `backlog`, `approved`, `ready`, `in-progress`, `in-review`, `done` (cerrada), `discarded` (cerrada).

### 7.1 Transiciones legales

| Desde | Hacia | Quién la dispara | Comando |
|---|---|---|---|
| *(no existe)* | `backlog` | Orquestador captura una idea | `board new` |
| `backlog` | `approved` | Usuario aprueba; spec escrita en local | `board move <issue> approved` |
| `approved` | `ready` | Spec + plan aprobados | `board move <issue> ready` |
| `ready` | `in-progress` | Rama abierta; milestone obligatorio solo para `type:feature` | `board start` (o `board move`) |
| `in-progress` | `in-review` | PR marcado como listo para revisión (sale de draft) | `board move <issue> in-review` |
| `in-review` | `in-progress` | Rework tras revisión (PR vuelve a cambios) | `board move <issue> in-progress` |
| `in-review` | `done` | Mergeado **y** desplegado | `board close <issue> done` |
| `backlog`\|`approved`\|`ready`\|`in-progress` | `discarded` | Se decide no hacerla | `board close <issue> discarded` |
| `discarded` | `backlog` | Reapertura manual de una idea descartada | `board move <issue> backlog` |

### 7.2 Transiciones inválidas

Cualquier otra transición (p. ej. `backlog` → `done` saltando etapas, `done` → `in-progress`, `discarded` → `ready`) es rechazada con error claro que **lista el estado actual y las transiciones legales desde él**. `done` es terminal salvo intervención manual explícita (fuera del CLI v1).

### 7.3 Quién dispara qué (regla de actores)

- **El usuario** aprueba: `backlog` → `approved` y `approved` → `ready` (puertas de spec/plan de [feature.md](../../flows/feature.md)).
- **El orquestador** dispara `in-progress`, `in-review`, `done`, `discarded` con el CLI, en el momento exacto del flujo (apertura de rama, apertura de PR, merge+despliegue, descarte).
- **Ningún agente etiqueta a mano** (§3.5): toda transición pasa por `board move` / `board close`.

## 8. Contrato de la sección generada `<!-- board:meta -->`

El CLI escribe **solo** dos regiones acotadas del body de la issue; el resto del body **nunca se toca** (regla 5 de §4):

1. **`<!-- board:meta -->`** — bloque de metadatos, en la cabecera del body:

    <!-- board:meta
    status: ready
    module: core
    type: feature
    sprint: sprint-09-core-data
    tasks: docs/tasks/sprint-09-core-data/
    spec: docs/superpowers/specs/2026-10-26-core-data-model.md
    plan: docs/superpowers/plans/2026-10-27-core-implementation-roadmap.md
    -->

2. **Checklist generado** — al final del body, precedido de un marcador:

    ## Checklist (generated — do not edit)

    - [ ] task-01 Usuarios y roles
    - [ ] task-02 Categorías de usuarios
    …

**Reconciliación (`checklist sync`):** lee las tareas de `docs/tasks/` que apunta el campo `tasks:` —**no** el `plan:`, que es solo un enlace informativo— y regenera el checklist **entero** desde los `task-*.md`: cada casilla es un fichero, su texto es el `titulo` del frontmatter y se marca si `estado: finalizada`. No se preserva lo marcado a mano en el body (se regenera entero; nunca se edita a mano). El bloque `<!-- board:meta -->` se reescribe en su totalidad desde los argumentos del comando. Si `tasks:` no se puede leer o el frontmatter no coincide, el comando **falla** sin tocar el body (no adivina).

## 9. Comandos del CLI `board`

Configuración por variables de entorno: `GITHUB_API_URL` (default `https://api.github.com`), `GITHUB_REPO` (default `rferic/027apps`), `GITHUB_TOKEN` (PAT fine-grained, §12). `BOARD_CONFIRM=1` habilita escrituras contra el repo de producción; sin ella, cualquier comando de escritura sobre `rferic/027apps` imprime lo que haría y **no ejecuta** (equivale a `--dry-run` implícito). `--dry-run` explícito imprime todas las operaciones (lecturas y escrituras) sin ejecutarlas.

| Comando | Entrada | Efecto | Idempotencia | Errores principales |
|---|---|---|---|---|
| `labels sync` | — (lee `board.labels.json` + `packages/*/manifest.json`) | Crea/actualiza las etiquetas del catálogo; añade `module:<key>` ausentes | Sí: convergir es no-op si ya están | Token sin `metadata: read`; `GITHUB_REPO` inválido |
| `new` | Título (obligatorio; si se omite, derivado del `titulo` del `task-01`/README o del nombre de la spec) + `type` + `module` + `spec` | Crea issue en `status:backlog` con `<!-- board:meta -->` | No (crea) | Faltan campos; etiqueta fuera del catálogo |
| `start` | `spec` o `--issue <n>` (título opcional) | Exige `status:ready`; asigna milestone (obligatorio solo para `type:feature`), escribe `<!-- board:meta -->` + checklist, pasa a `in-progress`. **No crea la issue** | Sí (idempotente) | Issue no en `ready`; `spec:` con 0 o >1 coincidencia (usa `--issue <n>`); milestone inexistente/cerrado; `tasks:` ilegible |
| `move` | Issue + `status` destino | Transición de estado (etiquetas `status:*`) validada por la máquina | Re-aplicar el mismo estado es no-op | Transición inválida (§7.2) |
| `close` | Issue + `done`\|`discarded` | Aplica la etiqueta terminal y cierra la issue (tras merge + despliegue verificado, `/api/health` `ok`) | Sí (tolera una issue ya cerrada: aplica la etiqueta y avisa) | — |
| `check` | — | Solo lectura: verifica cardinalidad de etiquetas, milestone existente/abierto cuando aplica, coherencia `<!-- board:meta -->` ↔ etiquetas, y drift del checklist del body frente a `docs/tasks/*.md` | — (nunca escribe) | Sale con código 1 si hay drift |
| `sprint new` | Nombre del directorio (`sprint-06-core-data`, `sprint-web`) | Crea el milestone con ese nombre | Sí (si existe, no-op) | — (avisa, no falla, si hay otro milestone abierto) |
| `sprint close` | Milestone | Cierra el milestone | Sí | Issues abiertas en el milestone |
| `status` | — | Imprime contadores por estado/módulo/sprint (misma agregación que el panel, §11) | — (solo lectura) | Token sin `issues: read` |
| `checklist sync` | Issue | Regenera el checklist **entero** desde `docs/tasks/*/task-*.md` (§8) | Sí | `tasks:`/frontmatter ilegible |

**Milestone y sprint:** el título del milestone es el **nombre del directorio del sprint** (`sprint-09-core-data`, `sprint-web`), no un patrón rígido `NN-slug`. No hay invariante de «un solo sprint abierto»: `sprint new` **avisa** si hay otro milestone abierto (no falla); `sprint close` falla solo si quedan issues abiertas en ese milestone (el orquestador primero las pasa a `done`/las mueve).

## 10. Guard de etiquetas

Qué **garantiza** (invariantes mecánicas, sin inferir estado):

- Exactamente un `status:*`, un `type:*` y un `module:*` por issue.
- Toda etiqueta usada existe en el catálogo sincronizado.
- El milestone asignado —obligatorio solo para `type:feature` en `in-progress`/`in-review`; opcional para `bug`/`infra`/`chore`/`docs` (ramas `fix/*`, hotfix)— existe y está abierto cuando está asignado.
- Toda transición pasa por la máquina de estados (§7): no se puede saltar de `backlog` a `done` ni reabrir un `done`.

Qué **no** garantiza (deliberadamente):

- **No adivina estados.** Si un agente etiquetó a mano o el estado real divergió del deseado, el guard lo **reporta**, no lo corrige por su cuenta (determinismo antes que agentes).
- No infiere "está desplegado" ni "está mergeado": `done` lo marca el orquestador al cumplirse el DoD y el despliegue sano (`/api/health` `ok`), igual que `finalizada` hoy.
- No mueve issues automáticamente por eventos de GitHub (eso es webhooks, fuera de alcance §4).

## 11. Panel `/board` (fase B)

### 11.1 Ajuste y token

- **`github_board.enabled`**: boolean, `is_public: false`, `is_secret: false`, `superAdminOnly: true`. Con `false` (default) o sin token, la ruta no aparece y no falla nada.
- **`github_board.token`**: `is_secret: true`, `is_public: false`, `mcp_access: 'none'`, `superAdminOnly: true`. Se guarda **cifrado** (`value_encrypted`, AES-256-GCM vía `SETTINGS_ENCRYPTION_KEY`; verificado en `packages/core/src/crypto.ts` y `settings/service.ts`). **Solo en servidor**: se lee por `service_role` en el route handler; nunca sale por `/instance`, nunca a `NEXT_PUBLIC_*`, nunca al cliente.
- Ambos se añaden al **catálogo** (`packages/core/src/settings/catalog.ts`) y al **seed** de una migración **nueva** `supabase/migrations/0014_board_settings.sql` (no en `0002_settings.sql`, que ya está aplicada), con su check de sync del db-test.

### 11.2 Ruta y pantallas

- Ruta: `/board` (admin, no módulo). Restringida a **super admin** (el dueño de la instancia), igual que la edición del token.
- **V1 (solo lectura)**: contadores por `status:*`/`module:*`/milestone, progreso `n/m` de cada entrega en curso (checklist resuelto), antigüedad de lo abierto (días desde creación), creadas vs cerradas por semana, y filtros por estado/módulo/sprint. Sin acciones de escritura.
- **Degradación**: si `github_board.enabled=false` o el token falta/caduca/rate-limitado, la pantalla no aparece o muestra un estado vacío con aviso; **nunca** rompe el resto del panel ni deja escapar el token.

### 11.3 Datos, caché y i18n

- El Server Component de `/board` llama a `/api/v1/board/summary` y `/api/v1/board/issues` (patrón del ADR 0005, misma auth que el admin, scope `board:read` si aplica); **esos endpoints** usan `GitHubClient` (Octokit) server-side. **Sin tablas nuevas** (§12). Caché de Next de **60 s** en la ruta + `revalidateTag` tras el refresco manual. Fixtures (`BOARD_FIXTURES=1`) para renderizar sin GitHub (§14).
- Todo string visible pasa por i18n (inglés como clave; catálogo + locales del set de 9), igual que el resto del admin.

## 12. Modelo de datos y seguridad

### 12.1 Modelo de datos

- **v1: sin tablas nuevas.** El board vive íntegramente en GitHub; los endpoints `/api/v1/board/*` leen de `api.github.com` (vía `GitHubClient`) y cachean en memoria del deploy; el panel los consume (§11.3). No se persiste estado de board en Postgres.
- **Fase C** necesitará, para el flujo acumulado, una tabla de **snapshots** (p. ej. `board_snapshots`: fecha, contadores por estado, counts) alimentada por un snapshot manual/job — no webhooks en v1 (§4). Se especifica cuando llegue la fase C, no aquí.

### 12.2 Seguridad

- **Token**: PAT **fine-grained** con permisos mínimos **`issues: write`** y **`metadata: read`** (para leer repo/milestones). Nada de `contents`, `pull_requests`, `actions` ni scope de usuario amplio.
- **Solo servidor**: el token se guarda cifrado como ajuste secreto y lo usan únicamente los endpoints `/api/v1/board/summary` y `/api/v1/board/issues` (y el CLI); jamás en el cliente ni en `NEXT_PUBLIC_*`.
- **HMAC no aplica**: no hay webhooks (§4), así que no hay firma de payload que verificar.
- **Sin PII**: el board no expone datos personales de la familia; solo títulos/labels/milestones/fechas de issues. No se copian cuerpos de spec al issue (§4.5).
- **Logs**: sin token ni cuerpos en logs (misma regla de `guard-secrets` y `cicd.md` §Secretos).

## 13. Fases y criterios de aceptación por fase

### Fase A — Taxonomía + CLI + máquina de estados + integración de flujo

- `labels sync` crea exactamente el catálogo de §6 de forma idempotente (dos ejecuciones seguidas no cambian nada).
- `board new` crea en `status:backlog`; `board start` exige `status:ready` y no crea issues; `move`/`close` respetan la máquina de §7; una transición inválida falla listando las legales.
- `checklist sync` regenera el checklist **entero** desde `docs/tasks/sprint-09-core-data/task-*.md` (casilla = fichero, texto = `titulo`, marcada si `estado: finalizada`), sin preservar ediciones a mano.
- El guard reporta (no corrige) una issue con etiquetas a mano divergentes.
- `board check` detecta drift entre el checklist del body y `docs/tasks/*.md` (y cardinalidad/milestone) y sale con código 1 sin corregir.
- `docs/flows/board.md` existe y los parches de `feature.md`/`git.md`/`bugfix.md`/`definition-of-done.md`/`AGENTS.md` son coherentes (§16).
- Sin `BOARD_CONFIRM=1`, ningún comando de escritura toca `rferic/027apps`.

### Fase B — Panel de solo lectura

- `/board` renderiza contadores, progreso `n/m`, antigüedad y creadas-vs-cerradas con datos de GitHub (o fixtures).
- Con `github_board.enabled=false` o sin token, la ruta no aparece y nada falla.
- El token nunca llega al cliente (auditable en el bundle/network).
- Caché de 60 s + refresco manual; sin tablas nuevas.
- **Dependencia**: el shell del panel (`(panel)/layout`, `panel-guard`, `panel-i18n`) son tareas `pendiente` de `sprint-web`; `/board` reutiliza ese shell. B se planifica **después** de ese shell; si no está listo, `/board` trae su propio shell mínimo y se sustituye después.

### Fase C — Escritura desde el panel + flujo acumulado

- Cambiar estado/milestone y comentar desde el panel (mismas reglas de máquina/guard que el CLI).
- Snapshots para el flujo acumulado (creadas vs cerradas por semana) persistidos; sin webhooks.

## 14. Plan de pruebas (requisito de diseño)

| Capa | Herramienta | Qué cubre |
|---|---|---|
| Dominio (máquina de estados) | Vitest | Todas las transiciones legales e inválidas de §7 (tabla de casos) |
| Dominio (checklist) | Vitest | Parseo/generación del checklist, preservación de casillas, reconciliación |
| Dominio (métricas) | Vitest | Agregación de contadores, `n/m`, antigüedad, creadas-vs-cerradas (función pura) |
| CLI (`board check`) | Vitest | `board check` detecta cardinalidad/milestone/drift del checklist; código 1 sin corregir |
| Cliente | MSW | `GitHubClient` interceptando `api.github.com` (issues, labels, milestones) |
| Panel | Fixtures (`BOARD_FIXTURES=1`) | Render desde JSON sin GitHub; degradación sin token |
| API (`/api/v1/board/*`) | Vitest + MSW | Endpoints `summary` e `issues` con auth del admin (scope `board:read`), envelope y rate limiting (ADR 0005 / core-api); sin fuga del token |
| Integración | Suite opt-in `test:integration` | Contra un **repo sandbox privado**; issues `[sandbox]` que se crean y se cierran (la API no borra issues, se dejan cerradas) |
| CI | Gates existentes | Sin token en forks, en verde; `admin` (lint/tsc/test/build) + `guard-secrets` |

**Requisito de arquitectura para testabilidad**: un único punto de contacto `GitHubClient`; todo lo demás son **funciones puras** (máquina, parseo de checklist, agregación). Los casos de la máquina se listan en una tabla dentro del plan, no dispersos.

## 15. Puertas de setup del usuario

1. **PAT fine-grained** con `issues: write` y `metadata: read` sobre `rferic/027apps`; guardado en el gestor de contraseñas y en `GITHUB_TOKEN` (entorno del CLI/despliegue), nunca en git.
2. **Repo sandbox privado** para `test:integration` (separado del de producción).
3. **Activar el ajuste**: `github_board.enabled=true` y cargar `github_board.token` (cifrado) desde el panel de settings.
4. Ejecutar el arranque manual de §17 una vez.

Estas puertas se documentan en el mismo PR del sprint (igual que el resto de puertas de `cicd.md`).

## 16. Documentación a actualizar en el mismo PR

- **Nuevo** `docs/flows/board.md`: flujo completo del board (ciclo de vida, comandos, guard, panel), en español (superficie GitHub en inglés solo para labels/títulos/milestones).
- **Parches**: `docs/flows/feature.md` (mapeo de estados y puertas `approved`/`ready`), `docs/flows/git.md` (milestone por sprint, `Refs #…` en el PR —no `Closes #…`—, y que la issue pasa a `in-review` solo cuando el PR sale de draft), `docs/flows/bugfix.md` (issues `type:bug`), `docs/conventions/definition-of-done.md` (equivalencia `done` ↔ `finalizada`), `AGENTS.md` (referencia a `board.md` y regla "los agentes no etiquetan a mano").
- **`docs/flows/cicd.md`** solo si se añade un workflow (p. ej. un check de que `board.labels.json` está sincronizado); si no, no se toca.

## 17. Migración / arranque

- **Una sola vez, manual**: crear issues **solo para los sprints con trabajo en vuelo** (`en curso` o `test`) — **una issue por sprint**, con su milestone cuyo título es el **nombre del directorio** del sprint. Los `pendiente` siguen como documentos hasta que arranquen. No se retro-migra el histórico cerrado de `docs/tasks`.
- `docs/tasks/**` **sigue siendo el plan interno**; el board no lo reemplaza. A partir del arranque, cada entrega nueva nace por el CLI, no por fichero.
- El arranque lo ejecuta el orquestador con `BOARD_CONFIRM=1` y orden explícita del usuario (es escritura contra producción).

## 18. Non-goals

- Estimaciones (story points, tiempo) y time tracking.
- Auto-asignación de issues a personas.
- Estados inferidos por un bot (el guard no adivina; §7/§10).
- Sincronización automática desde eventos de GitHub (webhooks, §4).
- Reemplazar `docs/tasks` o el flujo SDD: el board es superficie de estado, no de plan.

## 19. Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Issue gigante que no cabe en un PR | Regla de no-encaje §5: partir en entregas, no sub-issues |
| Etiqueta mal puesta a mano por un agente | CLI-only (§3.5) + guard que reporta (§7/§10) |
| Token caducado/revocado | Panel degrada sin romper nada (§11.2); error claro; rotación por puerta de usuario |
| Rate limit de GitHub | Un solo `GitHubClient`, caché de 60 s, superficie mínima de endpoints, sin polling agresivo |
| Panel lento | Caché + fixtures + agregación en funciones puras testeadas |
| Divergencia issue ↔ `docs/tasks` | Mapeo explícito de §3.4; `checklist sync` determinista; el guard reporta divergencias |
| Escritura accidental a producción | `BOARD_CONFIRM=1` obligatorio + `--dry-run` por defecto |
| Token filtrado en git | `guard-secrets` + token solo como ajuste cifrado, nunca en `.env` commiteado |
| Shell del panel (`sprint-web`) aún `pendiente` al llegar la fase B | `/board` trae un shell mínimo propio que se sustituye cuando llegue `sprint-web` (§13) |

## 20. Referencias

- `docs/flows/feature.md`, `docs/flows/git.md`, `docs/flows/bugfix.md`, `docs/flows/cicd.md`
- `docs/conventions/definition-of-done.md`, `docs/conventions/code-style.md`
- `docs/ai/module-system.md` + `docs/superpowers/specs/2026-10-26-modulo-system.md` (qué es y qué no es un módulo; el board **no** lo es)
- `docs/superpowers/specs/2026-10-26-core-api.md` (contrato `/api/v1`, envelope, rate limiting)
- `docs/adr/0007-manejo-de-errores.md`, `docs/adr/0005-estado-y-fetching-del-admin.md`
- `docs/superpowers/specs/2026-11-06-settings-batch-write-design.md` (formato de spec)
- `supabase/migrations/0002_settings.sql`, `packages/core/src/settings/catalog.ts`, `packages/core/src/crypto.ts` (settings y cifrado con `SETTINGS_ENCRYPTION_KEY`)
- `docs/tasks/sprint-09-core-data/README.md` (ejemplo real "Core data", 6 tareas)

## Preguntas abiertas

1. **Colores exactos de las etiquetas**: los hex de §6 son propuesta; el usuario puede ajustarlos en `board.labels.json` antes de `labels sync`. No bloquea.

## 21. Decisiones de la revisión de viabilidad

Decisiones del **orquestador** (revisión de viabilidad), aplicadas a esta spec. El usuario puede revertirlas; no son puertas de usuario.

| Decisión | Motivo |
|---|---|
| D1 | El checklist se deriva solo de `docs/tasks/*/task-*.md` (casilla = fichero, texto = `titulo`, marcada si `estado: finalizada`); se regenera entero en cada `checklist sync`; `plan:` es solo un enlace informativo. |
| D2 | `in-review` = PR marcado como listo para revisión; mientras esté en draft, la issue sigue en `in-progress`. |
| D3 | El PR referencia con `Refs #…` (no cierra); `board close <n> done` cierra tras merge + despliegue verificado y tolera una issue ya cerrada. |
| D4 | `new` crea en `status:backlog`; `start` exige `status:ready`, no crea issues y se identifica por coincidencia exacta del campo `spec:`. |
| D5 | Milestone obligatorio solo para `type:feature` en `in-progress`/`in-review`; el resto puede trabajar sin milestone (ramas `fix/*`, hotfix). |
| D6 | Sin invariante de «un solo sprint abierto»; el título del milestone es el nombre del directorio del sprint. |
| D7 | `board check` (solo lectura) verifica etiquetas, milestone y drift del checklist; sale con código 1 y no corrige. |
| D8 | El panel lee vía `/api/v1/board/*` (no Octokit en la página); caché de 60 s + `revalidateTag`. |
| D9 | Migración nueva `0014_board_settings.sql` para el seed de las dos claves; `0002_settings.sql` ya está aplicada. |
| D10 | Arranque acotado: una issue por sprint con trabajo en vuelo (`en curso`/`test`); `pendiente` sigue como documento. |
| D11 | La fase B depende del shell del panel (`sprint-web`); si no está listo, `/board` trae un shell mínimo. |
| D12 | `/board` restringido a super admin. |
| D13 | Título del issue obligatorio en `new`/`start`, con derivación si se omite. |
