---
id: sprint-06-task-11
titulo: Revisión de diseño y UX
area: web
estado: pendiente
adrs: [0004, 0005]
plan: docs/superpowers/plans/2026-11-06-web-admin.md
spec: docs/superpowers/specs/2026-11-06-web-admin-ux-review.md
---

**Alcance**: aplicar todas las decisiones de `docs/superpowers/specs/2026-11-06-web-admin-ux-review.md`
(arquitectura de información Inicio/Personas/Plataforma/Sistema, cabecera con logo + nombre de instancia +
idioma + menú de usuario, patrones de lista/detalle/formulario, confirmaciones destructivas y estados
vacío/carga/error). Recorrer la checklist de aceptación UX de 10 puntos contra el panel en marcha, a
375 px y 1280 px, y corregir los hallazgos.

**TDD**: tests de estructura y accesibilidad donde aplique (ítem activo con `aria-current`, sin
`href="#"` en la navegación, cabecera con sesión e idioma, tablas que pasan a tarjetas en móvil) y
regresión por cada hallazgo corregido.

**DoD**: `pnpm lint && pnpm tsc && pnpm test && pnpm i18n:check && pnpm --filter admin build` en verde,
checklist de 10 puntos verificada con evidencia, revisión y auditoría OWASP (A01, A05, A07).
