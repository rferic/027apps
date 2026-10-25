# ADR 0003 — Logo: Dirección L4 «Latido» (herencia del legacy en identidad D)

**Fecha:** 2026-10-25
**Estado:** Aceptada
**Decisora:** usuario (rferic)
**Depende de:** ADR 0002 (identidad D)

## Contexto

Para el branding completo (sprint 02, task 1) se propusieron tres direcciones de logo construidas sobre la identidad D: L1 «anillo» (el 0 como anillo de progreso), L2 «punto terminal» (wordmark monocromo con punto teal) y L3 «mesa» (anillo cerrado con tres puntos de familia), en `docs/brand/mockups/logo.html`. El usuario redirigió: la base correcta es la idea del proyecto legacy (`~/Sites/027apps`), cuyo logo —el «latido»— ya existía como `HeartbeatLogo`: línea de electrocardiograma blanca sobre cuadrado rojo `#9B1C1C`, «027» dentro del icono, «Apps» en color de marca y tagline «YOUR APPS. YOUR GROUP.». Sobre esa herencia se construyó la dirección L4 (`docs/brand/mockups/logo-l4.html`), que el usuario confirmó.

## Decisión

Se adopta la **Dirección L4 «Latido»**: la estructura del logo legacy con la piel de la identidad D.

- **Icono**: squircle zinc `#0E0F11` (hairline blanca alfa) con el electro teal `#1CC29F` y «027» en JetBrains Mono debajo — misma composición que el legacy. Variante simplificada «solo latido» para tamaños pequeños (favicon 16–24 px).
- **Wordmark**: «027» en Inter 800 + «Apps» en el color de marca (teal `#1CC29F` en oscuro, `#09795F` en claro), con tagline «YOUR APPS. YOUR GROUP.» en JetBrains Mono espaciada. Variante sin tagline para headers.
- **Por qué teal y no el rojo legacy**: la identidad D fijó el teal como color de marca (ADR 0002) y los monitores ECG reales trazan en verde, así que el cambio de piel refuerza la lectura del símbolo.

## Alternativas consideradas

- **L1 / L2 / L3 (propuestas sobre D)**: descartadas cuando el usuario indicó que la base es el latido del legacy.
- **Mantener el rojo `#9B1C1C` del legacy**: descartado; chocaría con la identidad D aceptada y rompería la regla de un solo acento de marca.
- **Regenerar el logo con IA en raster**: descartado; el wordmark depende de la tipografía exacta y los tokens, y el resultado debe ser determinista, editable y versionable (SVG de paths).

## Consecuencias

- Assets masters en `docs/brand/assets/` (SVG sin dependencia de fuentes) generados por `scripts/brand/build-assets.py` (fontTools + HarfBuzz) y renders por `scripts/brand/render.sh` (ImageMagick).
- Admin: `icon.svg` + `icon.png` + `apple-icon.png` + `favicon.ico` en `apps/admin/src/app/`.
- Android: adaptive icon (`mipmap-anydpi-v26` + foreground vectorial + fondo `#0E0F11`), mipmaps legacy y splash con fondo claro/oscuro.
- Guía de uso en `docs/brand/brand.md` (área de respeto, tamaños mínimos, no-hacer, pipeline).
- Queda pendiente para branding posterior: CIP completo, landing y plantillas sociales (fuera del alcance de esta task).
