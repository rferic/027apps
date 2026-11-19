# Landing pública (contenido y estado de los módulos)

Documento canónico para quien toque `apps/admin/src/components/landing/app-landing.tsx` (la app) o
`self-host-landing.tsx` (el proyecto). La landing es **contenido estático**: no lee la base de
datos ni el estado de la instancia.

- Spec: [`docs/superpowers/specs/2026-11-10-public-landing-design.md`](../superpowers/specs/2026-11-10-public-landing-design.md)
- Mockups aprobados: [`docs/mockups/landing/`](../mockups/landing/README.md)
- Contrato de módulos: [`docs/ai/module-system.md`](module-system.md)

## Rutas

| Ruta | Contenido |
|---|---|
| `/` | La app para la familia (móvil). |
| `/self-host` | El proyecto: panel de escritorio, API, MCP, tecnologías y montaje. |
| `/cookies` | Política de cookies, en el idioma de la petición. |

El idioma **no va en la URL**: estas tres rutas se renderizan en el idioma de `027_locale`, o el
del navegador (`Accept-Language`) si no hay cookie, o inglés.

## SEO

- Una sola URL por página: `canonical` propio y sin `hreflang` (el idioma va por cookie).
- `src/app/sitemap.ts` lista `/`, `/self-host` y `/cookies`; `src/app/robots.ts` permite la
  landing y bloquea `/panel`, `/api/`, `/setup` e `/invite/`.
- Open Graph y Twitter Card usan `apps/admin/public/og/landing.png` (1200×630).
- `NEXT_PUBLIC_SITE_URL` fija el origen canónico en una instancia autoalojada; sin ella se usa
  `https://027apps.ericrf.com`.
- Las páginas leen cookies/cabeceras, así que declaran `instant = false` y se sirven con
  `Cache-Control: no-store`; ninguna CDN las mezcla entre idiomas.

## Idiomas

- `requestLocale()` resuelve el idioma por petición: `027_locale` → primer idioma soportado de
  `Accept-Language` → inglés.
- Los dos componentes (`components/landing/app-landing.tsx` y `self-host-landing.tsx`) reciben
  `locale` y traducen cada cadena visible con `t("texto en inglés")`.
- El catálogo inglés vive en `packages/i18n/catalog.en.json`; las traducciones, en
  `packages/i18n/locales/<locale>.json`.
- Para añadir o cambiar copy: `pnpm i18n:scan`, traduce la clave en los 8 ficheros y
  `pnpm i18n:check`. El check falla si falta una clave, sobra o no coinciden los placeholders.
- El selector (`LanguageMenu`) escribe la cookie y refresca el servidor; la URL no cambia.
  `LocaleSync` corrige `<html lang>` y persiste el idioma detectado.
- No hay copy literal en el JSX salvo marcas, nombres de las maquetas y los importes de ejemplo.

## Cookies

- **Necesarias:** `sb-*` (sesión del panel).
- **Preferencia:** `027_locale`, `027_theme`, `027_cookie_notice`.
- Sin analítica, publicidad ni terceros. El aviso informativo se renderiza en servidor desde la
  cookie y enlaza a `/cookies`; no bloquea nada.

## Estados

Cada módulo declara uno:

- **`available`** — existe y se puede usar hoy.
- **`in-development`** — hay código, pero no está listo para la familia.
- **`planned`** — diseñado, sin implementar. Se muestra como *Coming soon*.

**Regla:** nada `planned` se presenta como disponible. Las pantallas de la web son maquetas
declaradas como simuladas; la app publicada no se presenta como «en desarrollo».

## Catálogo actual (2026-11-12)

| Módulo | App | Panel | Estado |
|---|---|---|---|
| OweNo | Sí | Grupos, gastos, balances, liquidación e importador de Splitwise | app `available` (APK firmado), panel `available` |
| Categorías | Sí (previsto) | Grupos y permisos | app `planned`, panel `available` |
| Miembros | Invitaciones (QR y enlace); roles y bajas previstos | Roles, invitaciones, bajas | app `in-development` (invitaciones), panel `available` |
| Módulos | Sí (previsto) | Activar y conceder | app `planned`, panel `available` |
| API v1 | — | Claves con permisos | `available` |
| MCP | — | Agentes con OAuth | `available` |
| App Android | Sí | — | `available` (APK firmado en GitHub Releases; push verificado el 2026-11-15) |
| Copias y recuperación | — | Dump diario y simulacro | `available` |
| 9 idiomas | Sí | Sí | `available`; revisión nativa de las traducciones pendiente |

