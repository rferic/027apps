# Plan — Sprint 03, task-01: Modelo de tokens (spec aprobada)

**Fecha:** 2026-10-25
**Task:** `docs/tasks/sprint-03/task-01.md` (finalizada)
**Entregable:** spec `docs/superpowers/specs/2026-10-25-token-model.md`

Plan ligero reconstruido tras el hecho (el sprint de definición se trabajó por conversación de diseño directa con el usuario; constancia de los pasos ejecutados para la trazabilidad del AGENTS.md).

## Pasos ejecutados

1. **Conversación de diseño** con el usuario (decisora) sobre el modelo de tokens: taxonomía (dispositivo / instancia / delegado), opacidad + BD, revocación instantánea, emparejamiento por invitación con email + contraseña, recuperación.
2. **Redacción de la spec** `docs/superpowers/specs/2026-10-25-token-model.md` con 10 decisiones tomadas (§8) y respuestas del builder check.
3. **Aprobación del usuario** (2026-10-25) y commit en `sprint/03-token-model` (`24807c2`).
4. **Ajuste posterior** por la spec de auth (2026-10-25): el token de dispositivo opaco se sustituye por la sesión de Supabase Auth; §3.1 revisado. Y por el ADR 0004: los scopes se declaran **por acción expuesta**, no solo por endpoint.

## Criterios de aceptación cumplidos

- Spec aprobada por el usuario y commiteada en la rama del sprint.
- Coherente con ADR 0004 (scopes por acción) y con la spec de auth (sesión Supabase en lugar del token de dispositivo).

## Referencias

- Spec: `docs/superpowers/specs/2026-10-25-token-model.md`
- Auth: `docs/superpowers/specs/2026-10-25-auth.md` §8
- ADR 0004: `docs/adr/0004-bordes-y-capa-de-aplicacion.md` (consecuencia sobre scopes)