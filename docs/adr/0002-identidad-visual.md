# ADR 0002 — Identidad visual: Dirección D (panel técnico, familia dentro)

**Fecha:** 2026-10-25
**Estado:** Aceptada
**Decisora:** usuario (rferic), tras cambiar las referencias de inspiración
**Sustituye a:** ADR 0001 (Dirección A — cercana y cálida)

## Contexto

La Dirección A (crema, terracotta, Nunito) llegó a implementarse en tokens (task 8). El usuario cambió después la base de inspiración para web y app: **OpenRouter**, **Orca (onorca.dev)** y la **app móvil de Splitwise**. Se analizó el CSS real de las dos webs (tokens, tipografías, radios) y la paleta publicada de Splitwise, y se sintetizó la dirección D (`docs/brand/identities/d.md`, mockup `docs/brand/mockups/d.html`), que el usuario eligió explícitamente.

## Decisión

Se elige la **Dirección D — «panel técnico, familia dentro»**.

- **Admin (web)**: oscuro primero, neutros zinc (`#08090A → #1A1B1E`), bordes hairline con alfa blanco, botón primario monocromo (blanco en oscuro / negro en claro), densidad compacta e importes en monoespaciada (herencia OpenRouter + Orca).
- **App móvil**: clara y amable, teal de marca `#1CC29F` con texto verde oscuro `#0C3C32` (pareja original de Splitwise), tarjetas planas, píldoras, avatares y semántica de dinero (a favor / debes).
- **Sistema común**: Inter + JetBrains Mono, una sola escala de neutros para ambos temas, teal como color de marca (enlaces, nav activo, foco, gráficos), radios 6/8/12/16/24 + píldora.
- El gradiente azul→violeta de OpenRouter queda reservado para branding (landing, logo), no para el cromo de la UI.
- El tono del microcopy se mantiene: tuteo cercano y frases cortas.

## Alternativas consideradas

- **Mantener A (cálida, terracotta, Nunito)**: descartada por el usuario; las nuevas referencias la sustituyen. Su documento (`docs/brand/identities/a.md`) queda como histórico.
- **Usar el azul→violeta de OpenRouter como color de acción**: descartado; se reserva para branding y gráficos para no competir con el dato y no caer en el look genérico shadcn.
- **Un solo look para web y app** (todo técnico o todo cálido): descartado; el admin gana eficacia con la densidad técnica y la app gana adopción familiar con el tono Splitwise. La marca compartida (teal + Inter + hairline) es lo que los une.

## Consecuencias

- Task 8 reabierta y rehecha: tokens light/dark del admin sobre `d.md`, con el rol nuevo `--accent` (teal), radios 12/8, tipografías Inter + JetBrains Mono y base de 14 px.
- Contraste AA verificado en ambos modos (mínimo 4,62:1; tabla completa de parejas en `d.md`).
- El branding completo (logo, icono, splash) del sprint 2 se diseñará sobre esta dirección: wordmark Inter 800 con anillo teal, icono squircle oscuro con hairline blanca.
- La app Android tomará esta paleta como referencia Material3 cuando exista el DS móvil.
- Mockup `docs/brand/mockups/d.html` muestra las 4 combinaciones (admin y app, cada uno en claro y oscuro).
