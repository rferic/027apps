# Dirección B — Profesional y limpio

> Propuesta de identidad visual para 027Apps. Documento comparativo de la tarea 7 del sprint 01; **no es la decisión final** (esa irá en `docs/brand/brand.md`). Los hex de este documento son la propuesta de paleta; en código de producto los colores se consumen solo vía tokens semánticos.

Mockup: [`../mockups/b.html`](../mockups/b.html) — abrir en el navegador; el botón de la barra superior alterna claro/oscuro.

## Idea

La herramienta seria: sistema neutro frío, azul tinta como único color de acción, bordes finos en lugar de sombras y una tipografía editorial (serif en títulos y cifras, sans neutra en la interfaz). Alta densidad y jerarquía clara, como un panel de gestión de producto. El color casi desaparece para que mande la información.

## Paleta (roles semánticos)

| Rol | Claro | Oscuro | Uso |
|---|---|---|---|
| `background` | `#F6F7F9` | `#0E1015` | Fondo de página |
| `surface` | `#FFFFFF` | `#151820` | Tarjetas, tablas, barra superior, popovers |
| `muted` | `#EDEFF3` | `#1C2029` | Fondos secundarios: inputs, cabeceras de tabla, hover, chips |
| `muted-foreground` | `#566071` | `#9CA4B3` | Texto secundario: etiquetas, fechas, ayudas |
| `foreground` | `#12161F` | `#E7E9EE` | Texto principal |
| `primary` | `#1D4ED8` | `#7C9CFF` | Acción principal, enlaces, elemento activo, foco |
| `primary-foreground` | `#FFFFFF` | `#0A1128` | Texto/icono sobre `primary` |
| `border` | `#DADEE6` | `#2A2F3B` | Bordes y separadores |
| `destructive` | `#C62828` | `#FF7B72` | Acciones destructivas y errores |
| `destructive-foreground` | `#FFFFFF` | `#1A0606` | Texto sobre `destructive` |
| `success` | `#17713F` | `#4CC38A` | Estados correctos, importes a favor |

Roles extra sobre el mínimo (justificación):

- `muted-foreground` — Extra: el texto secundario necesita su propio color con contraste AA; reutilizar `muted` o `foreground` con opacidad no lo garantiza.
- `destructive-foreground` — Extra: el botón destructivo relleno necesita texto con contraste AA en ambos modos (en oscuro el texto es oscuro, no blanco).

Contraste WCAG calculado sobre estos hex (mínimo 4,5:1 para texto, todas las parejas lo cumplen):

| Pareja | Claro | Oscuro |
|---|---|---|
| `foreground` / `background` | 16,9 | 15,7 |
| `muted-foreground` / `surface` | 6,3 | 7,1 |
| `primary-foreground` / `primary` | 6,7 | 7,2 |
| `destructive-foreground` / `destructive` | 5,6 | 7,8 |
| `success` / `surface` | 6,1 | 8,0 |
| `destructive` / `surface` | 5,6 | 7,0 |

## Tipografía

- **Fuente de interfaz**: **Inter** (400/500/600), Google Fonts. La sans de interfaz de referencia; cifras tabulares nativas.
- **Fallbacks**: `'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif`
- **Titulares y cifras**: **Source Serif 4** (600/700) en títulos de página y cifras KPI, como toque editorial. Fallback: `Georgia, 'Times New Roman', serif`.
- **Escala**: Base 13,5 px · títulos 30 px serif/700 · cifras KPI 26 px serif/600 · etiquetas 11 px en mayúsculas con tracking · radios 6/5 px, sin sombras.

## Personalidad y tono (microcopy de UI)

Neutro y preciso, sin adornos: «Gasto añadido», «No se pudo guardar: revisa el importe».

## Dirección de logo (solo insumo; sin assets todavía)

Wordmark tipográfico en Inter 700 con tracking ajustado; «Apps» en gris. Icono de app: monograma «027» sobre cuadrado azul tinta de esquinas contenidas.

## Cuándo elegirla

- **Encaja**: es la mejor para el panel del mantenedor — máxima densidad, tablas y formularios largos legibles, y el estilo envejece bien; el sistema de tokens es el más fácil de extender (neutros + un solo acento).
- **Riesgo**: es la menos «familiar». Si la app móvil la hereda tal cual puede sentirse fría para el uso doméstico; habría que suavizar radios y tamaños en Android.
- **Riesgo**: es la más genérica: se parece a muchos SaaS. La serif en títulos es lo que aporta carácter; si se descarta, queda anónima.
