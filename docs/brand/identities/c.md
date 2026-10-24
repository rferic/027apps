# Dirección C — Contraste contemporáneo

> Propuesta de identidad visual para 027Apps. Documento comparativo de la tarea 7 del sprint 01; **no es la decisión final** (esa irá en `docs/brand/brand.md`). Los hex de este documento son la propuesta de paleta; en código de producto los colores se consumen solo vía tokens semánticos.

Mockup: [`../mockups/c.html`](../mockups/c.html) — abrir en el navegador; el botón de la barra superior alterna claro/oscuro.

## Idea

Una identidad oscura primero, con personalidad: fondo casi negro con un matiz índigo, violeta saturado como acción y un lima ácido como segundo acento de marca (logo, ítem activo, avatar). Tipografía geométrica con carácter, cifras grandes y bordes luminosos. Llama la atención y se recuerda; el modo claro es un lavanda limpio con los mismos acentos.

## Paleta (roles semánticos)

| Rol | Claro | Oscuro | Uso |
|---|---|---|---|
| `background` | `#F5F3FF` | `#09090F` | Fondo de página |
| `surface` | `#FFFFFF` | `#13131E` | Tarjetas, tablas, barra superior, popovers |
| `muted` | `#EAE6FB` | `#1D1D2D` | Fondos secundarios: inputs, cabeceras de tabla, hover, chips |
| `muted-foreground` | `#5A5380` | `#A6A6C4` | Texto secundario: etiquetas, fechas, ayudas |
| `foreground` | `#130F26` | `#F4F4FB` | Texto principal |
| `primary` | `#6D28D9` | `#9566FF` | Acción principal, enlaces, elemento activo, foco |
| `primary-foreground` | `#FFFFFF` | `#0B0620` | Texto/icono sobre `primary` |
| `border` | `#D6CFF1` | `#2C2C44` | Bordes y separadores |
| `destructive` | `#C8102E` | `#FF5C7A` | Acciones destructivas y errores |
| `destructive-foreground` | `#FFFFFF` | `#1A0606` | Texto sobre `destructive` |
| `success` | `#0A7F5A` | `#2EE6A6` | Estados correctos, importes a favor |
| `highlight` | `#C8F560` | `#C8F560` | Acento secundario puntual (marca, ítem activo, avatar); nunca para texto sobre fondo claro |
| `highlight-foreground` | `#130F26` | `#130F26` | Texto sobre `highlight` |

Roles extra sobre el mínimo (justificación):

- `muted-foreground` — Extra: el texto secundario necesita su propio color con contraste AA; reutilizar `muted` o `foreground` con opacidad no lo garantiza.
- `destructive-foreground` — Extra: el botón destructivo relleno necesita texto con contraste AA en ambos modos (en oscuro el texto es oscuro, no blanco).
- `highlight` — Extra (solo C): segundo acento de la marca (lima). Idéntico en claro y oscuro porque siempre lleva texto oscuro encima.
- `highlight-foreground` — Extra (solo C): pareja de `highlight`.

Contraste WCAG 2.x calculado sobre estos hex. Todas las parejas listadas cumplen WCAG AA para texto (≥ 4,5:1); el mínimo es 4,93:1.

| Pareja | Claro | Oscuro |
|---|---|---|
| `foreground` / `background` | 17,03 | 18,14 |
| `foreground` / `surface` | 18,68 | 16,83 |
| `muted-foreground` / `background` | 6,42 | 8,39 |
| `muted-foreground` / `surface` | 7,04 | 7,79 |
| `muted-foreground` / `muted` | 5,77 | 7,01 |
| `primary-foreground` / `primary` | 7,10 | 5,30 |
| `primary` / `surface` (enlaces, texto de acento) | 7,10 | 4,93 |
| `destructive-foreground` / `destructive` | 5,88 | 6,59 |
| `destructive` / `surface` | 5,88 | 6,20 |
| `success` / `surface` | 5,00 | 11,39 |

## Tipografía

- **Fuente de interfaz**: **Space Grotesk** (400/500/600/700), Google Fonts. Grotesca geométrica con rasgos propios; las cifras destacan.
- **Fallbacks**: `'Space Grotesk', 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif`
- **Titulares y cifras**: Space Grotesk en 700 con tracking negativo para títulos y cifras; etiquetas en mayúsculas con tracking amplio. Sin segunda familia.
- **Escala**: Base 15 px · títulos 40 px/700 · cifras KPI 40 px/700 · etiquetas 11 px en mayúsculas · radios 14/10 px.

## Personalidad y tono (microcopy de UI)

Directo y con chispa, frases cortas: «Gasto añadido. Siguiente.», «Hoy hay 3 tareas, tú puedes».

## Dirección de logo (solo insumo; sin assets todavía)

Wordmark con «027» sobre chip lima (texto oscuro) y «Apps» en blanco/tinta. Icono de app: chip lima con «027» sobre fondo violeta muy oscuro; reconocible a 48 px.

## Cuándo elegirla

- **Encaja**: la más memorable y moderna; el lima + violeta dan una marca propia que ni A ni B tienen, y el modo oscuro luce de verdad (útil si el mantenedor trabaja de noche).
- **Riesgo**: es la más arriesgada para uso familiar con personas mayores o poco técnicas; el estilo «gaming/crypto» puede no transmitir calma doméstica. Cuidar contraste y tamaños en móvil.
- **Riesgo**: dos acentos (violeta + lima) exigen disciplina: el lima solo para marca/estado activo, nunca como texto sobre claro. Más fácil de usar mal que A o B; sus efectos (brillo, degradados) conviene limitarlos al admin.
