---
id: sprint01-task-08
titulo: Tokens de diseño base en el admin (según identidad elegida)
area: fundaciones
estado: finalizada
plan: docs/superpowers/plans/2026-10-24-sprint-01-fundaciones.md
---

Tarea 8 del sprint 01. Detalle en el plan.

Implementada dos veces: primero sobre la identidad A (2026-10-24) y rehecha el 2026-10-25 sobre la **identidad D** tras la decisión del usuario (ADR 0002, que sustituye al ADR 0001). Fuente: `docs/brand/identities/d.md`.

## Implementación (versión D)

- `apps/admin/src/design-tokens.css`: light por defecto + dark vía `prefers-color-scheme`. Paleta zinc + teal, botón primario monocromo, rol nuevo `--accent`, `color-scheme: light dark`, radios 12/8.
- `apps/admin/tokens.json`: espejo exportable (futuro consumidor: Android) con los 12 roles de color + radios y notas de limitación.
- `apps/admin/src/app/globals.css`: mapeo `@theme` con `--color-accent` y `--font-mono` nuevos; base 14 px; fuentes Inter + JetBrains Mono.
- `apps/admin/src/app/layout.tsx`: `next/font/google` Inter (400–800) + JetBrains Mono (500/600), autohospedadas en build.
- `apps/admin/src/app/page.tsx`: botones demo con radio de control (8 px) en vez de píldora, acorde a la forma D.
- Test de paridad `src/design-tokens.test.ts`: `tokens.json` ↔ `design-tokens.css` no pueden divergir (5 aserciones, normalizando formato).

## Verificación

`pnpm lint`, `pnpm tsc`, `pnpm test` (6/6) y `pnpm --filter admin build` en verde, con salida leída. Contraste AA verificado en ambos modos (mínimo 4,62:1; tabla en `d.md`).

## Revisión y auditoría (2026-10-25, agentes distintos del autor)

- **Estilo** (enfermero): APROBADO. Hallazgos menores cerrados: valor de contraste 9,05→8,79 en `d.md`, encabezado de `d.md` actualizado a identidad aceptada, radios añadidos al espejo JSON.
- **Seguridad (OWASP)** (ingeniero): APROBADO, sin hallazgos críticos ni altos. Cierre de hallazgos: AUD-01 test de paridad añadido; AUD-02 `color-scheme` añadido; AUD-03/AUD-04 divergencias doc↔código corregidas; AUD-05 radios en JSON + notas de limitación; AUD-06 frase de `code-style.md` corregida; AUD-07/AUD-08 sin acción (patrón preexistente de mockups, solo documentación).
- Deuda explícita restante: roles extra de la identidad (`surface-2`, `input`, `warning`, tintes) se añadirán cuando haya componentes que los consuman; border oscuro `rgba` requerirá conversión a hex al consumirse desde Android.
