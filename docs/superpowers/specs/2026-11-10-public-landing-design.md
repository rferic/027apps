# Spec: landing pública y panel en `/panel`

- **Fecha:** 2026-11-10
- **Estado:** aprobada por el usuario el 2026-11-10
- **Ámbito:** página pública de presentación, mudanza del panel a `/panel`, SEO, i18n,
  documentación para agentes y presupuesto de rendimiento
- **Relacionado:** [ADR 0001](../../adr/0001-identidad-visual.md) ·
  [ADR 0002](../../adr/0002-identidad-visual.md) · [ADR 0003](../../adr/0003-identidad-logo.md) ·
  [ADR 0004](../../adr/0004-bordes-y-capa-de-aplicacion.md) ·
  [ADR 0008](../../adr/0008-fechas-y-moneda.md) ·
  [`2026-11-10-api-performance-design.md`](2026-11-10-api-performance-design.md) ·
  [`docs/tasks/sprint-14-mejoras/README.md`](../../tasks/sprint-14-mejoras/README.md)

## 1. Objetivo

Publicar una landing real en `/` que explique qué es 027Apps, muestre sus módulos, permita
descargar la app Android y enlazar al repositorio; y separar el panel a `/panel` para que la
portada sea pública, cacheable y rápida.

Hoy no existe `src/app/page.tsx`: `/` **es** el dashboard y el `entryGate` lo redirige a
`/login` o `/setup`.

## 2. Decisiones cerradas con el propietario (2026-11-10)

| # | Decisión |
|---|---|
| D1 | `/` es **siempre la landing**, incluso con sesión. El panel se mueve a **`/panel`**. |
| D2 | La landing se publica en los **9 idiomas** soportados. |
| D3 | Contenido deseado: descarga de la **app Android**, enlace a **GitHub**, **lista de módulos**, capturas del producto y propuesta de valor. |
| D4 | Antes de implementar: el propietario envía **referencias visuales**; se presentan **mockups HTML + PNG** y se itera hasta cerrar el diseño. |
| D5 | Debe existir **documentación para agentes** sobre qué contiene la landing y cuándo actualizarla. |

## 3. Rutas y navegación

### 3.1 Cambio de rutas

- `src/app/page.tsx` (nuevo): landing pública.
- `src/app/(panel)/panel/page.tsx` (nuevo): dashboard actual, movido desde
  `src/app/(panel)/page.tsx`.
- `src/app/(panel)/layout.tsx` sigue envolviendo solo el panel: al dejar de existir
  `(panel)/page.tsx`, la landing queda fuera del layout autenticado.

### 3.2 Gate y rutas públicas

`apps/admin/src/proxy.ts` y `apps/admin/src/lib/instance-gate.ts`:

| Ruta | Antes | Después |
|---|---|---|
| `/` | setup / login / dashboard | `/setup` si la instancia no está instalada; landing en cualquier otro caso |
| `/panel` | no existía | login sin sesión; dashboard con sesión |
| `/login` | formulario | si hay sesión, redirige a `/panel` (la CTA de la landing sirve para ambos) |
| `/<locale>` | no existía | landing estática en ese idioma (solo 8 variantes distintas del idioma por defecto) |

- `PUBLIC_HELP_PATHS` / `isPublicPath()` incluye `/` y las rutas de locale; la landing **no**
  debe instanciar Supabase ni leer cookies, para seguir siendo estática.
- Antes de instalar, `/` sigue yendo a `/setup` (la landing no debe revelar una instancia a
  medio configurar).

### 3.3 Enlaces internos a actualizar

`/` como destino del panel aparece en: enlace de marca del layout, redirecciones tras login y
redención, breadcrumbs que asumen la home, tests de página y cualquier `href="/"`. Se
sustituyen por `/panel`. La redención de invitación sigue terminando en
`/login?notice=invitation-redeemed` y desde ahí el gate lleva a `/panel`.

## 4. Idiomas, SEO y cacheabilidad

El conflicto a resolver: el resto de la app resuelve el idioma por cookie, lo que obliga a
renderizar por request y **rompe la caché**; la landing necesita ser estática para cumplir su
presupuesto de rendimiento y para SEO.

**Solución:** una página estática por idioma.

