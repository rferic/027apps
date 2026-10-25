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