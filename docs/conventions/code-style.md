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

La UI solo usa **tokens semánticos** (`bg-background`, `text-foreground`...), definidos en `apps/admin/src/app/globals.css` (único sitio con valores de color crudos; el modo claro/oscuro vive ahí).

**Mecánico** (error de lint en `apps/admin/src/**/*.{ts,tsx}`, sobre cualquier string o plantilla literal, así que cubre `className`, `cn(...)`, `clsx(...)`, constantes):

- Utilidades Tailwind con paleta cruda: `bg|text|border|ring|ring-offset|outline|fill|stroke|from|via|to|divide|decoration|accent|caret|shadow|placeholder` + `slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose` + `-<50..950>` (con o sin variantes `dark:`/`hover:` y opacidad `/50`). Ej.: `bg-gray-100`, `dark:text-slate-50`.
- `white`/`black` crudos con esas utilidades: `bg-white`, `text-black`.
- Valores arbitrarios de color: `bg-[#fff]`, `text-[rgb(0,0,0)]`, `border-[oklch(...)]` (`#`, `rgb(a)`, `hsl(a)`, `oklch`, `oklab`, `lab`, `lch`).
- Un string que **es** un color completo: `"#fff"`, `"rgb(0 0 0)"`.

**No lo detecta el lint** (queda a revisión): colores dentro de un string más largo que no sean clases Tailwind (p. ej. `"border: 1px solid #fff"`), objetos `style={{ color: ... }}` con nombres de color (`"red"`), clases construidas por concatenación (`"bg-" + color`), colores en ficheros `.css`/`.svg` distintos de `globals.css`, y colores en Kotlin.

Excepción: nada. Para un color nuevo, define el token en `globals.css` (claro y oscuro) y úsalo por nombre.

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
- Todo string visible al usuario pasa por una clave i18n **cuando exista la infraestructura i18n** (antes de eso, texto en una constante del módulo, no disperso por el JSX). Claves en los 4 locales (es, ca, en, it).
- Errores tratados explícitamente: nada de `catch {}` vacío que oculte fallos (los degradados deliberados, como `/api/health`, se documentan en el código).
- Secretos solo desde variables de entorno; `SUPABASE_SERVICE_ROLE_KEY` nunca con prefijo `NEXT_PUBLIC_` ni en código de cliente.
- Funciones pequeñas con un propósito; los límites de complejidad del lint son un techo, no un objetivo.

**Prohibidos**
- Colores hardcodeados (ver arriba).
- `any` y `@ts-ignore` (los rechaza el lint; si es inevitable, `@ts-expect-error` con el motivo en un comentario).
- Acceso a la BD desde clientes externos: móvil y terceros usan `/api/v1`.
- Código muerto, código comentado, `console.log` de depuración.
- Dependencias nuevas sin necesidad demostrada; fijar versiones de acciones de terceros en CI.

## Comentarios

Solo donde el código no se explica solo (el porqué, no el qué). Sin comentarios que repitan el código.

