# Plan — Sprint 02, Task 02: Design System v1 (componentes base admin)

Spec: `docs/superpowers/specs/2026-10-25-design-system.md` · Mockup: `docs/brand/mockups/ds.html` · Base: identidad D (ADR 0002), tokens en `apps/admin/src/design-tokens.css`

**Alcance:** componentes base del admin web (`apps/admin`) con TDD. Fuera de alcance (backlog): componentes Android (Compose), Storybook, toggle claro/oscuro en la app.

## Objetivo

Replicar la pantalla del mockup (`ds.html`, sección 1 admin) en código real con fidelidad 1:1 de tokens, usando **solo tokens semánticos** y TDD (rojo → verde → refactor).

## Ficheros objetivo (en `apps/admin/src/`)

| Componente | Ruta | Variantes / notas |
|---|---|---|
| Button | `components/ui/button.tsx` | `primary`, `secondary`, `ghost`, `destructive` |
| Badge | `components/ui/badge.tsx` | `success`, `destructive`, `neutral` (píldoras del mockup) |
| KpiCard | `components/ui/kpi-card.tsx` | etiqueta 11px uppercase, valor en mono 18px, delta opcional |
| DataTable | `components/ui/data-table.tsx` | cabecera muted 11px uppercase, filas hairline, celdas numéricas a la derecha en mono |
| LayoutShell | `components/layout-shell.tsx` | sidebar (nav-item activo `bg-primary`) + topbar |

Integración: `app/page.tsx` (o ruta nueva si la estructura lo exige) reproduciendo la pantalla del mockup.

## Paso a paso

- [ ] **Paso 1 (RED):** tests de cada componente (vitest, `componente.test.tsx` junto al código). Render con `react-dom/server` (`renderToStaticMarkup`) en entorno node, aserciones sobre estructura y clases token. **Sin dependencias nuevas** (agregar testing-library/jsdom exige justificación y es infra).
- [ ] **Paso 2 (GREEN):** implementar cada componente con el mínimo que pasa el test.
- [ ] **Paso 3 (REFACTOR):** limpiar variantes comunes (p. ej. base de clases de botón) manteniendo verde.
- [ ] **Paso 4 (INTEGRACIÓN):** montar la pantalla del dashboard en `app/page.tsx` con los componentes.
- [ ] **Paso 5 (VERIFICAR):** `pnpm lint && pnpm tsc && pnpm test` y `pnpm --filter admin build` en verde con salida leída.
- [ ] **Paso 6 (COMMIT):** `feat(admin): design system v1 base components`.

## Criterios de aceptación (spec §5)

- Fidelidad 1:1 de tokens con `design-tokens.css` (sin colores hardcodeados; el lint lo rechaza).
- Accesibilidad AA de contraste en badges/botones, en claro y oscuro.
- Naming y estructura según `docs/conventions/code-style.md` (kebab-case, PascalCase, imports `@/`).

## Notas de implementación

- Badges con fondo translúcido del color al ~10–12%: **preferir `bg-success/10`, `bg-destructive/10`…** (modificador de opacidad sobre color semántico, sin paleta cruda). Si Tailwind v4 no lo genera, definir tokens nuevos en `design-tokens.css` **(claro y oscuro)** + `tokens.json` + test de paridad; nunca valores crudos en el componente.
- Cualquier componente/layout de Next: leer antes el doc relevante en `apps/admin/node_modules/next/dist/docs/` (el `AGENTS.md` de `apps/admin` lo exige; Next 16 difiere de versiones previas).
- Contraste AA de badges de color clara: si falla con el token puro, ajustar el fondo translúcido, no el componente.

## Decisiones de revisión (QA `ingeniero`, ver informe)

Hallazgos ALTO y MEDIO del QA corregidos: conflicto de bordes de botón (variantes sin `border-transparent` + test de regresión), badge success claro con token nuevo `--success-subtle` (AA 4.5:1 verificada por test WCAG puro, claro y oscuro), semántica de nav (`<nav>` + `aria-current`), `scope="col"` y caption accesible en DataTable, overflow-x-auto, tests reforzados (borde con fila real, delta marcador), paridad `globals.css` añadida a `design-tokens.test.ts`, `whitespace-nowrap`, estados `disabled`/`focus-visible` en botón, `text-[11px]`/`text-[13px]` por mockup, portabilidad de vitest (`fileURLToPath`), títulos en constantes. Datos de la pantalla alineados al mockup (balances, delta "Octubre", tonos de balance).

Hallazgos rechazados/documentados como decisión (no bloquean):
- **Enlaces placeholder (`#miembros`…) y botón sin handler**: pantalla estática de design system; se cablea en su tarea de módulo. La spec no pide navegación real en v1.
- **Layout responsivo**: sustituye la decisión anterior de grid fijo tras la prueba del usuario en móvil (26-10, commit `ee37ed0`): `grid-cols-1` por defecto, `lg:grid-cols-[200px_1fr]`, nav horizontal con `overflow-x-auto` por debajo de `lg`, tabla con overflow y KPIs responsivos (ya existentes). Sin drawer: el nav horizontal con scroll cubre el caso móvil del admin v1.
- **`tailwind-merge`/conflictos de `className`**: la API documentada de los componentes es que `className` es aditivo (layout) y el cambio de variante se hace por prop `variant`; no se añade dependencia sin necesidad.
- **`key` por índice en filas**: aceptable para datos estáticos del dashboard; se introduce `rowKey`/claves estables cuando haya filas dinámicas.
- **Spacing del brand y marco `.admin` exterior**: se mantiene la composición a pantalla completa (adaptación del mockup); el marco-caja interior (sección surface) conserva borde+radio.