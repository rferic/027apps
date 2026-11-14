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

**Regla:** nada `planned` se presenta como disponible. La sección de módulos de la app lleva el
aviso «Coming soon» mientras la app no tenga pantallas reales.

## Catálogo actual (2026-11-12)

| Módulo | App | Panel | Estado |
|---|---|---|---|
| OweNo | Sí (previsto) | Grupos, gastos, balances, liquidación e importador de Splitwise | app `planned`, panel `in-development` |
| Categorías | Sí (previsto) | Grupos y permisos | app `planned`, panel `available` |
| Miembros | Sí (previsto) | Roles, invitaciones, bajas | app `planned`, panel `available` |
| Módulos | Sí (previsto) | Activar y conceder | app `planned`, panel `available` |
| API v1 | — | Claves con permisos | `available` |
| MCP | — | Agentes con OAuth | `available` |
| App Android | Sí | — | `in-development` (solo configuración de FCM) |
| Copias y recuperación | — | Dump diario y simulacro | `available` |
| 9 idiomas | Sí | Sí | `available`; revisión nativa de las traducciones pendiente |

La app Android aún no tiene pantallas de producto: las de la landing son **maquetas de diseño**
y el hero lo dice («App in development · these screens are the planned design»).

## Cuándo actualizar

**Regla:** implementar un módulo incluye actualizar la web pública en el mismo PR. Sin esa
actualización la tarea no está `finalizada` (ver `docs/ai/module-system.md`, «Landing
pública»).

- **Un módulo pasa a `available`**: cambia su estado en las dos páginas y en esta tabla,
  sustituye la maqueta por una **captura real**, y actualiza el README.
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

La app muestra la ficha como fila alterna (captura + descripción + **lista de 3
características**). El panel la muestra como tarjeta (nombre + una línea + estado).

## Capturas

- Datos de demo, nunca de la familia: sin nombres, correos, importes ni tokens reales.
- Panel: captura real a 1440 px con datos ficticios.
- App: maqueta hasta que existan pantallas; después, captura real de un dispositivo.
- Formato WebP, dimensiones fijas y `alt` traducido.

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
