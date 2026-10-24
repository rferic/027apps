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
- `destructive-foreground` — Extra: el botón destructivo relleno necesita texto con contraste AA en ambos modos (en oscuro el texto es oscuro, no blanco).

Contraste WCAG calculado sobre estos hex (mínimo 4,5:1 para texto, todas las parejas lo cumplen):

| Pareja | Claro | Oscuro |
|---|---|---|
| `foreground` / `background` | 12,4 | 15,2 |
| `muted-foreground` / `surface` | 5,9 | 7,3 |
| `primary-foreground` / `primary` | 5,3 | 7,7 |
| `destructive-foreground` / `destructive` | 6,5 | 8,9 |
| `success` / `surface` | 5,3 | 8,9 |
| `destructive` / `surface` | 6,5 | 7,2 |

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
