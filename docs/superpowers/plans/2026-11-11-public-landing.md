# Sprint 14 — Landing pública en dos páginas (plan)

**Spec:** [`2026-11-10-public-landing-design.md`](../specs/2026-11-10-public-landing-design.md)
(revisión 2026-11-11). **Mockups:** `docs/mockups/landing/` (`v2-app`, `v2-selfhost`).

## Bloque 1 — fundación (hecho)

- [x] Panel movido a `/panel`; dashboard y tests reubicados.
- [x] `/` y `/self-host` declaradas públicas y sin gate de instalación.
- [x] `entryGate`: `/panel` exige sesión; `/login` con sesión va a `/panel`; `/setup` igual.
- [x] Enlaces internos (nav, post-login, setup, dashboard) apuntan a `/panel`.
- [x] Tests de gate, proxy, rutas públicas, nav y dashboard; lint, tsc y build.

## Bloque 2 — páginas

- [x] Página `/` (app) en inglés: hero, módulos con pantalla, Android, FAQ, tarjeta al proyecto.
- [x] Página `/self-host`: panel, API, MCP, tecnologías, pasos, arquitectura, FAQ.
- [ ] Contenido en `landing-content.ts` con fichas de módulo y claves de traducción (las páginas usan el copy inglés del mockup).
- [x] Layout y estilos de landing (`landing.css` con prefijo `.lp`; JS mínimo para el selector
de idioma, el aviso de cookies y `<html lang>`).
- [x] ~~Rutas `/l/<locale>`~~ → decisión posterior del propietario (2026-11-12): el idioma va
  por cookie (`027_locale` → `Accept-Language` → inglés) y hay una sola URL por página. El
  selector escribe la cookie y refresca; las páginas se sirven con `no-store`.
- [ ] Capturas reales del panel con datos de demo en `public/landing/`; mockups para la app
  (la sección de módulos de la app ya avisa de que son diseños previstos).
- [x] `docs/ai/landing.md` + puntero en `AGENTS.md`; los módulos planned se marcan «Coming soon»
  y el catálogo/estado queda documentado.
- [x] README raíz alineado con la landing: banner, stack, capturas y URL del sitio.
- [x] SEO: `sitemap.ts`, `robots.ts`, `canonical`/`hreflang`, Open Graph y Twitter Card.
- [x] Tests de rutas públicas, enlaces de idioma, metadatos y catálogo i18n; CI en verde.
