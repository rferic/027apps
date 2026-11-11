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
| `/l/<locale>` y `/l/<locale>/self-host` | Las 8 variantes traducidas. Inglés en `/` y `/self-host`. |

## Idiomas

- Los dos componentes (`components/landing/app-landing.tsx` y `self-host-landing.tsx`) reciben
  `locale` y traducen cada cadena visible con `t("texto en inglés")`.
- El catálogo inglés vive en `packages/i18n/catalog.en.json`; las traducciones, en
  `packages/i18n/locales/<locale>.json`.
- Para añadir o cambiar copy: `pnpm i18n:scan`, traduce la clave en los 8 ficheros y
  `pnpm i18n:check`. El check falla si falta una clave, sobra o no coinciden los placeholders.
- El selector enlaza a la misma página en cada idioma (`/l/<locale>`). `LocaleSync` escribe la
  cookie `027_locale` y corrige `<html lang>` antes del primer pintado.
- No hay copy literal en el JSX salvo marcas, nombres de las maquetas y los importes de ejemplo.

## Estados

Cada módulo declara uno:

- **`available`** — existe y se puede usar hoy.
- **`in-development`** — hay código, pero no está listo para la familia.
- **`planned`** — diseñado, sin implementar. Se muestra como *Coming soon*.

**Regla:** nada `planned` se presenta como disponible. La sección de módulos de la app lleva el
aviso «Coming soon» mientras la app no tenga pantallas reales.

## Catálogo actual (2026-11-11)

| Módulo | App | Panel | Estado |
|---|---|---|---|
| Finanzas | Sí (previsto) | Presupuestos e histórico (previsto) | `planned` |
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
- **Release del APK**: cambia «Descargar app» para que apunte a la release publicada.
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
