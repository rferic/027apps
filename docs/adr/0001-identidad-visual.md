# ADR 0001 — Identidad visual: Dirección A (cercana y cálida)

**Fecha:** 2026-10-24
**Estado:** Sustituida por ADR 0002 (2026-10-25)
**Decisora:** usuario (rferic), tras puerta de elección con mockups

## Contexto

027Apps es una plataforma familiar (app Android para la familia + panel web para admins). La identidad visual condiciona los design tokens del sprint y el branding futuro. Se propusieron tres direcciones (A cálida, B profesional, C contraste contemporáneo) y tres refinaciones de C (C1 ejecutiva, C2 cálida moderna, C3 contraste refinado).

## Decisión

Se elige la **Dirección A — cercana y cálida** (`docs/brand/identities/a.md`, mockup `docs/brand/mockups/a.html`).

- Paleta: crema cálido + terracotta, modo claro/oscuro
- Tipografía: Nunito (redonda, amable)
- Personalidad: "como una app de familia hecha con cariño"
- Botón destructivo en outline (variante propia de A, documentada)

## Alternativas consideradas

- **B — profesional/limpia**: descartada; demasiado genérica para un producto familiar.
- **C — contraste contemporáneo**: la refinación fue buena base pero el usuario la descartó tras probar C1/C2/C3.
- **C1/C2/C3 (refinaciones de C)**: descartadas; el usuario prefirió la identidad A.

## Consecuencias

- Los tokens base del admin (Task 8) se derivan de los roles y valores de `a.md` (light + dark).
- El branding completo (logo, icono, splash) se diseñará sobre esta dirección.
- Contraste AA verificado: mínimo documentado 4,68:1 (parejas tintadas incluidas tras el fix).
- La misma paleta y tipografía se aplicará como referencia al tema Material3 de la app Android cuando exista el DS móvil.
