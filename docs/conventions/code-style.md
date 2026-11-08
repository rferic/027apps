# Convenciones de código

Qué se exige, y **quién lo hace cumplir**. Lo mecánico lo rechaza una herramienta (CI en rojo); lo semántico lo comprueba la revisión de un agente distinto del autor.

## Qué se hace cumplir y cómo

| Regla | Mecanismo | Alcance real |
|---|---|---|
| Sin colores hardcodeados en TS/TSX | ESLint `no-restricted-syntax` en `apps/admin/eslint.config.mjs` (job `admin`, `pnpm --filter admin lint`) | Ver [Colores](#colores) |
| Complejidad ciclomática ≤ 10, anidamiento ≤ 3, ≤ 4 parámetros por función | ESLint `complexity`, `max-depth`, `max-params` sobre `apps/admin/src/**/*.{ts,tsx}` | Completa |
| Reglas de Next.js, React hooks y TypeScript, incluidos `any` explícito (`no-explicit-any`) y `@ts-ignore` (`ban-ts-comment`) | `eslint-config-next` (`core-web-vitals` + `typescript`) | Completa |
| Tipos correctos | `pnpm --filter admin tsc` (job `admin`) | Completa |
| Comportamiento | vitest (`pnpm --filter admin test`) | Lo que cubran los tests |
| Título de PR / commits convencionales | commitlint (`.commitlintrc.json`, job `commitlint`) | Solo el título del PR |
| Sin secretos ni keystores en git | job `guard-secrets` | Patrones conocidos |
| Naming, estructura, zod, i18n, `console.log`, código muerto/comentado, claridad | **Revisión** (ver DoD) | No hay check automático |

Si una regla de revisión falla de forma repetida, conviértela en regla de ESLint o test en vez de insistir en la revisión.

## Colores

La UI solo usa **tokens semánticos** (`bg-background`, `text-foreground`...), definidos en `apps/admin/src/design-tokens.css` (único sitio con valores de color crudos; ahí viven los valores claro/oscuro) y mapeados a utilidades de Tailwind en `apps/admin/src/app/globals.css`. El espejo `apps/admin/tokens.json` lo mantiene un test de paridad (`src/design-tokens.test.ts`).

Dos roles de marca con propósitos distintos: **`--accent`** es para texto y estado (enlaces, foco, mensajes), y **`--brand`** es solo para la marca gráfica (el latido del logo); no los intercambies.

**Mecánico** (error de lint en `apps/admin/src/**/*.{ts,tsx}`, sobre cualquier string o plantilla literal, así que cubre `className`, `cn(...)`, `clsx(...)`, constantes):

- Utilidades Tailwind con paleta cruda: `bg|text|border|ring|ring-offset|outline|fill|stroke|from|via|to|divide|decoration|accent|caret|shadow|placeholder` + `slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose` + `-<50..950>` (con o sin variantes `dark:`/`hover:` y opacidad `/50`). Ej.: `bg-gray-100`, `dark:text-slate-50`.
- `white`/`black` crudos con esas utilidades: `bg-white`, `text-black`.
- Valores arbitrarios de color: `bg-[#fff]`, `text-[rgb(0,0,0)]`, `border-[oklch(...)]` (`#`, `rgb(a)`, `hsl(a)`, `oklch`, `oklab`, `lab`, `lch`).
- Un string que **es** un color completo: `"#fff"`, `"rgb(0 0 0)"`.

**Falso positivo conocido (raro)**: el patrón hexadecimal también casa con strings que parecen un color sin serlo (p. ej. `href="#cafe"`, `"#bad"`). Si ocurre, se resuelve por revisión (reformular el valor o justificarlo en el PR); no se añade un `eslint-disable` sin motivo escrito.

**No lo detecta el lint** (queda a revisión): colores dentro de un string más largo que no sean clases Tailwind (p. ej. `"border: 1px solid #fff"`), objetos `style={{ color: ... }}` con nombres de color (`"red"`), clases construidas por concatenación (`"bg-" + color`), colores en ficheros `.css`/`.svg` distintos de `globals.css`, y colores en Kotlin.

Excepción: nada. Para un color nuevo, define el token en `globals.css` (claro y oscuro) y úsalo por nombre.

Excepción de plataforma: los elementos nativos (`<dialog>`, `<select>`, `<input>`) heredan colores del navegador (CanvasText/Canvas); si se usan, se les fija siempre el token correspondiente (`bg-surface text-foreground`).

## Listas y paginación

Toda lista del panel se pagina **en servidor**: el endpoint acepta `limit`/`offset` y devuelve
`total`; la UI usa `components/ui/pagination.tsx` y pasa `page` por query. Nunca se cargan todos
los registros para filtrar o paginar en cliente (los filtros de cliente solo acotan una página ya
paginada). Una lista nueva sin paginación no pasa revisión.

El texto se busca **mientras se escribe** con `components/ui/search-input.tsx` (debounce de 300 ms;
Enter aplica al instante y Escape limpia), **nunca con un botón de buscar** ni con un formulario GET.
Los selectores se aplican al cambiar. Búsqueda y selectores conservan el resto de filtros y reinician
`page`.

**Toda lista arranca en el estado vivo** (`active` en miembros, claves y módulos; `pending` en
invitaciones). **"All" es un valor explícito** (`state=all` / `status=all`), nunca la opción vacía; el
valor por defecto se omite de la URL canónica y la paginación, los demás filtros, el reintento y las
redirecciones lo conservan.

**Excepción consciente: `/modules` arranca en `all`**, no en `active`. Un módulo desactivado sigue
siendo parte del catálogo instalado y el usuario quiere verlo por defecto; `installed` y `disabled`
son estados normales, no ruido. Por eso `all` es el valor por defecto de esa lista y se omite de la
URL canónica. Cualquier otra lista que quiera el mismo comportamiento debe justificarlo aquí.

**Todo formulario de creación se resetea al montar**: una visita nueva a `/…/new` empieza vacía y sin
el secreto/token de la creación anterior. Cache Components conserva el estado de los componentes al
navegar (React `<Activity>`), así que el reset va en `lib/use-create-form.ts` y no en un `useState`
suelto; ver [Diálogos y formularios](#diálogos-y-formularios).

## Naming

- Ficheros y carpetas: `kebab-case` (`user-menu.tsx`). Excepciones impuestas por Next.js (`page.tsx`, `layout.tsx`, `route.ts`).
- Componentes React y tipos: `PascalCase`. Funciones y variables: `camelCase`. Constantes de módulo inmutables: `UPPER_SNAKE_CASE` (`APP_NAME`).
- Tests junto al código: `foo.ts` → `foo.test.ts`.
- Nombres que dicen qué es, no cómo se obtuvo. Sin abreviaturas crípticas.
- Kotlin: convenciones oficiales de Kotlin.

## Estructura (apps/admin/src)

- `app/` — solo rutas, layouts y route handlers (`app/api/v1/...`). Lógica mínima: delega.
- `lib/` — lógica de dominio y utilidades, sin dependencias de React cuando sea posible.
- Un módulo, una responsabilidad. Código compartido entre apps va a `packages/*`, no se copia.
- Imports con alias `@/` (no `../../..`).

## Patrones

**Obligatorios**
- Validar con **zod** todo input externo en el borde (route handlers, server actions, variables de entorno). Dentro del borde se confía en los tipos inferidos.
- Todo string visible al usuario pasa por una clave i18n **cuando exista la infraestructura i18n** (antes de eso, texto en una constante del módulo, no disperso por el JSX). Texto en inglés como clave; catálogo + locales del set de 9 (`en` no se traduce) — ver [`i18n.md`](../flows/i18n.md).
- Errores tratados explícitamente: nada de `catch {}` vacío que oculte fallos (los degradados deliberados, como `/api/health`, se documentan en el código).
- Secretos solo desde variables de entorno; `SUPABASE_SERVICE_ROLE_KEY` nunca con prefijo `NEXT_PUBLIC_` ni en código de cliente.
- Funciones pequeñas con un propósito; los límites de complejidad del lint son un techo, no un objetivo.

**Prohibidos**
- Colores hardcodeados (ver arriba).
- `any` y `@ts-ignore` (los rechaza el lint; si es inevitable, `@ts-expect-error` con el motivo en un comentario).
- Acceso a la BD desde clientes externos: móvil y terceros usan `/api/v1`.
- Código muerto, código comentado, `console.log` de depuración.
- Dependencias nuevas sin necesidad demostrada; acciones de terceros en CI fijadas por SHA de commit (las `actions/*` propias de GitHub pueden ir en tag mayor, p. ej. `actions/checkout@v4`).

## Diálogos y formularios

Los formularios y diálogos del admin siguen **un único patrón**; no se improvisa por pantalla.

- **Páginas, no modales de creación**: todo formulario con campos vive en su propia ruta
  (`/categories/new`, `/invitations/new`, `/keys/new`), con `requirePanel`, `instant = false`,
  breadcrumb, `h1` y enlace "Back". El listado enlaza con un `Link` primario; no hay triggers modales
  ni formularios de creación dentro de un diálogo. Un token o secreto de un solo uso se muestra en esa
  página con "Copy" y "Done" al listado.
- **Reset al montar**: los tres formularios de creación usan `lib/use-create-form.ts`
  (`useCreateForm`). El hook limpia el flujo cuando la ruta se oculta y cuando vuelve a mostrarse, y
  expone `reset()` y `formKey` para remontar los campos. Nunca guardes el secreto/token ni los errores
  en estado que sobreviva a una visita.
- **Diálogos**: solo para confirmar acciones destructivas (y el drawer móvil, que necesita layout
  lateral). Siempre el `Dialog` compartido (`apps/admin/src/components/ui/dialog.tsx`). Nunca un
  `<dialog>` suelto. El elemento nativo hereda `color: CanvasText` y `background: Canvas` del navegador,
  así que **siempre** lleva `bg-surface text-foreground`; sin eso, el texto sale negro en tema oscuro
  (bug real que apareció en todos los modales del panel).
- **Marca**: la instancia no tiene logo configurable (`instance.logo_url` ya no existe). `BrandLogo`
  solo acepta `variant` (`wordmark`/`mark`) y `name`; no vuelvas a añadir una URL de logo.
- **Formularios**: `FormField`, `FieldError`, `FormAlert`, `FormActions` y `FormSection`
  (`apps/admin/src/components/ui/form.tsx`), tanto en página como en confirmaciones. Etiqueta asociada por
  `htmlFor`/`id`, ayuda en `text-muted-foreground`, error en `text-destructive` con `aria-describedby`
  y `aria-invalid`, y acciones a la derecha con `min-h-11`.
- **Controles**: los campos usan las primitivas del DS (`ui/select.tsx`, `ui/button.tsx`, etc.); nada de
  `<select>` con clases sueltas ni de repetir el estilo del control en cada pantalla.
- **Multiselección**: usa `ui/multi-select.tsx` (combobox con chips, buscador y navegación por teclado)
  en vez de reimplementar una lista de checkboxes. `<fieldset>`/`<legend>` queda para grupos pequeños
  sin búsqueda.
- **Excepciones** (documentadas en el código): el drawer móvil necesita layout lateral y no usa `Dialog`.
- **Verificación**: cualquier modal o formulario nuevo se mira en claro y oscuro, y a 375 px. Hay un test
  (`apps/admin/src/components/ui/raw-dialog.test.ts`) que falla si aparece un `<dialog>` fuera del
  componente compartido.

## Comentarios

Solo donde el código no se explica solo (el porqué, no el qué). Sin comentarios que repitan el código.