- `/` → idioma por defecto de la instancia (hoy `en`), estática.
- `/es`, `/ca`, `/gl`, `/eu`, `/pt`, `/fr`, `/it`, `/de` → estáticas, con
  `generateStaticParams` y `dynamicParams = false` (un segmento desconocido da 404).
- `<html lang>` correcto por página, `canonical` propio, `hreflang` de todos los idiomas +
  `x-default` apuntando a `/`. Si el idioma por defecto cambia en los ajustes, `/` cambia de
  contenido en el siguiente build (documentado en `docs/ai/landing.md`).
- **Spike de viabilidad** en el plan: confirmar en la documentación de Next 16 (que vive en
  `apps/admin/node_modules/next/dist/docs/`) que un `[locale]` raíz no captura rutas estáticas
  como `/panel`, `/login`, `/help`, `/invite`. Si hubiera colisión, la alternativa es
  `/l/<locale>` y se anota en el plan; `/` no cambia.
- Selector de idioma en la landing: enlaces estáticos entre variantes (sin JS). Además fija la
  cookie `027_locale` para que el panel abra en ese idioma (pequeño componente cliente,
  progresivo: sin JS los enlaces siguen funcionando).
- `sitemap.ts` con `/` y las 8 variantes; `robots.ts` permite la landing y bloquea `/panel`,
  `/api`, `/setup` y `/invite`. Se mantiene `X-Robots-Tag: noindex` en `/invite/:token`.
- Open Graph y Twitter Card con una imagen estática `public/og/landing.png` (1200×630),
  `metadataBase` desde `instance.public_url` o el dominio de la petición en build.

## 5. Contenido

La landing habla del **producto** (027Apps), no de una instancia concreta: el nombre de
instancia y el estado del panel viven en `/panel`. Fuente única del contenido:
`apps/admin/src/lib/landing-content.ts` (tipado, sin base de datos, sin JS de cliente).

Secciones (el orden final se cierra en el mockup):

1. **Hero**: qué es 027Apps en una frase (plataforma familiar modular y autoalojable), CTA
   principal *Descargar app Android* y secundaria *Abrir panel*.
2. **Qué puedes hacer**: lista de módulos y capacidades (finanzas y monedas, categorías de
   usuario, miembros y permisos, módulos activables, API v1 y claves, notificaciones). La lista
   sale de `landing-content.ts` y se documenta cómo añadir un módulo.
3. **Autoalojable y tus datos**: instancia propia, backups, control de acceso, sin dependencia
   de un servicio cerrado.
4. **Capturas / mockups del producto**: imágenes tratadas, sin datos reales de la familia.
5. **App Android**: descarga (APK firmado desde GitHub Releases) y requisitos.
6. **Código abierto**: enlace al repositorio de GitHub.
7. **Pie**: enlaces a documentación pública, aviso de licencia y selector de idioma.

Reglas:

- Enlaces externos con `target="_blank"` y `rel="noopener noreferrer"`.
- Ninguna captura con nombres, correos, importes o tokens reales; si se usa una captura real,
  se genera con datos ficticios y se revisa antes de commitear.
- Sin analytics de terceros, sin píxeles, sin formularios.
- Sin carruseles ni animaciones que bloqueen el LCP; `prefers-reduced-motion` respetado.

## 6. Documentación para agentes

Nuevo `docs/ai/landing.md` (documento canónico, mismo tono que `module-system.md`) con:

- estructura de secciones y dónde vive cada texto (`landing-content.ts` + catálogo i18n);
- **cuándo actualizarla**: al añadir o retirar un módulo, al publicar una release del APK, al
  cambiar la propuesta de valor o los enlaces de descarga/repositorio;
- reglas de capturas (datos ficticios, sin PII, formatos y tamaños);
- regla de i18n: toda cadena visible va por `t()` y entra en los 9 idiomas;
- presupuesto de rendimiento (LCP, JS máximo, imágenes);
- qué **no** va en la landing (estado de la instancia, datos de usuarios, enlaces privados).

Se añade al mapa de docs de `AGENTS.md` (y al puntero de `CLAUDE.md` si procede) para que
cualquier agente lo encuentre. `node scripts/check-ai-docs.mjs` debe seguir en verde.

## 7. Fase de diseño (DoD Diseño)

