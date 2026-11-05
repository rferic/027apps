---
id: sprint-06-task-04
titulo: API keys y dispositivos
area: core
estado: test
adrs: [0004, 0007]
plan: docs/superpowers/plans/2026-10-27-core-implementation-roadmap.md
---

**Alcance**: `/api-keys` con secreto mostrado **una vez** (hash en BD), `role_cap` solo en service, revocación inmediata; `POST/GET/DELETE /devices` con `push_token` único y `last_seen_at`.

**TDD**: casos de contrato de puerta (scopes/403, representación) + caso de uso (invariantes), y los casos negativos de la checklist de seguridad aplicables.

**DoD**: DoD de Código (TDD, lint/tsc/test/build, CI), ADRs declarados, QA con ojos nuevos y **auditoría OWASP** (checklist `security-checklist.md`).

## Bitácora (2026-11-05)

- **Migración** `0009_api_keys_devices.sql`: `api_keys` (hash único, `kind`, `scopes`, `user_id`/`role_cap` mutuamente excluyentes, `expires_at`, `revoked_at`, `last_used_at`) y `devices` (`push_token` único, `last_seen_at`, revocación soft), con RLS: claves delegadas visibles por su dueño y admins, service solo super_admin; dispositivos por dueño/admin; `anon` sin privilegios.
- **API keys** (`packages/core/src/api-keys/{service,api}.ts`): creación con CSPRNG (`027_svc_`/`027_usr_`), solo SHA-256 en BD y secreto devuelto una vez; `role_cap` solo en service; listado sin secreto/hash; get/revoke con visibilidad por dueño o super_admin; revocación idempotente. `resolveApiKey` comprueba revocación/caducidad **en cada petición** y actualiza `last_used_at` como máximo una vez por minuto (CTE atómica).
- **Resolución de claves opacas**: `resolveCaller` detecta `027_svc_`/`027_usr_`, resuelve la clave en BD y construye el `Caller` (service con `roleCap`; delegada con el rol vivo del usuario y perfil activo). Las claves revocadas/caducadas dejan de funcionar en la llamada siguiente.
- **Guard**: `roleCap` de delegadas admite `user`; scopes nuevos `api_keys:read/write/revoke` y `devices:read/write/revoke` para usuario/admin/super_admin, con `min(scopes, role_cap)` también en claves delegadas.
- **Dispositivos** (`packages/core/src/devices/{service,api}.ts`): alta idempotente por `push_token` (reasigna si el móvil cambia de usuario y reactiva un dispositivo revocado), listado propio o por `?user=` para admins, revocación soft + borrado de `auth.sessions` del dueño vía adaptador (el JWT ya emitido vive como máximo 15 min).
- **Desactivación**: `deactivateUser` revoca en la misma transacción las claves y dispositivos del usuario (deuda declarada en task-01).
- **Rutas admin**: `GET/POST /api/v1/api-keys`, `GET/DELETE /api/v1/api-keys/{id}`, `GET/POST /api/v1/devices`, `DELETE /api/v1/devices/{id}`.
- **Decisión de alcance**: las claves service solo las crea una sesión `super_admin` desde el panel (no una clave service), porque `api_keys.created_by` es NOT NULL → `profiles.id` y una clave service no tiene usuario; se documenta como precisión de la tabla §3.6. El `include_usage` de `GET /api-keys/{id}` queda para task-07 (tabla `audit`).
- **Tests**: 8 de servicio de claves (hash, service vs delegated, visibilidad, resolución/revocación/caducidad, deactivación, escalada delegada→service, end-to-end `resolveCaller`), 5 de dispositivos (idempotencia, reasignación, listado admin, revocación + sesiones, service rechazado), 4+3 de API, 5 de `resolveCaller` con claves y 4 de RLS.
- **Verde**: lint ✓, tsc ✓, core 119, admin 77, db-tests 162, build ✓.
- **Correcciones tras auditoría**: **hallazgo alto corregido** — una clave delegada (aunque su dueño sea `super_admin`) ya **no** puede mintear claves service; solo una sesión `super_admin`, con test de regresión y prueba end-to-end crear→resolver→revocar. RLS: los admins pueden leer claves delegadas ajenas (modelo §5); la API mantiene el listado en “propias o todas si super_admin”, así que RLS es segunda barrera más amplia, no la autorización. Se aceptan y documentan: reasignación de `push_token` (decisión del modelo), escritura directa por RLS con scopes que el guard recorta, y la duplicación de `toIso` (deuda de refactor transversal).
- **Auditorías**: QA/OWASP → APROBADA CON CAMBIOS; el alto está corregido y verificado. Estilo → APROBADA CON CAMBIOS (solo duplicaciones/estilo no bloqueantes).
- **Pendiente para `finalizada`**: CI del PR.
