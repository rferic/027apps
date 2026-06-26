<!-- BEGIN:sprint-conventions -->
# Convención de Sprints

Los planes de sprint se guardan en `.plans/` con el formato:

```
sprint-{NN}-{descripcion}.md
```

## Numeración
- Los sprints van numerados secuencialmente con **zero-padding**: `sprint-01`, `sprint-02`, ..., `sprint-09`, `sprint-10`, `sprint-11`...
- Esto asegura que `ls` los muestre en orden correcto (sprint-10 no debe aparecer antes que sprint-02).
- El sprint 00 existe como fundación y es la excepción.
- Las tareas continúan la numeración global entre sprints. Si el Sprint 1 termina en TASK-13, el Sprint 2 empieza en TASK-14.

## Estado de un sprint
- **Pendiente:** el archivo no tiene sufijo → `sprint-1-apps-system.md`
- **Preview (staging):** añadir sufijo `.preview` → `sprint-1-apps-system.md.preview`
- **Implementado (producción):** añadir sufijo `.done` → `sprint-1-apps-system.md.done`

**Flujo:**
1. Sprint pendiente → `.md` (sin sufijo)
2. Push a staging/preview → renombrar a `.md.preview` ANTES del commit
3. Merge a main + deploy producción → renombrar a `.md.done`

Antes de empezar cualquier tarea, revisa los archivos en `.plans/` para saber qué sprints están pendientes (`.md`), en preview (`.md.preview`) o ya implementados (`.md.done`), y continúa la numeración desde la última TASK del último sprint.

## Rama por sprint
- Cada sprint se trabaja en su propia rama: `sprint/{N}-{descripcion}` (ej. `sprint/4-github-deploy`)
- Features en ramas `feature/{descripcion}`, fixes en `fix/{descripcion}`
- El merge a `main` se hace con **squash merge** — un solo commit limpio por feature/sprint
- **NUNCA** se trabaja directamente en `main`

## Formato de PR y commits

```
PR title:         Sprint N: Título descriptivo
Squash commit:    Sprint N: Título descriptivo
Commits en rama:  Sprint N: type(scope): mensaje
```

**Ejemplos:**

```
PR:               Sprint 6: Multitenant groups
Squash commit:    Sprint 6: Multitenant groups
Commits:          Sprint 6: feat: widget dashboard
                  Sprint 6: fix: sidebar collapse
                  Sprint 6: docs: pre-push hook
```

**Reglas:**
- El PR title y el squash commit SIEMPRE empiezan con `Sprint N: `
- Los commits individuales en la rama también llevan `Sprint N: ` prefijo
- `type` sigue conventional commits: feat, fix, docs, refactor, test, chore
- El `scope` es opcional, va entre paréntesis tras el type

## Flujo preview-first (OBLIGATORIO)
Siempre seguir este orden:

```
Push rama → Vercel preview (staging) → pruebas en preview → OK → merge a main → deploy producción
```

**Reglas:**
1. Nunca mergear a `main` sin antes haber pusheado la rama y verificado el preview en staging
2. El preview de Vercel se genera automáticamente al pushear la rama
3. Probar en la URL de preview antes de autorizar el merge
4. Documentar en el sprint la URL de preview usada

**Excepciones:** Solo si el usuario dice explícitamente "merge directo" o "sin preview".
<!-- END:sprint-conventions -->

<!-- BEGIN:frontend-test -->
# Test de frontend (OBLIGATORIO antes de merge)

Cada sprint DEBE incluir una TASK de verificación frontend antes del merge a main.

## Flujo

```
Push rama
  → CI pasa (lint + tsc + test + build)
  → Vercel despliega preview
  → [NUEVO] Ejecutar `test-frontend preview` (skill)
  → Bugs encontrados → fix → push → repetir
  → OK → merge a main
```

## Cuándo ejecutar

| Momento | Comando | Notas |
|---|---|---|
| Tras push a preview | `@opencode test-frontend preview` | Verifica que el deploy funciona |
| Antes de merge a main | `@opencode test-frontend preview` | Última comprobación |
| Tras deploy a producción | `@opencode test-frontend production` | Solo lectura, verifica que todo OK |

## Plantilla de sprint

Todo plan de sprint DEBE incluir una sección de tests al final:

```
### Tests (Fase final)

Incluir al final del sprint una TASK de verificación frontend:

**TASK-NNN: Verificación frontend en preview**

Ejecutar `@opencode test-frontend preview` y documentar resultados.
Corregir cualquier bug encontrado antes del merge.

**Criterios de aceptación:**
- Health check: ✅
- Páginas SSR cargan sin error: ✅
- API autenticada responde: ✅
- Apps (Todo, Inspiration) funcionan: ✅
- Admin endpoints responden: ✅
- Server-Timing headers presentes: ✅
- Sin errores 404/500: ✅
```

## Configuración

Las credenciales de test se almacenan en `~/.config/opencode/e2e-config.json`
(FUERA del repositorio). Incluye email, password y anon keys de Supabase.

Si el archivo no existe, la skill `frontend-test` pedirá los datos la primera vez.
<!-- END:frontend-test -->

<!-- BEGIN:admin-form-pattern -->
# Patrón de formularios admin

Todos los formularios de creación/edición en el área admin (`/(admin)`) DEBEN usar el patrón MODAL:

- Backdrop: `fixed inset-0 z-50` con `bg-black/40`
- Panel: `bg-white rounded-xl border border-slate-100 shadow-xl p-6 w-full max-w-lg mx-4`
- Abrir/cerrar con estado local (`useState(true/false)`) en el componente padre de la lista
- Cierre: backdrop click + botón X + escape key
- NO usar páginas separadas (`/[id]/` o `/new`) para formularios de creación/edición
- NO usar formularios inline visibles siempre

Excepciones permitidas:
- Páginas de configuración completas (ej. Settings General, App Config)
- Páginas de perfil propio (ej. Admin Profile)
- Formularios que son el propósito principal de la página

Ejemplo canónico: `ApiKeysManager.tsx` (modal inline), `CreateInvitationModal.tsx` (modal separado).
<!-- END:admin-form-pattern -->

<!-- BEGIN:code-review -->
# Pre-Check antes de merge (OBLIGATORIO)

Antes de cualquier code review o merge, ejecutar localmente:

```bash
pnpm install --frozen-lockfile  # lockfile sincronizado
pnpm lint                       # corrige errores automáticos con --fix si aplica
pnpm tsc --noEmit               # errores de tipos
pnpm test --run                 # tests unitarios
pnpm build                      # build completo
```

Si cualquiera falla, **no se procede** hasta corregirlo.

El pre-push hook (`.githooks/pre-push`) ejecuta esto automáticamente en cada `git push`.
Para activarlo: `git config core.hooksPath .githooks` (ya configurado).

# Code Review antes de merge

1. Ejecutar pre-check (lint + tsc + test + build)
2. El **Ingeniero** (agente de calidad) audita el código automáticamente
3. El Ingeniero emite un veredicto (aprobado/rechazado con observaciones)
4. Se pregunta al usuario: "¿Revisas tú o te fías del veredicto?"
5. Según su respuesta: él revisa el diff o se procede con el merge
<!-- END:code-review -->

<!-- BEGIN:deploy-rule -->
# 🚨 REGLA DE ORO: No hacer deploy sin permiso

**NUNCA** se hace deploy a producción sin confirmación explícita del usuario.
Toda skill, agente o flujo automático debe preguntar antes de deployar.
<!-- END:deploy-rule -->

<!-- BEGIN:shadcn-verification-rules -->
# Verificación de componentes shadcn/ui

Antes de importar cualquier componente de `@/components/ui/*`, DEBES verificar que el archivo existe en `src/components/ui/`.

**Regla obligatoria para el Soldado:**
1. Usa Glob o Bash para listar `src/components/ui/` antes de escribir código
2. Si el componente no existe, tienes dos opciones:
   a. Instalarlo: `npx shadcn@latest add <component>` (verifica que sea compatible con el proyecto)
   b. Implementarlo sin ese componente usando Tailwind CSS puro
3. NUNCA importes un componente shadcn sin haber verificado que existe — esto rompe la aplicación en build time

Los componentes actualmente instalados se pueden verificar con: `ls src/components/ui/`
<!-- END:shadcn-verification-rules -->

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:environments -->
# Entornos

## Proyectos