1. El propietario envía 2–3 referencias visuales.
2. Tres direcciones de mockup en `docs/mockups/landing/v1..v3.html` con capturas PNG, en claro
   y oscuro, a 1440 px y 390 px.
3. Iteración hasta aprobación explícita; se documenta la dirección elegida y los descartes.
4. La implementación usa los tokens existentes; no se añaden colores fuera de
   `design-tokens.css`.
5. Contraste AA verificado en ambos modos; foco visible; navegación por teclado.

## 8. Rendimiento y accesibilidad

Hereda los objetivos de la spec de rendimiento:

- TTFB ≤ 100 ms servida desde caché; LCP ≤ 1,5 s; CLS ≤ 0,1; INP ≤ 200 ms.
- JS de la landing ≤ 120 KB gzip; el único componente cliente es el selector de idioma.
- Imágenes en AVIF/WebP con `width`/`height`, `loading="lazy"` salvo la del hero,
  `fetchpriority="high"` en el LCP.
- Fuentes ya self-hosted por `next/font` (sin peticiones a Google en runtime).
- HTML semántico: un `h1`, landmarks, `alt` descriptivo por idioma, sin texto en imágenes.
- Responsive real a 320 px sin scroll horizontal.

## 9. Seguridad

- Página pública: sin sesión, sin datos de instancia, sin endpoints nuevos.
- `metadataBase` y enlaces absolutos desde `instance.public_url`; nunca desde la cabecera
  `Host`.
- Sin `dangerouslySetInnerHTML` en la landing; el contenido es tipado y estático.
- CSP vigente: no se añaden orígenes externos (imágenes y fuentes son propias).
- Los enlaces a GitHub Releases/APK son públicos y verificables; no se enlaza a artefactos
  temporales.
- `robots.txt` no expone rutas privadas más allá de lo que ya son.

## 10. Criterios de aceptación

1. `/` responde `200` sin sesión, sin llamar a Supabase y con `x-vercel-cache: HIT` tras el
   primer hit; `/panel` exige sesión y muestra el dashboard.
2. En una instalación nueva, `/` sigue redirigiendo a `/setup`; instalada, `/` nunca redirige al
   login.
3. Login correcto aterriza en `/panel`; un usuario con sesión que abre `/login` acaba en
   `/panel`.
4. Los 9 idiomas renderizan sin claves sin traducir; `hreflang`, `canonical` y `sitemap.xml`
   son correctos; `robots.txt` permite la landing y bloquea lo privado.
5. Objetivos de §8 cumplidos en producción (evidencia con el protocolo de la spec de
   rendimiento).
6. `docs/ai/landing.md` existe, está enlazado desde `AGENTS.md` y `check-ai-docs` pasa.
7. Mockups aprobados por el propietario antes de implementar (evidencia en el PR).
8. `pnpm lint`, `pnpm tsc`, `pnpm test` y `pnpm --filter admin build` en verde; CI del PR en
   verde.
9. Sin enlaces internos rotos: un test recorre la navegación principal y otro verifica que no
   queda ningún `href="/"` que pretendía ser el panel.

## 11. Puertas de usuario

1. Enviar las **referencias visuales** antes de la fase de mockups.
2. Confirmar la **URL pública del APK** (GitHub Releases u otra) y que es estable.
3. Confirmar la **URL del repositorio** que se enlaza y su visibilidad.
4. Aprobar los mockups y, al final, la landing en staging.

## 12. Riesgos

| Riesgo | Mitigación |
|---|---|
| `[locale]` raíz colisiona con rutas existentes | Spike con la doc de Next 16; plan B `/l/<locale>`. |
| Mover el panel rompe bookmarks o redirects | Redirección 308 de `/` a `/panel` **no** se hace (la landing ocupa `/`); se actualizan todos los enlaces y se prueba el flujo completo. |
| Landing desactualizada | `docs/ai/landing.md` con disparadores de actualización y lista de módulos en un único fichero. |
| Capturas con datos reales | Regla explícita + revisión en el PR. |
| La landing compite con la app por el idioma | Cookie `027_locale` como puente; la landing es estática por ruta. |

## 13. ADRs aplicables

`0001`, `0002`, `0003` (identidad y logo), `0004` (bordes), `0008` (fechas si aparece alguna).
No se requiere ADR nuevo.
