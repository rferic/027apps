# Dirección D — Panel técnico, familia dentro

> Identidad visual de 027Apps, **elegida el 2026-10-25** (ADR 0002, que sustituye al ADR 0001). Deriva de las referencias que dio el usuario: OpenRouter, Orca (onorca.dev) y la app móvil de Splitwise. En código de producto los colores se consumen solo vía tokens semánticos.

Referencias de las que deriva:

- **OpenRouter** (web): densidad de dashboard, cifras monoespaciadas, radios compactos, paleta de gráficos azul→violeta.
- **Orca / onorca.dev** (web): modo oscuro primero con neutros zinc, bordes hairline con alfa blanco, botón primario monocromo, Inter + JetBrains Mono.
- **Splitwise** (app móvil): teal de marca `#1CC29F` con texto verde oscuro `#0C3C32`, tarjetas planas, píldoras, avatares, semántica de dinero clara (a favor vs. debes).

La fusión: **el panel admin se comporta como una herramienta técnica** (oscura, densa, precisa, cromo monocromo) y **la app móvil se siente como una app de familia** (clara, teal, amable). Una sola escala de neutros y una sola tipografía unen ambos mundos; el teal es el hilo de marca común.

Mockup: [`../mockups/d.html`](../mockups/d.html) — admin y app en la misma página; el botón de la barra superior alterna claro/oscuro en ambos a la vez.

## Idea

Fuera la libreta de crema y terracota. El admin es un panel de control serio y denso, casi monocromo, donde el color solo aparece donde hay **dato** (importes, estados, gráficos) y en el **acento de marca** (teal). La app hereda el mismo sistema pero con la calidez de Splitwise: superficies claras, botones píldora teal, avatares de familia y saldos que se entienden de un vistazo. La personalidad del microcopy no cambia: sigue el tuteo cercano de la dirección A.

## Paleta (roles semánticos)

### Neutros (compartidos web + app)

| Rol | Claro | Oscuro | Uso |
|---|---|---|---|
| `background` | `#F6F7F8` | `#08090A` | Fondo de página |
| `surface` | `#FFFFFF` | `#0E0F11` | Tarjetas, tablas, barras, popovers |
| `surface-2` | `#F6F7F8` | `#141517` | Superficies elevadas: modales, dropdowns |
| `muted` | `#ECEEF0` | `#1A1B1E` | Inputs, cabeceras de tabla, hover, chips neutros |
| `muted-foreground` | `#5B6472` | `#8A8F98` | Texto secundario: etiquetas, fechas, ayudas |
| `foreground` | `#17191C` | `#F7F8F8` | Texto principal |
| `border` | `#E3E5E8` | `rgba(255,255,255,.09)` | Bordes hairline y separadores |
| `input` | `#E3E5E8` | `rgba(255,255,255,.10)` | Bordes de input |

Los neutros oscuros son la escala zinc de Orca (`#08090A → #1A1B1E`); los claros son su espejo frío. Un solo rampa para web y app.

### Acción y marca

| Rol | Claro | Oscuro | Uso |
|---|---|---|---|
| `primary` | `#17191C` | `#F7F8F8` | **Botón primario monocromo** (estilo Orca): el cromo no compite con el dato |
| `primary-foreground` | `#FFFFFF` | `#08090A` | Texto/icono sobre `primary` |
| `accent` (teal de marca) | `#09795F` | `#1CC29F` | Enlaces, ítem de nav activo, foco, KPIs a favor, CTA de la app |
| `accent-foreground` | `#FFFFFF` | `#05231C` | Texto sobre teal relleno |
| Tinte de acento | `#ACE4D6` | 14 % de `#1CC29F` sobre `surface` (`#102825`) | Chips, ítem activo, glifos de KPI |
| Texto sobre tinte | `#0C3C32` | `#1CC29F` | Texto/glyph dentro del tinte (pareja original de Splitwise) |

En claro el teal baja a `#09795F` para cumplir AA como texto (enlaces sobre blanco y `muted`); el teal puro `#1CC29F` se reserva en claro para superficies rellenas (botones de la app) con su texto verde oscuro `#0C3C32` — exactamente el emparejamiento de Splitwise.

### Estado y datos

| Rol | Claro | Oscuro | Uso |
|---|---|---|---|
| `destructive` | `#BE123C` | `#FB7185` | Borrado, errores, vencido. En admin, botón destructivo en *outline* (como en A): texto `destructive` sobre fondo transparente |
| `destructive-foreground` | `#FFFFFF` | `#2A0A10` | Solo para la variante rellena (confirmaciones de borrado) |
| Tinte destructivo | 12 % de `#FF2D55` | 10 % de `#FB7185` | Fondos de badge/hover del outline |
| `success` | `#15803D` | `#4ADE80` | Estados correctos, saldo a favor |
| Tinte success | 14 % de `#22C55E` (`#E0F7E8`), texto `#136B33` | 14 % de `#4ADE80` | Badges "pagado", glifos ↓ |
| `warning` (debes) | `#B93815` | `#FF8A5C` | Importes que debes, pendiente de cobro |
| Tinte warning | 16 % de `#FF6849` | 16 % de `#FF6849` | Badges "pendiente" |

