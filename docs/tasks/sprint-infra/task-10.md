---
id: sprint-infra-task-10
titulo: CODEOWNERS y propiedad de workflows
area: infra
estado: pendiente
fuente: docs/conventions/security-checklist.md (A06) y docs/superpowers/specs/2026-10-26-seguridad.md T10
---

**Tarea (puerta de setup del usuario)**: evitar que un colaborador con escritura edite un workflow y exfiltre secretos de CI.

**Pasos**:
1. Crear **`.github/CODEOWNERS`** con `.github/workflows/` (y `docs/conventions/`, `docs/adr/` si se quiere) asignados al propietario.
2. Activar **protección de `main`** con los checks requeridos (`admin`, `android`, `guard-secrets`, `commitlint`) — ver `sprint-infra` task-01.
3. Verificar que un PR que toca `.github/workflows/` **exige revisión** del code owner.

**Motivo**: la checklist A06 queda en `✘` mientras no exista; hoy cualquier colaborador con escritura puede editar `maintenance.yml` y exfiltrar la clave de mantenimiento.

**Criterios de aceptación**: `CODEOWNERS` en el repo; PR de prueba sobre un workflow pide revisión del owner; protección de `main` activa con los cuatro checks.