| Entorno | Supabase Project Ref | Supabase URL | Vercel |
|---|---|---|---|
| **Local** | — | `http://localhost:54321` | — |
| **Staging** | `tsphkmbtnahjgsivdhaj` | `https://tsphkmbtnahjgsivdhaj.supabase.co` | Preview Deployments |
| **Producción** | `zbwvvzeljiymwqcbemyy` | `https://zbwvvzeljiymwqcbemyy.supabase.co` | Production |

## Claves de API

| Entorno | `SUPABASE_SERVICE_ROLE_KEY` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
|---|---|---|
| **Local** | Generada con JWT secret local | Generada con JWT secret local |
| **Staging** | En Vercel (env Preview) | En Vercel (env Preview) |
| **Producción** | En Vercel (env Production) | En Vercel (env Production) |

## Flujo de trabajo

```
Push rama (sprint/*, feature/*, fix/*)
  → CI: lint + tsc + test
  → Vercel: Preview Deployment (contra Supabase staging)
  → migrate-staging.yml: supabase db push (contra staging)
       [solo si hay cambios en supabase/migrations/]

Merge a main (squash merge)
  → Vercel: Production Deployment (contra Supabase producción)
  → migrate-prod.yml: supabase db push (contra producción)
       [solo si hay cambios en supabase/migrations/]
```

## Workflows de GitHub Actions

| Archivo | Disparador | Destino |
|---|---|---|
| `ci.yml` | PR a `main` | lint + tsc + test |
| `release.yml` | Push a `main` | release-please (semver) |
| `migrate-prod.yml` | Push a `main` (migrations/) | `supabase db push` → **producción** |
| `migrate-staging.yml` | Push a `sprint/*`, `feature/*`, `fix/*` (migrations/) | `supabase db push` → **staging** |

## Cómo probar en staging

1. Push a una rama `sprint/*`, `feature/*` o `fix/*`
2. Esperar a que Vercel despliegue el Preview Deployment
3. Abrir la URL que Vercel muestra en el PR/commit (ej. `sprint-5-estabilizacion.027apps.vercel.app`)
4. Esa URL apunta a Supabase staging — datos aislados de producción

## Migraciones manuales

Si necesitas aplicar migraciones a staging manualmente:

```bash
supabase link --project-ref tsphkmbtnahjgsivdhaj
supabase db push --include-all
```

Si necesitas aplicar migraciones a producción manualmente:

```bash
supabase link --project-ref zbwvvzeljiymwqcbemyy
supabase db push --include-all
```
<!-- END:environments -->

<!-- BEGIN:local-dev -->
# Desarrollo local

1. Asegúrate de que Supabase local está corriendo:
   ```bash
   supabase start
   ```

2. El `.env.local` debe tener las claves locales:
   - `NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` = claves locales firmadas con el JWT secret local

3. Para regenerar las claves locales (si cambia el JWT secret):
   ```bash
   node -e "
   const c = require('crypto');
   const s = 'super-secret-jwt-token-with-at-least-32-characters-long';
   const n = Math.floor(Date.now()/1000);
   const h = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
   [['service_role'],['anon']].forEach(([r])=>{
     const p = Buffer.from(JSON.stringify({iss:'supabase',ref:'027apps',role:r,iat:n,exp:n+86400*365})).toString('base64url');
     const sig = c.createHmac('sha256', s).update(h+'.'+p).digest('base64url');
     console.log(r.toUpperCase()+'_KEY= '+h+'.'+p+'.'+sig);
   });
   "
   ```
<!-- END:local-dev -->

<!-- BEGIN:github-issue-labels -->
# Gestión de etiquetas en GitHub Issues durante un sprint

Las issues se crean automáticamente desde el módulo Inspiration y llevan dos familias de labels:

| Label | Propósito | Quién lo gestiona |
|---|---|---|
| `type: bug` / `type: feature` / `type: new_app` / etc. | Tipo de idea | Inspiration (automático) |
| `status: pending` / `reviewing` / `approved` / `completed` / `rejected` / `duplicate` / `deleted` | Ciclo de vida de la idea | Inspiration (automático) |

Para el **avance del desarrollo** durante un sprint, se añaden estos labels adicionales:

