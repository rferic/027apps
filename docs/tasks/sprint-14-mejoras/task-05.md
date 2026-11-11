---
id: sprint-14-task-05
titulo: Apariencia por usuario (tema e idioma en el perfil)
area: producto
estado: en curso
plan: docs/superpowers/plans/2026-11-11-user-appearance.md
fuente: docs/superpowers/specs/2026-11-11-user-appearance-design.md
adrs: [0002, 0008]
---

**Tarea**: persistir el tema y el idioma en `profiles` para que cada cuenta recupere su
apariencia, usando la cookie solo como pista de carga rápida.

**Punto de partida**: el selector de idioma solo escribe `027_locale` (no actualiza
`profiles.locale`) y el tema solo vive en `027_theme`; en el mismo navegador, otra cuenta
hereda la apariencia anterior.

**Alcance**
- Migración `0021`: `profiles.theme` y permiso de actualización de la columna.
- API: `theme` en `PATCH /users/{id}`.
- Panel: el guard lee `locale` y `theme`; el layout aplica el tema del perfil antes de pintar y
  sincroniza las cookies; los selectores persisten y revierten si el `PATCH` falla.

**Criterios de aceptación** (detalle en la spec §4): dos cuentas en el mismo navegador
conservan su apariencia; sin flash al cambiar de cuenta; el `PATCH` inválido revierte; suite y
CI en verde.

**Riesgos**: un `PATCH` fallido deja la cookie aplicada hasta la recarga (se revierte en la
UI); el script del panel y el del layout raíz deben coincidir en el orden de precedencia.
