---
id: sprint-05-task-04
titulo: Salud, instancia y ajustes con secretos cifrados
area: core
estado: test
adrs: [0004, 0007, 0008]
plan: docs/superpowers/plans/2026-10-31-sprint-05-core-base.md
---

**Alcance**: `GET /health` (ok/degraded, 503, caché 30 s), `GET /instance` con `version`, `requires_setup`, `setup_incomplete` y `settings_public`; `GET /settings` (secretos **enmascarados** con `configured`), `PATCH /settings/{category}.{key}` (solo valor, validación por catálogo, `security.*`/`public_url`/CORS solo super_admin); cifrado **AES-256-GCM** (nonce nuevo por cifrado, AAD = versión+clave, formato versionado); `currencies` + default habilitada.

**TDD**: secreto nunca sale en claro; editar una clave manual cambia el cuerpo servido; moneda deshabilitada → `currency_not_enabled`; descifrado fallido → degradado controlado.

**DoD**: TDD, checks, ADRs 0004/0007/0008, QA + auditoría; checklist A02/A05.

## Bitácora (2026-11-01)

- **Crypto** (`packages/core/src/crypto.ts`): AES-256-GCM con clave maestra de 32 bytes base64 (`SETTINGS_ENCRYPTION_KEY`), nonce de 12 bytes nuevo por cifrado, AAD = `<versión>|<slot>` y formato `v1:<iv>:<tag>:<ciphertext>`; fallo de descifrado → `null` (nunca lanza, nunca filtra).
- **Catálogo** (`packages/core/src/settings/catalog.ts`): 18 claves con zod + metadata (`is_secret`, `is_public`, `mcp_access`, `super_admin_only`), coherencia FCM (provider requiere las 5 claves y `project_id` del service account debe coincidir). Seed por migración `0002_settings.sql`; el sync check de db-tests detecta drift entre catálogo y seed.
- **Servicio** (`packages/core/src/settings/service.ts`): `readAllSettings` (secretos enmascarados con `configured`, sin `value_encrypted`), `readPublicSettings` (solo 8 claves públicas), `writeSetting` (validación zod + coherencia entre claves + moneda habilitada, cifrado fail-closed si falta la clave) y `computeHealth` (degradado si BD inalcanzable o secretos con clave ausente).
- **Rutas de door** (fábricas inyectadas): `settings/api.ts` (GET settings, GET categories, PATCH `{key}` con cuerpo `{ value }` estricto), `currencies/service.ts` + `currencies/api.ts` (GET autenticado, PATCH habilitar/deshabilitar con `currency_not_enabled` para la default) e `instance/api.ts` (`/instance` público con `version`/`requires_setup`/`setup_incomplete`/`settings_public`; `/health` público con `Cache-Control: max-age=30` y 503 en degradado).
- **Guards**: scopes `currencies:read` (todos) y `currencies:write` (super_admin/admin) añadidos a `auth/guard.ts`.
- **Wrappers Next** (`apps/admin/src/app/api/v1/**`): 7 `route.ts` finos que inyectan door + auth + puertos reales desde `lib/api/door.ts`.
- **Tests**: `settings/service.test.ts` (16: coherencia, secreto cifrado-only, fail-closed, health) y `api/settings.test.ts`, `api/currencies.test.ts`, `api/instance.test.ts` (19: puertas con request fabricados, 401/403/404/400/429 y cuerpos). Rojo→verde: red encontró el centinela `'configured'` rompiendo `JSON.parse` en la coherencia FCM y el FK del actor; ambos corregidos.
- **Verde**: `pnpm lint && pnpm tsc && pnpm test` (core 48, admin 41, db-tests 72).
- **Pendiente para `finalizada`**: QA + auditoría OWASP (checklist A02/A05) y aceptación de las rutas en preview.

## Bitácora (2026-11-02) — auditoría, fixes y CI verde

- **Auditoría (2 agentes independientes, no autores)**: revisión de código + OWASP (A02/A05) → veredicto «aprobada con cambios». Hallazgos corregidos en `7b549b4`: crypto valida la clave perezosamente (clave ausente/malformada → `null`, sin romper el arranque del módulo), `writeSetting` hace default-check + update de moneda en **una transacción** (`currency_is_default` 409 en vez de condición de carrera), `readAllSettings` recibe el caller para enmascarar según rol, y el valor seed del catálogo de `security.cors_allowlist` sin patrón falso-positivo del guard.
- **Fix de build en CI/Vercel** (`6d0c8f5`): los constructores de puertos reales (pool `pg`, cifrado, settings) se mueven a `getInfra()` perezoso con `connection()` — el build del admin pasa sin envs y los endpoints quedan dinámicos (`ƒ`).
- **CI en verde** (run `41419226946`, commit `a31566d`): los 7 checks pasan; 76/76 tests de integración (incluida la suite de settings/criptografía) contra el stack local en CI; preview Vercel desplegada (hoy 500 en API por falta de `SUPABASE_DB_URL` en el entorno Preview — paso B pendiente, fail-closed correcto).
- **Pendiente para `finalizada`**: auditoría de seguridad final post-fix (agente distinto) + aceptación de health/instance/settings/currencies en preview.

## Bitácora (2026-11-02) — auditoría final y su resolución

- **Auditoría final (agente distinto)** sobre `897ea8b^..a31566d`: veredicto **«aprobada con cambios»** — sin críticos ni altos; confirma que el fix transaccional del core es correcto y detecta que la composición real no lo usaba.
- **Hallazgos resueltos** (commit de hoy):
  1. (Medio) Transacción sin cablear en producción: `runInTransaction` (BEGIN/COMMIT/ROLLBACK) inyectado en `settingsDeps` y `currenciesDeps` — el default-check + update de moneda y el read-merge-validate-write de settings son atómicos también fuera de los fakes de test.
  2. (Bajo) Degradación invisible con clave malformada: canario de cifrado en `createInfra` — una clave que no cifra hace `encryption = null` → `/health` degradado y escrituras fail-closed (antes la puerta parecía sana con secretos ilegibles).
  3. (Bajo) GET autenticados sin tope: `rateLimits.read` (120/min) en `GET /settings`, `GET /settings-categories` y `GET /currencies` con tests 429.
  4. (Medio) Cabeceras A03 y CSP: `nosniff`/`Referrer-Policy`/`X-Frame-Options` aplicados; CSP estricta con nonce en **Report-Only** (limitación documentada del shell prerenderizado de Cache Components; enforcement tras verificación en navegador).
- **Verde tras los fixes**: lint ✓, tsc ✓, tests ✓ (core 69, admin 41, db-tests 78), build sin envs ✓ (16/16).
