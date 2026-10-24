# Dirección A — Cercano y cálido

> Propuesta de identidad visual para 027Apps. Documento comparativo de la tarea 7 del sprint 01; **no es la decisión final** (esa irá en `docs/brand/brand.md`). Los hex de este documento son la propuesta de paleta; en código de producto los colores se consumen solo vía tokens semánticos.

Mockup: [`../mockups/a.html`](../mockups/a.html) — abrir en el navegador; el botón de la barra superior alterna claro/oscuro.

## Idea

Una identidad pensada para el salón de casa. Superficies suaves color crema, esquinas muy redondeadas, formas de píldora y un terracota amable como color de acción. El panel se siente como una libreta familiar, no como una herramienta de oficina: invita a usarlo a diario y a que lo use cualquiera de la familia, no solo el administrador.

## Paleta (roles semánticos)

| Rol | Claro | Oscuro | Uso |
|---|---|---|---|
| `background` | `#FFF8F0` | `#1E1713` | Fondo de página |
| `surface` | `#FFFFFF` | `#2A211B` | Tarjetas, tablas, barra superior, popovers |
| `muted` | `#F6EBDD` | `#372B23` | Fondos secundarios: inputs, cabeceras de tabla, hover, chips |
| `muted-foreground` | `#76604F` | `#C2AD9B` | Texto secundario: etiquetas, fechas, ayudas |
| `foreground` | `#3A2E2A` | `#F7ECDF` | Texto principal |
| `primary` | `#B9472B` | `#F2926F` | Acción principal, enlaces, elemento activo, foco |
| `primary-foreground` | `#FFFFFF` | `#2B1006` | Texto/icono sobre `primary` |
| `border` | `#E9DBCB` | `#4B3B2F` | Bordes y separadores |
| `destructive` | `#B3261E` | `#FF8F86` | Acciones destructivas y errores |
| `destructive-foreground` | `#FFFFFF` | `#1A0606` | Texto sobre `destructive` |
| `success` | `#2F7A45` | `#86D39A` | Estados correctos, importes a favor |

Roles extra sobre el mínimo (justificación):

- `muted-foreground` — Extra: el texto secundario necesita su propio color con contraste AA; reutilizar `muted` o `foreground` con opacidad no lo garantiza.
- `destructive-foreground` — Extra: en A el botón destructivo de la barra de acciones es una variante *outline* (texto `destructive` sobre fondo transparente, más suave y acorde a la calidez de A), así que este rol solo se usa en la variante rellena: diálogos de confirmación de borrado. En oscuro el texto es oscuro, no blanco, para mantener AA.

Nota: `highlight` y `highlight-foreground` son roles exclusivos de la dirección C; A y B no los definen.

Contraste WCAG 2.x calculado sobre estos hex. Todas las parejas listadas cumplen WCAG AA para texto (≥ 4,5:1); el mínimo es 4,68:1.

| Pareja | Claro | Oscuro |
|---|---|---|
| `foreground` / `background` | 12,43 | 15,18 |
| `foreground` / `surface` | 13,09 | 13,53 |
| `muted-foreground` / `background` | 5,61 | 8,21 |
| `muted-foreground` / `surface` | 5,90 | 7,32 |
| `muted-foreground` / `muted` | 5,02 | 6,36 |
| `primary-foreground` / `primary` | 5,25 | 7,73 |
| `primary` / `surface` (enlaces, texto de acento) | 5,25 | 6,85 |
| `destructive-foreground` / `destructive` | 6,54 | 8,88 |
| `destructive` / `surface` | 6,54 | 7,15 |
| `success` / `surface` | 5,26 | 8,86 |
| `destructive` / `background` (botón destructivo *outline* de A) | 6,21 | 8,02 |
| `destructive` / hover del botón *outline* (10 % de `destructive` sobre `background`) | 5,28 | 6,75 |
| `primary` / tinte de acento (ítem de nav activo, chip de pagador, glifo €) | 4,68 | 5,27 |
| `success` / tinte de `success` (glifo ↓ de KPI) | 4,72 | 6,53 |
| `destructive` / tinte de `destructive` (glifo ↑ de KPI) | 5,75 | 5,50 |

**Tinte de acento en A**: `--tint` = **8 %** en claro y **14 %** en oscuro. Con más tinte en claro (14–16 %) el texto `primary` cae a 4,30–4,19:1; por eso el tinte claro es más ligero.

## Tipografía

- **Fuente de interfaz**: **Nunito** (400/600/700/800), Google Fonts. Redondeada y amable, muy legible en pantallas pequeñas.
- **Fallbacks**: `'Nunito', ui-rounded, 'Segoe UI', system-ui, sans-serif`
- **Titulares y cifras**: Mismos Nunito en 800 para títulos y cifras; sin segunda familia.
- **Escala**: Base 15,5 px · títulos 30 px/800 · cifras KPI 30 px/800 · interlineado 1,45 · radios 20/14 px, botones en píldora.

## Personalidad y tono (microcopy de UI)

Cercano y tranquilo, tuteo y frases cortas: «¿Añadimos el gasto de la luz?», «Todo al día, bien hecho».

## Dirección de logo (solo insumo; sin assets todavía)

Wordmark redondeado en Nunito 800 con «027» en terracota. Icono de app: forma blanda (círculo o squircle) con el «027» o una casa/mesa abstracta; sin aristas.

## Cuándo elegirla

- **Encaja**: es la que mejor refleja el uso real de la app Android por parte de la familia (cotidiano, afectivo, sin intimidar a quien no es técnico).
- **Riesgo**: la densidad es baja (filas de 16 px, tarjetas holgadas); en el admin con tablas largas se ve menos información por pantalla y puede parecer «poco serio» para tareas de mantenimiento.
- **Riesgo**: el terracota es cálido pero muy común en apps de bienestar; la diferenciación vendrá de la tipografía y la forma, no del color. El modo oscuro es marrón cálido: agradable, pero menos «técnico».
