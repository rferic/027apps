---
id: sprint-infra-task-10
titulo: CODEOWNERS y propiedad de workflows
area: infra
estado: finalizada
plan: docs/superpowers/plans/2026-10-27-sprint-infra.md
fuente: docs/conventions/security-checklist.md (A06) y docs/superpowers/specs/2026-10-26-seguridad.md T10
---

**Tarea (puerta de setup del usuario)**: evitar que un colaborador con escritura edite un workflow y exfiltre secretos de CI.

**Pasos**:
1. Crear **`.github/CODEOWNERS`** con `.github/workflows/` (y `docs/conventions/`, `docs/adr/` si se quiere) asignados al propietario.
2. Activar **protección de `main`** con los checks requeridos (`admin`, `android`, `guard-secrets`, `commitlint`) — ver `sprint-infra` task-01.
3. Verificar que un PR que toca `.github/workflows/` **exige revisión** del code owner.

**Motivo**: la checklist A06 queda en `✘` mientras no exista; hoy cualquier colaborador con escritura puede editar `maintenance.yml` y exfiltrar la clave de mantenimiento.

**Criterios de aceptación**: `CODEOWNERS` en el repo; PR de prueba sobre un workflow pide revisión del owner; protección de `main` activa con los cuatro checks.

## Bitácora (2026-10-27)

- **`.github/CODEOWNERS` creado**: `/.github/workflows/ @rferic` y `/.github/CODEOWNERS @rferic`, con el motivo escrito en el propio fichero.
- **Protección de `main`**: ya activa (tarea 01) con los cuatro checks requeridos y sin bypass.
- **Pendiente de decisión (usuario)** — el toggle *Require review from Code Owners* **no se ha activado** aún, a propósito:
  - Activarlo con el único administrador actual **bloquearía todos los merges** (nadie puede aprobar su propio PR).
  - Alternativa A: activarlo **y** añadir bypass de administrador al ruleset → el dueño puede mergear, pero también puede saltarse el bloqueo de push directo.
  - Alternativa B: **invitar a un segundo maintainer** como revisor y subir `required_approving_review_count` a 1 → control completo, sin bypass.
  - Hoy el riesgo real es bajo: no hay colaboradores con escritura. La protección contra ellos (PR + checks + sin force-push) ya está activa.

### Decisión (usuario, 2026-10-27): alternativa B

El toggle *Require review from Code Owners* **queda desactivado** hasta que exista un **segundo maintainer**; ese día se activa junto con `required_approving_review_count = 1` en el ruleset `main-protection`. Motivo: con un único administrador el toggle bloquea todos los merges (nadie aprueba su propio PR) y la alternativa A (bypass de admin) debilitaría el bloqueo de push directo que ya está probado.

Por tanto, el criterio de aceptación "un PR de prueba exige revisión del owner" **no aplica todavía** (queda como condición de activación, no como deuda oculta). Lo que sí está activo y probado: `CODEOWNERS`, PR obligatorio, cuatro checks requeridos, sin force-push, sin borrado y sin bypass.
