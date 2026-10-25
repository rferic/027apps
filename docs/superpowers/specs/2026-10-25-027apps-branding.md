# Spec — Branding completo de 027Apps (sprint 02, task 01)

**Fecha:** 2026-10-25
**Estado:** Aprobado por el usuario (2026-10-25: elección de la dirección L4, ADR 0003)
**Base:** identidad D aceptada (`docs/brand/identities/d.md`, ADR 0002)

## Objetivo

Convertir la identidad D en assets de marca utilizables: logo, icono de app Android, splash y favicon del admin. Todo derivado de los tokens de la identidad (teal `#1CC29F`, zinc `#0E0F11`, Inter 800, hairline blanca alfa), no de decisiones nuevas de color o forma.

## Alcance (entregables)

1. **Logo** (elección entre 3 direcciones L1/L2/L3 con mockup):
   - Wordmark SVG en claro y oscuro + versión monocromo (1 tinta, para sellos/agua).
   - Símbolo/marca standalone (lo que va en el icono y el avatar).
   - Zona de respiración y tamaño mínimo documentados.
2. **Icono de app Android**: adaptive icon (`ic_launcher_foreground` + background) con capas separadas, exportado a mipmap (48/72/96/144/192) y Play Store 512.
3. **Splash**: Android 12+ usa el icono sobre `windowBackground`; se define el color y la variante clara/oscura. El admin no necesita splash.
4. **Favicon del admin**: set web (ico/svg + apple-touch-icon) desde el símbolo elegido.
5. **`docs/brand/brand.md`**: documento consolidado de marca (usos correctos, no-hacer, cleared space, versiones del logo).

## Fuera de alcance

CIP completo (tarjetas, papelería), landing pública, plantillas sociales, guía de voz extensa. Quedan para el resto del sprint 02 o posteriores.

## Decisiones de método

- **SVG artesanal, no generación IA en raster**: el wordmark depende de la tipografía exacta (Inter 800) y de los tokens; el resultado debe ser determinista, editable y versionable en git. Los scripts de generación IA de la skill de diseño quedan como alternativa solo si el usuario pide exploración pictórica.
- El texto del wordmark se convierte a **trazados (paths)** para que el SVG no dependa de fuentes instaladas (favicon e icono Android no cargan webfonts).
- Una sola puerta de elección (estilo sesiones anteriores): 3 direcciones → mockup → el usuario elige → ADR 0003 → assets finales.

## Criterios de aceptación

- El símbolo es legible a 16 px (favicon) sin pérdida de identidad; si una variante lo necesita, tendrá versión simplificada para tamaños pequeños documentada en `brand.md`.
- El adaptive icon no recorta el motivo (capa foreground dentro de la safe zone de 66/108).
- Splash conforme a Android 12+ (icono sobre fondo, sin animaciones custom obligatorias).
- Ningún color fuera de la paleta D; los assets referencian tokens en su fuente y valores fijos solo en los ficheros de exportación (SVG/PNG no pueden consumir CSS vars).
- Contraste del logo sobre sus fondos verificado en claro y oscuro.
- Revisión de estilo + auditoría de seguridad por agentes distintos del autor antes de `finalizada`.
