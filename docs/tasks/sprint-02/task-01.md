---
id: sprint02-task-01
titulo: Branding completo — logo, icono de app, splash y favicon
area: marca
estado: finalizada
plan: docs/superpowers/plans/2026-10-25-sprint-02-branding.md
---

Task 1 del sprint 02. Detalle en el plan. Spec: `docs/superpowers/specs/2026-10-25-027apps-branding.md` (aprobada).

## Resultado

Logo **L4 «Latido»** (ADR 0003): la idea del legacy (`HeartbeatLogo`, rojo `#9B1C1C`) con la piel de la identidad D — squircle zinc `#0E0F11`, electro teal `#1CC29F`/`#09795F`, «027» en JetBrains Mono, tagline «YOUR APPS. YOUR GROUP.».

- Masters SVG sin fuentes (texto→paths con HarfBuzz+fontTools): `docs/brand/assets/` (wordmark light/dark/mono y *bare*, icono claro/oscuro, mark). Generador determinista: `scripts/brand/build-assets.py`; renders: `scripts/brand/render.sh` (ImageMagick, 8-bit).
- Admin: `icon.svg`, `icon.png`, `apple-icon.png`, `favicon.ico` en `apps/admin/src/app/`.
- Android: adaptive icon (fondo `#0E0F11` + foreground vectorial), mipmaps legacy, splash claro/oscuro (`windowSplashScreenBackground`).
- Guía de marca: `docs/brand/brand.md`.

## Verificación

`pnpm lint`, `pnpm tsc`, `pnpm test` (6/6), `pnpm --filter admin build`, `./gradlew :app:assembleDebug` y `:app:testDebugUnitTest` en verde, con salida leída.

## Revisión y auditoría (2026-10-25, agentes distintos del autor)

- **Estilo** (enfermero): CAMBIOS NECESARIOS → corregidos: bloqueante `TEAL_INK` `#0C8A6E`→`#09795F` (color fuera de la paleta D y AA real 4,31:1) con regeneración completa; typos de `brand.md`; plan alineado al entregable real (`apple-icon.png`); opacidad del «027» unificada (0,75); checkboxes del plan. Apuntes aplicados: ejecutable + docstring sin `brotli`, comentario en `values-night`.
- **Seguridad (OWASP)** (ingeniero): APROBADO con cambios menores, sin críticos ni altos. F-01 (mismo teal fuera de paleta) y F-02 (PNG a 8-bit para Play Store) corregidos; F-03/F-06 corregidos; F-04 (nombres propios en mockups, repo público) y F-05 (scripts inline en mockups) → backlog, no introducidos por esta task.
- Deuda explícita restante: sustituir nombres propios por placeholders en mockups históricos (tarea docs futura); `values-night/themes.xml` cuando la app soporte modo oscuro.
