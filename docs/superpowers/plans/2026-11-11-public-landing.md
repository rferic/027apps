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

- [ ] Página `/` (app) en inglés: hero, módulos con pantalla, Android, FAQ, tarjeta al proyecto.
- [ ] Página `/self-host`: panel, API, MCP, tecnologías, pasos, arquitectura, FAQ.
- [ ] Contenido en `landing-content.ts` con fichas de módulo y claves de traducción.
- [ ] Layout y estilos de landing (tokens; sin JS salvo el selector de idioma).
- [ ] Rutas de idioma para las 8 variantes; inglés por defecto.
- [ ] Capturas reales del panel con datos de demo en `public/landing/`; mockups para la app.
- [ ] `docs/ai/landing.md` + puntero en `AGENTS.md`; check de fichas y traducciones.
- [ ] README raíz alineado con la landing.
- [ ] Tests de render, enlaces y traducciones; CI en verde.
