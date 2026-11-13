# Mockup — esqueleto base de la app Android

Mockup **A** del sprint 15, tarea 01. No es una imagen: es un HTML+JS navegable para que el
propietario recorra los flujos y elija variante antes de que se escriba UI.

> **Estado:** variante **B** elegida por el propietario (2026-11-12); pendiente la aceptación
> final del mockup. La spec de la tarea 01 no está completa hasta que este mockup se acepte
> (`docs/superpowers/specs/2026-11-12-android-access-shell.md` §6bis). Sin esta puerta no hay
> código de UI.

## Cómo abrirlo

```bash
open docs/mockups/app-shell/index.html
```

Arriba hay cuatro selectores de revisión: **pantalla**, **tema**, **módulos** (Cuadrícula,
Lista o Destacado) y **acento** (tarjeta o icono). Están fuera del teléfono a propósito: no son
UI del producto, son controles para comparar el mockup. Las dos variantes se ven en paralelo,
con los mismos datos de demo. Los botones de la barra inferior, la campana, el FAB y las filas
de la hoja de añadir navegan de verdad. También se puede abrir una pantalla concreta por URL:
`?screen=settings&theme=dark`, `?screen=invite`, `?screen=modules&layout=feature&accent=card`.

Previews rápidas en esta carpeta: `preview-splash.png`, `preview-change-instance.png`,
`preview-home.png`, `preview-modules-grid.png`, `preview-modules-list.png`,
`preview-modules-feature.png`, `preview-modules-accent-icon.png`, `preview-modules-dark.png`,
`preview-logos.png`, `preview-logos-all.png`, `preview-logos-final.png`, `preview-settings-dark.png`, `preview-invite.png`, `preview-add.png`.

## Las dos variantes

| | **A · OweNo primero** | **B · Lanzador de módulos** |
|---|---|---|
| Barra inferior | `Inicio · OweNo · Ajustes` | `Inicio · Módulos · Ajustes` |
| OweNo | Pestaña de primer nivel | Se abre dentro de la pila, desde Módulos |
| Escala con muchos módulos | Peor: cada módulo nuevo no cabe como pestaña | Mejor: Módulos es el lanzador |
| Para la familia | Más directa si OweNo es lo único que se usa a diario | Más limpia si el producto crece |
| Inicio | Dashboard de widgets + enlace «Ver todos» | Dashboard de widgets + pestaña Módulos |

Las dos comparten login, dashboard, ajustes, idioma, tema, campana, FAB, invitación y sesión
persistente. La decisión es de navegación, no de funcionalidad.

## Pantallas y estados

| Pantalla | Qué muestra | Estados |
|---|---|---|
| Arranque | La app conecta sola con `027apps.ericrf.com`; no pide URL. | cargando; error de conexión con reintento y enlace discreto a «otra instancia» |
| Login | Email, contraseña, host de la instancia y enlace discreto «Usar otra instancia»; sesión que se mantiene | normal; credenciales inválidas, rate limit y cuenta desactivada (pendientes de iterar) |
| Cambiar instancia | URL editable, aviso de que cierra la sesión y botón «Guardar y cerrar sesión»; se llega desde Ajustes (y desde el enlace del login) | normal; URL inválida, instancia sin `auth` (pendiente de iterar) |
| Invitación (deep link) | Instancia, email (vacío, el de la invitación), contraseña y aviso de token de un solo uso | normal; invitación caducada/usada, email que no coincide y error de red (pendientes de iterar) |
| Inicio | Saludo, **dashboard con widget de demo** (tipo resumen y tipo lista), campana y FAB; los módulos viven en la pestaña Módulos, no en una cuadrícula del Inicio | normal; vacío, cargando y error (pendientes de iterar) |
| Notificaciones | Campana en estado vacío | vacío; con eventos, cuando existan |
| Ajustes | Perfil, **cambiar instancia**, **idioma**, **tema**, notificaciones y cerrar sesión | normal; guardando (pendiente) |
| Añadir (FAB) | Hoja inferior con acciones de los módulos | normal |
| OweNo | Placeholder honesto: las pantallas reales llegan en el mockup F1 | — |
| Módulos | Lanzador con **solo módulos activos**; **logo** grande sobre tile sólido del acento y tarjeta teñida; texto legible en claro/oscuro. **Cuadrícula elegida**; Lista y Destacado quedan como comparación en la barra superior | normal; vacío (pendiente de iterar); tema oscuro |

## Decisiones reflejadas

- **Dashboard de widgets, no lista de tarjetas**: el Inicio incrusta widgets que aportan los
  módulos. El widget del mockup es **de demo**; el de OweNo será `owe-no.summary` en el
  mockup F1. Los widgets de panel (`owe-no.metric`) van en el mockup F2.
- **Sin selector global de grupo**: las categorías del Core son etiquetas/acceso y todos ven a
  todos; los grupos son de cada módulo. OweNo elegirá su grupo dentro del módulo.
- **Instancia por defecto**: la app trae `027apps.ericrf.com` y no pide URL al arrancar. El
  cambio vive en **Ajustes → Instancia** (avisa de que cierra la sesión); el login deja un
  enlace discreto «Usar otra instancia» para quien autoaloja y aún no ha entrado.
- **Sesión al abrir**: el arranque lee la sesión cifrada. Si es válida, entra directo al
  dashboard; si no, muestra el login sin más. La pantalla de instancia no es onboarding.
