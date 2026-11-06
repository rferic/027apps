---
id: sprint-05-task-07
titulo: Wizard de instalación completo (pasos 1–5)
area: core
estado: finalizada
adrs: [0004, 0007, 0008]
plan: docs/superpowers/plans/2026-10-31-sprint-05-core-base.md
---

**Alcance**: completar el wizard `/setup` según `docs/superpowers/specs/2026-10-26-instance-config.md`
§7, del que la task-02 solo entregó los pasos 1 (texto guía) y 2 (creación del super_admin):

1. **Entorno** — verificación real (conexión, migraciones, `SETTINGS_ENCRYPTION_KEY` de 32 bytes,
   `SENTRY_DSN` opcional, `security.jwt_expiry` observado).
2. **Super admin** — ya existente; se añade la comprobación `exp − iat = 900` y la escritura de
   `security.jwt_expiry` con el valor observado.
3. **SMTP** — email de prueba **solo al email del admin autenticado** (máx. 3 intentos) y confirmación.
4. **Preferencias** — `instance.name`, `instance.public_url`, `localization.*`; es el paso que deja
   `setup_incomplete = false`.
5. **Notificaciones (FCM)** — opcional, se puede omitir con aviso explícito.

**Invariantes de la spec que se respetan**

- Ventana sin autenticación: solo pasos 1–2. Los pasos 3–5 exigen sesión de `super_admin`.
- Nada de claves de progreso en `settings`: `requires_setup` y `setup_incomplete` se derivan.
- El wizard desaparece al **completar** (`setup_incomplete = false`), no al crear el admin.
- El paso 4 escribe con actor real (`updated_by` del super_admin autenticado).
- Secretos nunca salen en claro: el service account FCM es write-only y se reporta `configured`.

**TDD**

- Core: `checkEnvironment` (conexión/migraciones/clave/DSN), `isSetupIncomplete`, `jwtExpirySeconds`,
  `setupEnvironmentRoute`, `setupTestEmailRoute` (401/403 sin sesión de super_admin, 3 intentos).
- Admin: gate del proxy por `setup_incomplete`, página `/setup` por estado (pasos 1–2 vs 3–5),
  contratos de los formularios.

**DoD**: TDD, `pnpm lint && pnpm tsc && pnpm test`, `pnpm --filter admin build`, QA + auditoría OWASP
incondicional antes de `finalizada`, evidencia de preview.

## Bitácora (2026-11-03)

- **Core**: `setup/environment.ts` (`checkEnvironment`: conexión, migraciones por
  `information_schema`, clave de 32 bytes, Sentry opcional), `setup/api.ts`
  (`GET /setup/environment` público solo sin admin; `POST /setup/test-email` con sesión de
  `super_admin`, cuerpo estricto `{}` y rate limit 3/min), `auth/jwt.ts`
  (`jwtExpirySeconds`) y `settings/service.ts#recordJwtExpiry` (escritura observada de
  `security.jwt_expiry`, clave read-only por API). `instance/api.ts` exporta `isSetupIncomplete`.
- **Admin**: rutas `api/v1/setup/environment` y `api/v1/setup/test-email` (el email de destino
  se resuelve del `userId` de la sesión con la Admin API y se envía con `resetPasswordForEmail`).
  `/setup` decide el paso desde el estado real: entorno+admin → SMTP → preferencias+FCM; bloqueo
  si `security.jwt_expiry ≠ 900`, con re-observación del token en cada render (arreglar Supabase
  desbloquea solo). Banner «Setup is not finished» en el panel (spec §7.3).
- **Gate**: `entryGate` pasa a `{installed, setupIncomplete, hasSession}`; el wizard se cierra al
  completar, no al crear el admin. `instance-state.ts` memoiza 5 s solo la respuesta positiva.
- **Hallazgos y correcciones**:
  1. **El admin no podía llamar a `/api/v1` con la sesión por cookies**: el door solo autentica
     `Authorization: Bearer` (ADR 0004). El proxy ahora inyecta el token de la sesión en las
     llamadas `/api/v1` (matcher ampliado) y el door lo re-verifica. Sin esto, el wizard y las
     mutaciones del admin devolvían 401.
  2. **`actions.ts` con `"use server"` no puede exportar constantes**: la cookie `SMTP_COOKIE`
     se movió a `setup/smtp-cookie.ts`.
  3. **`localization.default_locale` exige estar en `enabled_locales`**: el paso 4 habilita el
     idioma elegido antes de fijar el default.
  4. **Borrar un `profile` con `settings.updated_by` falla** (`settings_updated_by_fkey` sin
     `ON DELETE SET NULL`): requiere limpiar la referencia antes. Anotado para sprint-06 (borrado
     de usuarios); no se toca el modelo en este sprint.
  5. **`db-tests/src/auth/setup.test.ts` borra todos los `super_admin` locales** en su limpieza
     (necesario para sus aserciones): ahora avisa por consola. Es la causa de que las cuentas
     locales «desaparezcan» tras `pnpm test`.
  6. **`jwt_expiry` local**: el stack tenía 3600 s (config aplicada al arrancar contenedores);
     tras `supabase stop && supabase start` emite 900 s.
- **Verde**: `pnpm lint`, `pnpm tsc`, `pnpm test` (core 88, admin 59, db-tests 78),
  `pnpm --filter admin build`.
- **Evidencia E2E (local + tunnel, 2026-11-03)**: `/setup` → checklist + admin; POST setup 201 con
  `jwt_expiry: 900`; paso 3 envía el email real (200 `{sent:true}`); paso 4/5 escribe preferencias →
  `/api/v1/instance` `setup_incomplete: false`; `/setup` 307 → `/`; panel sin banner.
- **Pendiente para `finalizada`**: QA + auditoría OWASP (incondicional) y aceptación del usuario.
- **QA + auditoría OWASP** (`ingeniero`): APROBADA CON CAMBIOS, **sin críticos ni altos**. Hallazgos corregidos en `0fcb44b`:
  - M1: la recuperación de huérfanos exige ahora `last_sign_in_at IS NULL` (nunca borra una cuenta que haya iniciado sesión), comprueba el error de `deleteUser` y deja aviso en el log. La carrera con la ventana de setup abierta queda documentada como residual.
  - M2: el gate del proxy solo consulta el estado de la instancia en `/`, `/setup` y `/login`; el resto de GET ya no hace I/O de BD.
  - B2: los logs ya no vuelcan mensajes crudos de Supabase (podían incluir el email); B3: `confirmSmtpAction` exige sesión de super_admin.
  - B1/B4 aceptados y documentados (rate limit del login delegado en Supabase Auth; invariante de actor en `security.jwt_expiry`).
- **Revisión de estilo** (`cocinero`, tras fallo del modelo de `enfermero`): APROBADA CON CAMBIOS; corregido el docstring de `computeHealth` y añadido test de `recordJwtExpiry` (core 89 tests).
- **Aceptación del usuario en preview**: wizard completo, panel y logo validados. `estado: finalizada`.
