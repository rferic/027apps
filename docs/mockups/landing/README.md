# Mockups — landing pública

Tres direcciones para la página pública de 027Apps. Son **propuestas de diseño** para elegir
antes de implementar (`docs/superpowers/specs/2026-11-10-public-landing-design.md`).

Referencias del propietario: [lerd.sh](https://lerd.sh/) y [onorca.dev](https://www.onorca.dev/).

## Cómo revisarlas

Abre `vN.html` en el navegador o mira `vN.png` (1440 px) y `vN-mobile.png` (390 px).

- **v1 — editorial claro.** Hereda de lerd: etiqueta de índice, titular enorme con la segunda
  línea en gris, captura de producto, fila de cifras y secciones numeradas. Es la más cercana
  al panel actual (claro, tipográfico, tokens existentes).
- **v2 — oscuro centrado.** Hereda de Orca: hero centrado, badge, titular blanco con acento
  teal, doble CTA, pestañas y captura grande. La más impactante, pero se aleja del tema claro
  por defecto del producto.
- **v3 — cálido/familiar.** Fondo cálido, collage de tarjetas y el latido como protagonista.
  La más diferenciada y la que mejor habla de «familia»; introduce un fondo cálido que hoy no
  está en los tokens (habría que añadirlo como token semántico).

## Contenido (común)

Titular, propuesta de valor, seis módulos (finanzas, categorías, miembros, módulos, API,
notificaciones), bloque autoalojable/privacidad, app Android, enlace a GitHub y CTA al panel.
El copy es ilustrativo; en la implementación pasa por los **9 idiomas**.

## Elección

**v2 (oscuro centrado)**, elegida por el propietario el 2026-11-11 y refinada:

- Captura del panel realista (sidebar, topbar, KPIs, gráfico con la barra activa en teal y
  lista de miembros) en lugar del placeholder vacío.
- Iconos de línea coherentes en los módulos; GitHub como único icono en la nav.
- Wordmark *bare* en la nav (la tagline era ilegible a 24 px).
- Franja de garantías bajo la captura y bloque de stack + terminal en autoalojar.
- Cierre de Android con maqueta de móvil.
- Capturas de página completa en escritorio (1440) y móvil (390).

## Pendiente antes de publicar

- **No hay releases** en GitHub (`gh release list` vacío), así que «Descargar app» apunta a
  `/releases` y aún no descarga nada. Hace falta etiquetar una release con el APK o dar una URL.
- El repo es público: `https://github.com/rferic/027apps`.
- El wordmark de los mockups lleva tagline a 24 px (por debajo del mínimo de la guía). En la
  implementación irá la variante *bare* o a mayor tamaño.
- Las capturas son maquetas CSS; la implementación usará capturas reales con datos ficticios
  (sin nombres ni importes de la familia).
