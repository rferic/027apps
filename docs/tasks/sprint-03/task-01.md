---
id: sprint03-task-01
titulo: Modelo de tokens — spec aprobada (definición)
area: core
estado: finalizada
plan: docs/superpowers/plans/2026-10-25-sprint-03-token-model.md
---

Tarea 1 del sprint 03. Sprint de **definición**: este sprint no genera código, solo documentación aprobada para desbloquear el Core.

**Entregable**: spec `docs/superpowers/specs/2026-10-25-token-model.md` aprobada por el usuario (2026-10-25) y commiteada en `sprint/03-token-model` (`24807c2`).

**Contenido de la spec**: taxonomía de tokens (dispositivo / instancia / delegado), todos opacos + lookup en BD con revocación instantánea, permisos en vivo por endpoint, emparejamiento móvil por invitación con email + contraseña obligatorios, recuperación por email + contraseña, y 10 decisiones tomadas (§8) que incluyen las respuestas del builder check.

**Estado**: especificación, no implementación. La implementación del modelo de tokens pertenece al Core (la regla de la spec §11: las tareas de Core no empiezan hasta que las definiciones que les afectan están `finalizada`). Esta definición afecta a auth y API v1, siguientes tareas.
