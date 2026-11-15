---
id: sprint-15-task-12
titulo: Extras — versión del APK a la vista en el botón de descarga
area: web
estado: finalizada
fuente: apps/admin/src/components/landing/download-button.tsx; apps/admin/src/components/landing/app-landing.tsx; apps/admin/src/lib/android-release.ts
adrs: [0002, 0004]
---

**Tarea**: pedida por el propietario el **2026-11-15** para cerrar el sprint. El botón de
descarga de la web pública debe mostrar, **en pequeño y bajo el texto del botón**, la versión
del APK que se va a descargar, y esa versión tiene que estar **siempre actualizada** sin que
nadie edite un número a mano.

**Punto de partida**: `DownloadButton` (`apps/admin/src/components/landing/download-button.tsx`)
es un componente sin datos: enlace fijo a `/download/android`, icono de Android y un literal
traducido. La landing del producto (`app/page.tsx`) es un componente de servidor dinámico
(`instant = false`, el idioma viene de la petición), así que puede leer la release en el
servidor sin volver la página dinámica por este motivo.

**Decidido el 2026-11-15**: la versión sale de **la misma fuente que la descarga y la
actualización de la app**, `latestAndroidRelease()` (`apps/admin/src/lib/android-release.ts`),
que ya cachea cinco minutos y ya respeta el override local (`ANDROID_RELEASE_JSON`). No se
escribe la versión en ningún sitio: ni en el copy, ni en un fichero de configuración, ni en el
build.

**Alcance**
- Dentro:
  - `DownloadButton` acepta la versión como prop (`version?: string | null`) y la pinta en
    **texto pequeño** (clase secundaria, `tabular-nums`), bajo el literal, sin cambiar la altura
    del botón ni el espaciado en móvil.
  - `AppLanding` recibe la versión del servidor: `app/page.tsx` llama a `latestAndroidRelease()`
    y la pasa; las **dos colocaciones** del botón (hero y cierre de la sección Android) muestran
    la misma versión.
  - **Degradación honesta**: si no hay release (GitHub sin APK, API caída, override vacío), el
    botón sigue funcionando y **no** inventa un número: no muestra la línea o muestra el estado
    «en desarrollo» que ya existe en la página, según lo que se apruebe en el preview.
  - Localización: el prefijo de la versión («Versión 0.16.8» / «Version 0.16.8») en los **9
    locales**; el número no se traduce.
  - Tests: el botón pinta la versión cuando la recibe y no rompe sin ella; la landing pasa la
    versión del release; el texto es pequeño y no cambia la altura del botón.
- Fuera: publicar la release (tarea 07), QR de descarga, enlace a Google Play, detección de
  plataforma, changelog de la web, mostrar el tamaño del APK o su SHA-256.

**Dependencias**: ninguna de código. Convive con la tarea 11 (mismo componente): si la 11 aún
no está fusionada, esta se apoya en su `DownloadButton` con icono de Android.

**Riesgos**: que un fallo de la API de GitHub deje el botón sin versión justo en una demo (se
mitiga con la caché de cinco minutos y el override local); que el texto extra empuje el botón
fuera de su altura de 40 px; que el número se traduzca o se formatee con separadores locales.

**Criterios de aceptación**
- El botón de descarga muestra la versión **vigente** del APK en la landing pública, en pequeño
  y legible a 320 px de ancho.
- Al publicar una release nueva, la web muestra la versión nueva **sin desplegar** (caché de
  cinco minutos como máximo).
- Sin release disponible, la web no muestra una versión falsa ni rompe el botón.
- `pnpm lint`, `pnpm tsc`, `pnpm test` y `pnpm --filter admin build` en verde.
- `docs/ai/landing.md` actualizado con el cambio visible.

**Puertas de usuario**
- Aceptar visualmente la versión bajo el botón en el preview (claro y oscuro, móvil y escritorio).
- Orden explícita de merge.

**Auditoría de seguridad**: no añade superficie pública nueva (la release ya se lee para
`/download/android`); se revisa que la versión mostrada no exponga rutas internas, URLs de asset
ni el SHA-256, y que el override local siga siendo inerte en producción.