| Label | Cuándo se aplica |
|---|---|
| `sprint: N` (ej. `sprint: 21`) | Al iniciar el sprint, indicando a qué sprint pertenece la issue |
| `sprint: in-progress` | Cuando el agente empieza a trabajar en ella |
| `sprint: reviewing` | Cuando el fix/feature está en preview/staging, listo para probar |
| `sprint: blocked` | Si algo impide avanzar |

**Reglas:**
- Los labels `type:*` y `status:*` gestionados por Inspiration **no se tocan** manualmente. Solo Inspiration los actualiza cuando cambia el estado de la idea original.
- Los labels `sprint:*` los gestiona el agente que ejecuta el sprint.
- Al terminar la TASK, la issue se cierra desde GitHub (el agente comenta el resultado y cierra la issue).

**Flujo típico:**
1. Sprint comienza → añadir `sprint: N` a todas sus issues
2. Se empieza una TASK → añadir `sprint: in-progress`, comentar en la issue
3. Se sube a preview → añadir `sprint: reviewing`, comentar URL de preview
4. Merge + deploy → cerrar issue con resumen
5. Si algo bloquea → añadir `sprint: blocked`, explicar en la issue
<!-- END:github-issue-labels -->

<!-- BEGIN:i18n-rules -->
# 🚨 REGLAS DE ORO PARA i18n (OBLIGATORIO, NO OPCIONAL)

Errores recurrentes que DEBES evitar:

## 1. ANTES de escribir `t('clave')`, LEE la definición en el JSON
Busca la clave en `src/i18n/messages/en.json` y VERIFICA qué variables espera:
```
"clave": "Hola {name}, tienes {count} mensajes"
```
Requiere: `t('clave', { name: '...', count: ... })`. Si falta alguna variable → FORMATTING_ERROR.

## 2. DESPUÉS de añadir nuevas claves a en.json, SINCRONIZA y TRADUCE a los otros 5 idiomas
Ejecuta este script para copiar las claves nuevas a es, it, ca, fr, de, y LUEGO traduce manualmente cada clave nueva (no dejar texto en inglés como fallback):
```bash
python3 << 'PYEOF'
import json
import os
base = 'src/i18n/messages'
with open(f'{base}/en.json') as f:
    en = json.load(f)
locales = ['es', 'it', 'ca', 'fr', 'de']
for loc in locales:
    with open(f'{base}/{loc}.json') as f:
        data = json.load(f)
    def merge_keys(src, dst):
        for k, v in src.items():
            if isinstance(v, dict) and k in dst and isinstance(dst[k], dict):
                merge_keys(v, dst[k])
            elif k not in dst:
                dst[k] = v
    merge_keys(en, data)
    with open(f'{base}/{loc}.json', 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f'✓ {loc}.json synced')
PYEOF
```

## 3. DESPUÉS de modificar archivos JSON, AVIERTE al usuario que REINICIE el dev server
Los mensajes de next-intl se cachean al arrancar. Sin restart, las claves nuevas no existen.

## 4. NUNCA asumas que una clave existe sin verificarlo
Syntax segura: busca el key en en.json con grep/read antes de usarlo.

## 5. `toLocaleDateString()` siempre con locale
Usar `toLocaleDateString(locale)` (no sin argumentos) para evitar hydration mismatch.
<!-- END:i18n-rules -->

<!-- BEGIN:pagination-convention -->
# Paginación en listas API (OBLIGATORIO)

TODOS los endpoints de listado (`GET ...`) DEBEN usar paginación.

## Parámetros
- `page`: número de página (default 1, mínimo 1)
- `limit`: items por página (default 20, mínimo 1, **máximo 500**)

