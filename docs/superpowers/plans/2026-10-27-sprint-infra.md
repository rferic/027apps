# Plan — Sprint infra: setup del usuario

**Fecha:** 2026-10-27
**Tasks:** `docs/tasks/sprint-infra/task-01..12.md`
**Tipo:** infra (DoD: `docs/conventions/definition-of-done.md` §Infra)

## Objetivo

Dejar una instancia **operativa**: proyecto Supabase con envs, secretos, SMTP, Vercel, protecciones de GitHub y push. Cada tarea es una **puerta de setup** que ejecuta el usuario y **verifica** el agente (comando + salida).

## Orden y por qué

1. **04 Supabase + envs** — sin BD no hay nada. Dev/preview separado de prod.
2. **09 Clave maestra** — sin ella no se pueden guardar secretos (FCM, SMTP propio).
3. **05 SMTP** — sin reset de contraseña no se puede completar una instalación real.
4. **06 Vercel** — previews por PR: el usuario acepta resultados ahí (`feature.md`).
5. **01/02 Rulesets** — protegen `main` y los tags; requisito de `git.md`.
6. **08 Firebase** — push (opcional por instancia, obligatorio en la del autor).
7. **10/11 CI** — CODEOWNERS y prefijos en `guard-secrets` (controles de la checklist A06).
8. **03 Keystore + release** — publicar APK firmado.
9. **07 Keep-alive** — activar el ping diario cuando exista producción.
10. **12 Backup** — verificar el workflow ya integrado (bucket + secrets + restore de prueba).

## Evidencia obligatoria (DoD infra)

- **El check falla cuando debe fallar**: para `guard-secrets` y los rulesets, provocar el fallo y documentarlo.
- `gh pr checks` / logs de run como evidencia, no "verde" a secas.
- **Auditoría de seguridad** de cada tarea (secretos, permisos de workflow, acciones por SHA).
- `docs/flows/cicd.md` actualizado si cambia CI.

## Riesgos

- **Pausa del free tier** de Supabase por inactividad → keep-alive (task-07).
- **Secretos en forks** → los workflows ya degradan sin secrets; no se añaden secrets a PRs.
- **Cuenta del operador** → 2FA obligatorio en Supabase/Vercel/GitHub (T15 del modelo de amenazas).
