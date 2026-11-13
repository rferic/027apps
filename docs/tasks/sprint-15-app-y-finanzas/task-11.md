---
id: sprint-15-task-11
titulo: Extras — descarga de la app con icono de Android y literal revisado
area: web
estado: pendiente
fuente: apps/admin/src/components/landing/app-landing.tsx; apps/admin/src/components/landing/github-icon.tsx; docs/mockups/landing-buttons/index.html
adrs: [0002, 0004]
---

**Tarea**: cerrar el sprint con un extra pequeño de la web pública: que los botones de descarga
de la app lleven el **icono de Android** y que el literal diga con claridad qué se descarga y
para qué plataforma. Es la tarea **11**, la de extras: cada sprint puede terminar con una.

**Punto de partida**: la landing tiene tres botones «Download app» (hero, sección Android y
cierre) que apuntan a GitHub Releases, con un icono de GitHub solo en el botón secundario. No
hay icono de Android y el literal no dice la plataforma, aunque la app solo existe para Android.

**Decidido el 2026-11-13**: literal **«Descargar para Android» / «Download for Android»** e
**icono de Android en los tres botones** de descarga. El mockup
[`docs/mockups/landing-buttons/index.html`](../../mockups/landing-buttons/index.html) queda como
referencia de la opción elegida (`?variant=1`).

**Alcance**
- Dentro:
  - **Icono**: componente `AndroidIcon` en `apps/admin/src/components/landing/android-icon.tsx`,
    como `GitHubIcon` (16 px, `currentColor`, `aria-hidden`, sin hex libres), y usarlo en los
    tres botones de descarga, a la izquierda del texto.
  - **Literal**: el que se apruebe en el mockup `docs/mockups/landing-buttons/index.html`, en los
    **9 locales**. La propuesta recomendada es «Descargar para Android» / «Download for Android»;
    las alternativas están en el mockup con su rationale.
  - El botón secundario («Ver en GitHub» / «Código en GitHub») no cambia.
  - Mantener el enlace a `https://github.com/rferic/027apps/releases`, el estado
    «en desarrollo» y el aviso de que el APK se publica sin cuenta.
  - Tests de la landing: los tres enlaces de descarga llevan el icono y el literal localizado;
    el SVG es decorativo; el botón mantiene su altura y no hay salto de layout.
- Fuera: publicar la release (tarea 07), QR de descarga, enlace a Google Play, detección de
  plataforma, cambios de diseño de la landing, capturas nuevas.

**Dependencias**: ninguna. Puede ir en paralelo con cualquier tarea; se coloca al final porque es
extras. El enlace a Releases ya funciona hoy (aunque no haya APK todavía).

**Riesgos**: un literal demasiado técnico («APK») para el público familiar; prometer iOS sin
querer; que el icono cambie la altura del botón o el espaciado en móvil; traducciones
inconsistentes entre los 9 locales.

**Criterios de aceptación**
- El **mockup de botones** está en `docs/mockups/landing-buttons/index.html`, con las opciones de
  literal en español e inglés, claro/oscuro y las tres colocaciones, y el propietario elige.
- Los tres botones de descarga muestran el **icono de Android** y el literal elegido en los 9
  locales; el secundario no cambia.
- El icono es monocromo (`currentColor`), decorativo y de 16 px; el botón conserva su altura y su
  espaciado en móvil.
- `pnpm lint`, `pnpm tsc`, `pnpm test` y `pnpm --filter admin build` en verde; sin regresión de
  Lighthouse en la landing.
- `docs/ai/landing.md` actualizado si cambia el copy público.

**Puertas de usuario**
- Elegir el literal en el mockup.
- Aceptar visualmente la landing en el preview.
- Orden explícita de merge.

**Auditoría de seguridad**: no aplica superficie nueva (enlace externo ya existente, sin datos);
se revisa que el enlace siga siendo `https` y con `rel="noopener noreferrer"` si abre en pestaña
nueva.