## Response format
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "total_pages": 8
  }
}
```

## Reglas
- El `total` debe contar TODOS los items que matchean los filtros (sin aplicar limit/offset)
- NUNCA devolver un array plano sin paginación en endpoints de listado
- NUNCA permitir un limit > 500
- No implementar paginación con cursor a menos que sea explícitamente requerido (page/limit es suficiente)
- Esta convención aplica a TODAS las apps del proyecto, presentes y futuras
<!-- END:pagination-convention -->

<!-- BEGIN:delete-convention -->
# DELETE endpoints: 204 No Content

Todos los endpoints DELETE en la API DEBEN devolver:

- `204 No Content` (sin body) cuando la operación es exitosa
- `404 Not Found` cuando el recurso no existe
- `403 Forbidden` cuando el usuario no tiene permisos
- `401 Unauthorized` cuando no está autenticado

**Prohibido:** devolver `200` con `{deleted: true}` en DELETE exitosos.

**Implementación:** `return new Response(null, { status: 204 })`.
NUNCA usar `apiOk()` en handlers DELETE exitosos.
<!-- END:delete-convention -->

<!-- BEGIN:design-system -->
# Design System 027Apps (OBLIGATORIO)

La propuesta visual ganadora es **"Modern" (H)**. Todos los componentes nuevos deben
seguir esta estética.

## Reglas de oro

1. **Antes de escribir HTML/Tailwind raw**, verifica si existe un componente DS.
2. **Para crear un componente nuevo**, debe:
   - Justificarse (no duplicar funcionalidad existente)
   - Implementarse con story en Storybook
   - Usar los tokens de `src/design-tokens.css`
3. **NUNCA** importar un componente de `@/components/ui/` (shadcn legacy) si existe
   su equivalente en `@/components/ds/` (design system).

## Tokens disponibles

Todos en `src/design-tokens.css` como CSS custom properties:
- `--color-brand`, `--color-surface`, `--color-text`, `--color-border`, etc.
- `--font-heading` (Outfit), `--font-body` (Sora)
- `--radius-sm/md/lg/xl`, `--shadow-sm/md/lg`
- Variante `.dark` automática con `className="dark"`

## Componentes DS disponibles

### Base (`src/components/ds/`)
| Componente | Variantes | Props clave |
|---|---|---|
| `DsButton` | primary, secondary, outline, ghost | size (sm/md/lg) |
| `DsBadge` | primary, success, warning, error, neutral, outline | — |
| `DsCard` | — | padding (sm/md/lg), hover |
| `DsInput` / `DsTextarea` | — | label, error, disabled |
| `DsModal` | — | open, onClose, title, maxWidth |
| `DsTabs` | — | tabs[], defaultTab, onChange |
| `DsAvatar` | — | size, color |
| `DsSkeleton` | — | height, circle, count |
| `DsEmptyState` | — | icon, title, description, action |
| `DsAlert` | info, success, warning, error | icon, onDismiss |
| `DsToggle` | — | checked, onChange, label, disabled |
| `DsSelect` | — | options[], value, onChange, label |
| `DsTable` | — | columns[], data[], onRowClick |
| `DsPagination` | — | page, totalPages, onChange |

### Compuestos (`src/components/composite/`)
| Componente | Props clave |
|---|---|
| `TodoItem` / `TodoList` | items[], onNew, onToggle, onClick, onViewAll |
| `IdeaList` | items[], onViewAll |
| `StatCard` | label, value, color, icon |
| `BarChart` | data[], highlightIndex, color |

## Cómo correr Storybook

```bash
pnpm storybook          # Dev en http://localhost:6006
pnpm build-storybook    # Build estático en storybook-static/
```

## Cómo añadir un componente nuevo

1. Crear el archivo en `src/components/ds/nombre.tsx`
2. Usar CSS variables de `design-tokens.css` (nunca valores hardcodeados)
3. Crear `src/components/ds/nombre.stories.tsx` con al menos:
   - Variante por defecto
   - Variantes principales
   - Estado interactivo si aplica
4. Verificar: `pnpm build-storybook` + `pnpm build`
5. Si es un compuesto de negocio, usa `src/components/composite/`
<!-- END:design-system -->

<!-- BEGIN:filter-icon-convention -->
# Convención de icono de filtros

TODOS los botones de filtro en cualquier app DEBEN usar el icono `Filter` de lucide-react (el embudo).

```tsx
import { Filter } from 'lucide-react'

<button className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-lg bg-card ...">
  <Filter size={14} /> {t('filter_label')}
  {activeFilters > 0 && <span className="badge">{count}</span>}
</button>
```

**NO usar:** `SlidersHorizontal`, ni SVG inline del icono de sliders.
**NO usar:** selects inline para filtros — usar botón + modal bottom sheet.
<!-- END:filter-icon-convention -->