### Paleta de gráficos (herencia OpenRouter)

`#035ADE` azul · `#7624F4` violeta · `#FFAB00` ámbar · `#FF6849` naranja · `#1CC29F` teal · `#FF2D55` rosa. Para series de gráficos; en oscuro se aclaran ~10 % si hace falta. El gradiente azul→violeta de OpenRouter queda reservado para branding (landing, logo), no para el cromo de la UI.

## Contraste WCAG 2.x

Calculado sobre los hex de arriba. Todas las parejas de texto cumplen AA (≥ 4,5:1); los glifos grandes sobre tinte cumplen el mínimo de gráficos (≥ 3:1).

| Pareja | Claro | Oscuro |
|---|---|---|
| `foreground` / `background` | 16,42 | 18,73 |
| `foreground` / `surface` | 17,61 | 18,02 |
| `muted-foreground` / `background` | 5,58 | 6,13 |
| `muted-foreground` / `surface` | 5,98 | 5,90 |
| `muted-foreground` / `muted` | 5,14 | 5,30 |
| `primary-foreground` / `primary` | 17,61 | 18,73 |
| `accent` / `surface` (enlaces) | 5,37 (`#09795F`) | 8,46 (`#1CC29F`) |
| `accent` / `background` | 5,00 | 8,79 |
| `accent` / `muted` | 4,62 | 7,60 |
| `accent-foreground` / `accent` (teal relleno) | — (app usa texto oscuro) | 7,33 |
| Texto sobre tinte de acento | 8,68 (`#0C3C32` sobre `#ACE4D6`) | 6,85 (`#1CC29F` sobre tinte 14 %) |
| `destructive-foreground` / `destructive` (relleno) | 6,29 | — (oscuro usa outline) |
| `destructive` / `surface` | 6,29 | 7,13 |
| `destructive` / tinte destructivo (badge) | 5,17 | 6,69 |
| `success` / `surface` | 5,02 | 11,00 |
| Texto success sobre tinte | 5,86 (`#136B33`) | 8,51 (`#4ADE80` sobre tinte 14 %) |
| `warning` / `surface` (debes) | 5,77 | 8,26 |
| `warning` / tinte warning (badge) | 4,89 | 6,74 |

## Tipografía

- **Fuente de interfaz**: **Inter** (400/500/600/700/800), variable, Google Fonts. Es la fuente de Orca y del ecosistema shadcn; en 800 para titulares de la app se mantiene cercana sin necesitar una segunda familia.
- **Fuente de datos**: **JetBrains Mono** (500/600) para importes, cifras KPI, IDs y valores técnicos de tablas. Alineación perfecta de decimales y lectura de "dato serio" al estilo OpenRouter/Orca.
- **Fallbacks**: `'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif` · `'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace`
- **Escala admin**: base 14 px · H1 28 px/700 · cifras KPI 26 px mono/600 · filas de tabla 13 px, alto de fila 44 px, topbar 52 px.
- **Escala app**: base 15 px · titulares 22–26 px/800 · importes mono/700 · botones píldora de 48 px.
- **Radios**: escala compartida 6/8/12/16/24 + píldora. Admin: controles 8, tarjetas 12, chips píldora. App: tarjetas 16–20, botones píldora.

## Personalidad y tono (microcopy de UI)

Sin cambios respecto a A: cercano y tranquilo, tuteo y frases cortas — «¿Añadimos el gasto de la luz?», «Todo al día, bien hecho». El tono lo lleva el texto, no la paleta.

## Dirección de logo (solo insumo; sin assets todavía)

Wordmark «027» en Inter 800 con el «0» trazado como anillo teal (guiño a un gráfico de anillo/valor), o «027» monocromo con punto teal terminal. Icono de app: squircle oscuro `#0E0F11` con el anillo teal y una hairline blanca alfa — coherente con el cromo monocromo del admin. El gradiente azul→violeta puede aparecer como brillo secundario en la landing, no en el icono.

## Cuándo elegirla

- **Encaja**: si el admin se va a usar a diario para gestionar datos (gastos, listas, tareas), la densidad y precisión de OpenRouter/Orca lo hacen mucho más eficaz que la dirección A; y la app conserva la amabilidad de Splitwise que la familia toca cada día.
- **A favor**: dos referencias del propio usuario (OpenRouter, Orca) ya usan exactamente este sistema (Inter + mono + zinc + hairline), así que el resultado será recognible y moderno; el teal de Splitwise da identidad propia frente al azul/violeta genérico.
- **Riesgo**: el contraste de personalidad entre admin técnico y app cálida es intencionado pero debe gestionarse: la marca (teal + Inter + hairline) es lo que los une; si cada superficie toma caminos separados, parecerán dos productos.
- **Riesgo**: oscuro primero implica cuidar el modo claro del admin, que es el secundario (inverso monocromo: botones negros sobre claro).
- **Cambio realizado**: los tokens del admin (task 8) ya implementan esta identidad en claro y oscuro, con test de paridad del espejo JSON; el ADR 0001 queda como histórico.