- **Invitación instalada / no instalada**: si la app está instalada, el App Link (o el enlace
  «Abrir en la app» con el esquema propio) la abre en el alta. Si no, la web `/invite/<token>`
  muestra el alta en el navegador y el botón de descarga. No hay deferred deep link en v1: tras
  instalar, se vuelve a abrir el enlace.
- **Logos, no iconos de línea**: el módulo se presenta como un **logo de app**: marca monocroma
  más gruesa sobre un **tile sólido con su acento** (`branding.color`), no un icono de línea del
  DS sobre un fondo pálido. Los iconos de la barra inferior (Inicio, Módulos, Ajustes), la
  campana y el FAB sí son del DS.
- **Ocho direcciones propias para OweNo** en `logos.html`: **A · Pila de monedas**, **B ·
  Monedas en abanico**, **C · Dos monedas**, **D · Cartera + moneda**, **E · Cartera
  minimalista**, **F · Billete**, **G · Billete + moneda** y **H · Cartera con billetes**. Sin tick: el símbolo dice dinero y
  el nombre dice «saldado». Están dibujadas para 027Apps, no descargadas de una librería; son
  monocromas y se prueban a 24/32/40 px y sobre el tile del acento. La decisión es **F · Billete
  + Esmeralda**; H cartera con billetes y Recibo + check quedan en `logos-final.html` como
  comparación. `branding.icon` será el billete y `branding.color` emerald
  (`packages/owe-no/assets/icon.svg`).
- **OweNo es el nombre elegido (D4 cerrada, 2026-11-12).** La spec de diseño hablaba de *Split
  Expenses*; el nombre de producto es OweNo y la landing se actualiza en el PR del módulo. El
  F (billete) + Esmeralda es la decisión final; H y Recibo + check quedan como comparación;
  A/B/C son las monedas, D/E las carteras y G el billete + moneda.
- **Eventos** es un segundo módulo de demo para enseñar otro acento; su monograma E no es un
  módulo real ni un logo definitivo.
- **Logo a color**: el contrato actual exige `branding.icon` monocromo con `currentColor`. Si el
  propietario quiere logos a todo color, es un cambio de contrato (`branding.logo` o similar) y
  hay que resolver el modo oscuro; no se hace en este sprint sin decisión explícita.
- **Texto en oscuro**: los tiles son `<button>`; el navegador les daba texto negro por defecto y
  en oscuro no se leía. El mockup fija `color: var(--foreground)` en tile, fila y destacado. En
  la implementación, el componente debe declarar el color del tema, no confiar en el default del
  botón.
- **Solo módulos activos**: no hay tarjetas «Próximamente». Si un módulo no está activo para el
  usuario, no aparece. La **cuadrícula** es la elegida; Lista y Destacado se enseñan para
  comparar, no se implementan como preferencia de producto.
- **Acento recomendado: tarjeta teñida**. El **logo** va sobre un tile sólido con el acento
  (marca en blanco en claro y oscura en oscuro) y la tarjeta lleva un tinte al 6 % con borde al
  22 %. El texto sigue sobre superficie, así que el contraste no depende de cada slot. «Acento:
  icono» deja la tarjeta limpia y el color solo en el logo; es más sobrio, pero el módulo se
  distingue menos. Una tarjeta rellena del acento no se recomienda: con 8 slots el lanzador se
  vuelve ruidoso y hay que validar el contraste de texto en cada uno.
- **Invitación por deep link**: la pantalla muestra la instancia; el enlace solo se usa una
  vez. La app canjea el token y entra; la web queda como respaldo.
- **Sesión persistente**: el login no se repite en uso normal; el refresh se guarda cifrado.
- **Idioma**: la invitación marca el inicial; Ajustes permite cambiarlo.
- **Tema**: Ajustes permite sistema/claro/oscuro; se guarda en el perfil.
- **Campana**: existe en el esqueleto, pero está vacía porque FCM sigue bloqueado. No se
  inventan notificaciones.
- **FAB global**: abre una hoja de «añadir»; las acciones son de los módulos. OweNo añadirá
  «Gasto» en la tarea 03.
- **Admin solo en el panel**: la app no muestra invitaciones, permisos ni gestión de módulos.

## Tokens y contraste

- Paleta de identidad D, espejo de `apps/admin/tokens.json`; claro y oscuro.
- Radios de tarjeta 16 px y control 12 px en el mockup (la app usa 12/8 de la identidad; el
  mockup es una aproximación visual).
- Contraste AA revisado en ambos modos para texto principal, secundario y acento. El portal
  revisa el contraste final en la implementación con los tokens reales.
- Sin hex libres fuera de las variables CSS del mockup.

## Lo que no incluye

- Las pantallas reales de OweNo: son el **mockup F1** (`docs/mockups/owe-no/`, vista móvil).
- Las pantallas de administración del módulo en el panel: **mockup F2** (misma carpeta, vista
  panel). El panel no estrena una sección «App».
- PNG de revisión rápida: se pueden generar al cerrar la iteración; el HTML es la fuente.
- Datos reales de la familia: todo es demo.

## Cómo se aprueba

1. El propietario abre el HTML y recorre la variante **B** (la elegida); A queda como
   comparación. La **cuadrícula** ya está elegida; el acento recomendado es **tarjeta teñida**.
2. Se itera el HTML (y se actualiza este README si cambia una decisión).
3. El propietario aprueba el mockup por escrito.
4. Solo entonces se implementa la UI de la tarea 01. El mockup F1 de OweNo parte de la
   variante B.
