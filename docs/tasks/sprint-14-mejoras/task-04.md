---
id: sprint-14-task-04
titulo: Landing pública y panel en /panel
area: producto
estado: test
plan: docs/superpowers/plans/2026-11-11-public-landing.md
fuente: docs/superpowers/specs/2026-11-10-public-landing-design.md
adrs: [0001, 0002, 0003, 0004, 0008]
---

**Tarea**: publicar una landing real en `/`, mover el panel a `/panel`, publicarla en 9 idiomas
y documentar para agentes cuándo y cómo actualizarla.

**Punto de partida**: no existe `src/app/page.tsx`; `/` es el dashboard y el `entryGate` lo
redirige a `/setup` o `/login`.

**Orden interno obligatorio**
1. **Fase de diseño**: el propietario envía referencias; 3 direcciones de mockup en
   `docs/mockups/landing/` (HTML + PNG, claro/oscuro, 1440 px y 390 px); iteración y aprobación.
2. Spike de Next 16: confirmar que un `[locale]` raíz no captura `/panel`, `/login`, `/help`,
   `/invite`; plan B `/l/<locale>`.
3. Mudanza de rutas: dashboard a `(panel)/panel/page.tsx`, landing en `app/page.tsx`.
4. Gate: `/` → setup si no está instalada, landing si lo está; `/panel` exige sesión; `/login`
   con sesión redirige a `/panel`; `/` y variantes de idioma como rutas públicas.
5. Contenido: `src/lib/landing-content.ts` (módulos, enlaces Android y GitHub, capturas).
6. SEO: `canonical`, `hreflang`, `sitemap.ts`, `robots.ts`, Open Graph.
7. `docs/ai/landing.md` + puntero en `AGENTS.md`; `check-ai-docs` en verde.

**Criterios de aceptación** (detalle en la spec §10): `/` estática, sin Supabase y con caché;
`/panel` exige sesión; instalación nueva sigue yendo a `/setup`; 9 idiomas y SEO correctos;
objetivos de rendimiento y accesibilidad; documentación para agentes; mockups aprobados; CI y
builds en verde; sin enlaces internos rotos.

**Puertas de usuario**
- Enviar las referencias visuales.
- Confirmar la URL estable del APK (GitHub Releases) y del repositorio.
- Aprobar mockups y landing en staging.

**Riesgos**: colisión de `[locale]` con rutas existentes (spike + plan B); enlaces antiguos a
`/` (se actualizan todos y se prueban); landing desactualizada (`docs/ai/landing.md` con
disparadores); capturas con datos reales (regla explícita y revisión).

## Estado (2026-11-11)

Implementada en `feature/public-landing` (PR #87, draft): dos páginas estáticas, `/panel`,
9 idiomas con rutas `/l/<locale>`, SEO (`sitemap.xml`, `robots.txt`, canonical/hreflang,
Open Graph), catálogo de módulos y la regla de actualizar la landing al implementar uno.
Decisión posterior (2026-11-12): el idioma de la web pública va por cookie y `Accept-Language`,
no por URL; se añadió aviso informativo de cookies y `/cookies`. La revisión nativa de
traducciones la descarta el propietario; las capturas reales quedan aplazadas hasta que existan
pantallas de la app. Pendiente: auditoría de seguridad del cambio de apariencia del panel.

## Revisión (2026-11-11)

La landing se divide en **dos páginas**: `/` para la app (familias) y `/self-host` para el
proyecto (panel de escritorio, API, MCP, tecnologías y montaje). Ambas públicas y estáticas;
el panel se mueve a `/panel`. Inglés por defecto, 9 idiomas, APK público y sin analítica.
Detalle en la revisión de la spec.
