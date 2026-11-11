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
- Lockup de marca en nav, sidebar y pie: latido + wordmark *bare* (la tagline era ilegible a
  24 px).
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

## v2-app — propuesta app primero (2026-11-11)

Evolución de v2 elegida por el propietario: la app manda, el panel queda como segunda cara.

- `v2-app.html`, `v2-app.png` (app), `v2-app-panel.png` (pestaña Panel) y `v2-app-mobile.png`.
- Hero con la app y cuatro módulos con su pantalla y explicación (finanzas, categorías,
  miembros, módulos).
- Sección «Dos formas de usar 027Apps» con un **switch App / Panel** (contenido estático, sin
  recarga): el panel explica miembros, invitaciones, categorías, módulos, API v1, MCP, ajustes
  y estado.
- Tecnologías, autoalojado, Android, FAQ y pie.
- Copy ilustrativo en español; la implementación publica **inglés en `/`** y las 8 variantes.
- Sin analítica por decisión del propietario.

### Estado de la app

La app Android **aún no tiene pantallas de producto** (su única UI es la configuración de FCM).
Por eso estas pantallas son **mockups de diseño** y la página lo dice («App en desarrollo»).

### Requisitos anotados para la base de la app (primer módulo)

1. **Sustituir los mockups por capturas reales** con datos de demo en cuanto existan pantallas.
2. **Abrir la invitación dentro de la app**: el enlace `/invite/<token>` debe abrir la app,
   canjear la invitación allí y dejar la sesión iniciada (sin pasar por la web ni volver a
   hacer login). El canje ya crea la cuenta; la app puede iniciar sesión automáticamente con
   las credenciales elegidas en el formulario.
3. Descarga del APK **pública** desde GitHub Releases; el panel sigue siendo solo por
   invitación.

### Contenido estático de módulos

La lista de módulos se mantiene como contenido versionado (sin base de datos). Cada módulo
declara su ficha de landing —nombre, resumen, icono, captura, orden y si es de app o de panel—
y el contrato de módulos (`docs/ai/module-system.md`) y la skill `new-module` deben exigirla al
crear uno. El `README.md` raíz se reescribirá para contar lo mismo que la landing.

## Dos páginas (2026-11-11, decisión del propietario)

El panel es **escritorio** y no es otra pantalla de la app: se separa en dos páginas enlazadas.

### `/` — la app (`v2-app.html`)

- Hero con la app y dos móviles.
- Cuatro módulos con pantalla y explicación: finanzas, categorías, miembros, módulos.
- Tarjeta «La parte de escritorio» que enlaza a la página del proyecto.
- Android y FAQ de familia.

### `/self-host` — el proyecto (`v2-selfhost.html`)

- Hero de escritorio con la captura del panel.
- Qué incluye: panel, API v1, MCP, app, copias, 9 idiomas.
- Tecnologías, cuatro pasos de instalación, arquitectura y FAQ técnica.
- Guía de autoalojado y GitHub.

Se enlazan entre sí: la app lleva «Autoalojar el proyecto» y el proyecto lleva «ver la app».
La nav de ambas ofrece `App` y `Autoalojar`. La ruta inglesa será `/self-host`.

Capturas: `v2-app.png`/`v2-app-mobile.png` y `v2-selfhost.png`/`v2-selfhost-mobile.png`.

## Selector de idiomas

La nav de las dos páginas incorpora un selector (`<details>`, sin JS) con los 9 idiomas y el
actual marcado. En la implementación cada opción enlaza a su ruta (`/`, `/es`, `/self-host`,
`/es/self-host`).
