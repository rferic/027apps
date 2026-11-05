---
id: sprint-05-task-03
titulo: Esqueleto de la API v1 (puertas, errores, request_id, rate limiting)
area: core
estado: finalizada
adrs: [0004, 0007]
plan: docs/superpowers/plans/2026-10-31-sprint-05-core-base.md
---

**Alcance**: estructura `app/api/v1/**`; envelope de error del ADR 0007 con `request_id`; cabecera `X-Request-Id` en **todas** las respuestas; validación zod `.strict()` en el borde; **rate limiting en capas** sobre `rate_limit_counters` (global, por endpoint, escritura) con 429 + `Retry-After`; CORS por allowlist.

**TDD**: contract tests de puerta (errores, sin fuga de internos, cabecera, 429, CORS rechaza origen no listado).

**DoD**: TDD, checks, ADRs 0004/0007, QA + auditoría; checklist A03/A04/A05.

## Bitácora (2026-11-01)

- **Paquete `@027apps/core`**: creado con `errors.ts` (modelo de errores, `DEFAULT_MESSAGES`, `HTTP_STATUS`, `DomainError`, `toEnvelope`), `rate-limit.ts` (ventana fija) y `door.ts` (puerta). **33 tests** verdes (TDD: rojo primero). Inglés en código y comentarios (§12).
- **Invariantes verificados**: envelope con `request_id` + `X-Request-Id` en toda respuesta; sin stack/SQL/rutas internas ni siquiera en dev; 429 con `Retry-After`; CORS estricto por allowlist (preflight rechazado con 403 si el origen no está listado); zod `.strict()` en el borde con detalles de validación.
- **Falta**: integración de las rutas `app/api/v1/**` (task-04) y el guard de autorización por scopes (task-02).

## Bitácora (2026-11-02) — auditoría, fixes y CI verde

- **Auditoría (2 agentes independientes, no autores)**: revisión de código + OWASP sobre la puerta completa (A03/A04/A05 incluidos vía alcance de tasks 02/04) → veredicto «aprobada con cambios». Hallazgos corregidos en `7b549b4`: door endurecida (orden de cabeceras de IP real `x-real-ip` > `x-vercel-forwarded-for` > `x-forwarded-for`; cap de cuerpo 1 MB → `payload_too_large`; CORS con respuesta dedicada `cors_origin_not_allowed`; buckets de rate limit separados por tipo de identidad — IP/sesión/clave — para que una clave de servicio no comparta contador con sesiones).
- **Fix de build en CI/Vercel** (`6d0c8f5`): la puerta ya no valida envs en *module scope*; `getInfra()` perezoso + `connection()` hace las rutas dinámicas y el build pasa sin credenciales (fail-closed se mantiene en runtime).
- **CI en verde** (run `41419226946`, commit `a31566d`): los 7 checks pasan; los contract tests de la puerta corren también en CI contra el stack local (`supabase`, 76/76).
- **Pendiente para `finalizada`**: auditoría de seguridad final post-fix (agente distinto) + aceptación de la puerta en preview (bloqueada por paso B del doc CI/CD: env `SUPABASE_DB_URL` en Preview + migraciones remotas).

## Bitácora (2026-11-02) — auditoría final y su resolución

- **Auditoría final (agente distinto)** sobre `897ea8b^..a31566d`: veredicto **«aprobada con cambios»** — sin críticos ni altos; el checklist A03/A04/A05 de la puerta queda en ✔ salvo lo resuelto hoy.
- **Hallazgos resueltos en la puerta** (commit de hoy):
  1. (Medio) Transacción real en producción: `runInTransaction` (BEGIN/COMMIT/ROLLBACK) inyectado en `settingsDeps`/`currenciesDeps` — el runner del contrato `TransactionRunner` es una unidad atómica real, no solo binding.
  2. (Medio) Cabeceras A03: `nosniff`, `Referrer-Policy`, `X-Frame-Options` en `next.config.ts`; CSP estricta con nonce del proxy en modo **Report-Only** (el shell prerenderizado de Cache Components no puede llevar nonce por petición; enforcement condicionado a verificación en navegador — deuda documentada).
  3. (Bajo) Cap duro de stream en `readBody` para cuerpos chunked sin `content-length` (test nuevo).
  4. (Bajo) `rateLimits.read` (120/min) en los GET autenticados de settings y currencies (tests 429 en db-tests).
- **Hallazgos aceptados** (documentados, no código): rotación de identidad IP sin proxy de confianza y purga de contadores → sprint-06; catálogo `rate_limit.*`/`security.cors_allowlist` aún sin cablear → sprint-06.
- **Verde tras los fixes**: lint ✓, tsc ✓, tests ✓ (core 69, admin 41, db-tests 78), build sin envs ✓ (16/16).

## Cierre (2026-11-05)

- **Aceptación del usuario en preview**: wizard de instalación completo (pasos 1–5), panel y logout validados en el deployment de Vercel de `sprint/05-core-base` (PR #26). CI en verde: `admin`, `android`, `guard-secrets`, `supabase`, `commitlint`.
- **Puerta local**: `pnpm lint` ✓, `pnpm tsc` ✓, `pnpm test` ✓ (core 89, admin 77, db-tests 78), `pnpm --filter admin build` ✓.
- **Auditorías**: OWASP (`ingeniero`) → APROBADA CON CAMBIOS, sin críticos ni altos; estilo (`cocinero`) → APROBADA CON CAMBIOS. Fixes aplicados en `0fcb44b` (gate solo en las 3 rutas de entrada; recuperación de huérfanos solo si el usuario nunca ha iniciado sesión + error check; logs sin mensajes crudos de Supabase; `confirmSmtpAction` exige super_admin; test de `recordJwtExpiry`).
- **Deuda aceptada y documentada**: carrera teórica de recuperación de huérfanos dentro de la ventana de setup abierta (mitigada con `last_sign_in_at`); rate limiting del login delegado en Supabase Auth; invariante de actor en `security.jwt_expiry` documentada en el código.