**Todas las pantallas de la web son simuladas** (HTML+CSS con datos de ejemplo), en las tres
páginas: la app, el panel y `/self-host`. El propietario lo decidió el 2026-11-16: mezclar una
captura real con maquetas se nota y una captura clara rompe el tema oscuro. La sección Android lo
declara en el hero («the screens are simulated with sample data»). No hay capturas reales hasta
que la app esté probada de verdad, y entonces se cambian **todas a la vez**, también las del panel
y `/self-host`.

Las notificaciones push ya no son una promesa: viajan como notificación del sistema, sin importe
mientras el ojo está cerrado, y al tocarlas abren el grupo. La sección Android lo dice así; antes
avisaba de que eran «planned».

La app ya puede **invitar**: pantalla de invitación con barra de cuota, QR rotativo y enlace, y
solicitud de más plazas al administrador. Es solo la parte de **invitaciones** del módulo Miembros:
los roles y las bajas siguen siendo cosa del panel, así que la fila de Miembros no pasa a
`available` en la app.

## Cuándo actualizar

**Regla:** implementar un módulo incluye actualizar la web pública en el mismo PR. Sin esa
actualización la tarea no está `finalizada` (ver `docs/ai/module-system.md`, «Landing
pública»).

- **Un módulo pasa a `available`**: cambia su estado en las dos páginas y en esta tabla,
  actualiza su ficha y sus maquetas, y actualiza el README. Las capturas reales solo entran
  cuando se cambien todas a la vez (ver «Capturas»).
- **Se crea un módulo**: rellena su ficha (abajo) y decide si va a la app, al panel o a ambos.
- **Release del APK**: el botón «Descargar para Android» apunta a `/download/android`, una ruta
  de la instancia que resuelve la última release con APK en GitHub y **la sirve en streaming**,
  así que el visitante no sale de la web. No hay que tocar el botón al publicar una release: en
  cuanto el asset `.apk` existe, se descarga. El enlace secundario a GitHub no cambia.
- **Nuevo idioma**: añade la ruta y las traducciones; el selector ya lista los 9.
- **Cambia el stack o el precio**: actualiza `/self-host` y el README.

## Ficha de un módulo

Mientras la landing no tenga un fichero de contenido propio, la ficha vive en el texto de la
página con esta forma:

```ts
{
  surface: "app" | "panel" | "both",
  status: "available" | "in-development" | "planned",
  order: number,
  icon: string,
  image: string,           // captura en /landing/modules/<key>-<surface>.webp
  name: string,            // clave de traducción
  tagline: string,
  description: string,
}
```

La app muestra la ficha como fila alterna (captura + descripción + **lista de 3–4
características**). El panel la muestra como tarjeta (nombre + una línea + estado).

## Capturas

- Datos de demo, nunca de la familia: sin nombres, correos, importes ni tokens reales.
- Hoy **no hay imágenes**: las pantallas son maquetas HTML+CSS dentro de la propia página, en tema
  oscuro y con los mismos tokens que el resto de la web.
- Si algún día se usan capturas: todas de golpe (app, panel y `/self-host`), en tema oscuro,
  formato WebP, dimensiones fijas y `alt` traducido. Nunca una captura real junto a maquetas.

## Lo que no va en la landing

- Estado de la instancia (módulos activos, miembros, salud).
- Datos personales o cifras reales.
- Promesas de fechas o funciones no planificadas.
- Analítica de terceros (decisión del propietario: sin analítica por ahora).

## Pendiente

- Revisión nativa de las traducciones (hoy generadas y revisadas en bloque).
- Capturas reales del panel con datos de demo.
- Mover las fichas a un `landing-content.ts` (o al manifest de cada módulo) y añadir un check
  que falle si falta la ficha o una traducción.
