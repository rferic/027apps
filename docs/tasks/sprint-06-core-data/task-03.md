---
id: sprint-06-task-03
titulo: Invitaciones y canjeo
area: core
estado: finalizada
adrs: [0004, 0007]
plan: docs/superpowers/plans/2026-10-27-core-implementation-roadmap.md
---

**Alcance**: `POST/GET/DELETE /invitations`; `POST /invitations/{token}/redeem` público con rate limit: crea/verifica perfil, miembro de categoría y materializa `user_modules`; `invitation_expired`/`invitation_used`; el token **nunca** se devuelve por MCP.

**TDD**: casos de contrato de puerta (scopes/403, representación) + caso de uso (invariantes), y los casos negativos de la checklist de seguridad aplicables.

**DoD**: DoD de Código (TDD, lint/tsc/test/build, CI), ADRs declarados, QA con ojos nuevos y **auditoría OWASP** (checklist `security-checklist.md`).

## Bitácora (2026-11-05)

- **Migración** `0008_invitations.sql`: `invitations` (email normalizado, `token_hash` SHA-256 único, `expires_at`, `used_at`, `revoked_at` soft, actor único) e `invitation_modules`; RLS solo admin (el canjeo corre con service role) y CHECK de forma del hash.
- **Core** (`packages/core/src/invitations/{service,api}.ts`): crear/listar/revocar invitaciones y canjeo público. El token se genera con CSPRNG (`027_inv_…`), solo se guarda su SHA-256 y se devuelve **una vez** al crear; los listados nunca lo incluyen. El canjeo bloquea la fila (`for update`), valida estado (`invitation_used`/`invitation_expired`/revocada → `not_found`), exige que el email coincida, crea o reutiliza el usuario de Supabase Auth, crea el perfil si falta, inserta la membresía de categoría y materializa `invitation_modules` en `user_modules` (re-grant restablece `revoked_at`). Si la transacción falla, borra el usuario Auth recién creado.
- **Errores**: códigos `invitation_expired` e `invitation_used` (409) añadidos al catálogo ADR 0007, ya documentados en `docs/api/README.md`.
- **Guard**: scopes `invitations:read/write` para admin y super_admin.
- **Rutas admin**: `GET/POST /api/v1/invitations`, `DELETE /api/v1/invitations/{id}`, `POST /api/v1/invitations/{id}/redeem` (pública, rate limit 30/min por IP; el segmento lleva el token).
- **Tests**: 9 de servicio (hash no plaintext, estados, revocación idempotente, canjeo único con perfil/categoría/módulos, caducada/revocada/email distinto, cuenta existente/desactivada, limpieza de usuario Auth, **doble canjeo concurrente con dos conexiones reales**) + 5 de API (401/403, token una vez y fuera de logs, 400 id, canjeo único, email/caducidad) + 3 de aislamiento RLS (admin lee/escribe, usuario no, anon sin privilegios).
- **Verde**: lint ✓, tsc ✓, core 114, admin 77, db-tests 138, build ✓.
- **Correcciones tras auditoría**: el `createUser`/`findUserByEmail` de Auth se ejecuta **fuera** de la transacción (preflight sin lock + re-chequeo autoritativo bajo `for update`), para no retener una conexión del pool compartido durante una llamada HTTP; el puerto Auth devuelve `created` y el servicio solo borra usuarios que creó él (una carrera de email no puede borrar una cuenta existente); orden de módulos centralizado en `moduleKeys`.
- **Trade-offs aceptados y documentados**: el token viaja en el path porque lo fija el contrato (`/invitations/{token}/redeem`); nuestros logs lo redactan (`routeOf`), pero los access logs de la plataforma/proxy deben redactarlo también (nota de despliegue). `email_confirm: true` asume que el enlace se distribuye por un canal seguro; la limpieza del usuario Auth si falla la BD es best-effort (deuda de job de purga). En cuentas existentes el `password` del body no se usa (la prueba de titularidad es el token enviado al email); la cuenta desactivada se rechaza con `conflict`.
- **Auditorías**: QA/OWASP → APROBADA CON CAMBIOS, sin críticos ni altos (medios resueltos: I/O de Auth fuera de la transacción y test de concurrencia real; el token en URL es contrato). Estilo revisado por segundo agente.
- **CI**: PR #36 run `42038272629` en verde (`admin`, `android`, `commitlint`, `guard-secrets`, `supabase`) sobre `232cfa1`. **Finalizada**.
