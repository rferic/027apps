# Checklist de seguridad (OWASP) — por tarea

La usa el **auditor** en cada tarea, antes de `finalizada`. El [DoD](definition-of-done.md) sigue siendo la norma; esto es el detalle ejecutable. Modelo de amenazas y política de secretos: [`2026-10-26-seguridad.md`](../superpowers/specs/2026-10-26-seguridad.md).

**Cómo marcar**: `✔ aplica y cumple` · `— no aplica` · `✘ hallazgo` (con severidad; **crítico o alto bloquea**).
Si un fallo se repite en dos tareas, se convierte en **check mecánico** y se anota como "verificado por herramienta".

---

## A01 · Control de acceso

- [ ] Cada ruta/acción **declara sus scopes** y pasa por el **guard** (`authorize(caller, scopes)`); ninguna puerta se salta el guard.
- [ ] El rol se resuelve **en vivo** por petición (o caché invalidada al cambiar membresía/rol).
- [ ] `profiles.role` **no** es editable por el propietario; `user_modules`/`user_categories` solo admin (sin auto-concesión).
- [ ] Invariantes de rol: **root de `/setup` no se demota/desactiva**, **siempre ≥1 `super_admin` activo**.
- [ ] Claves de máquina: `role_cap` aplica (`min(scopes, role_cap)`); una `service` **nunca** actúa como usuario; una delegada **nunca** entra en `/mcp/admin`.
- [ ] **RLS como segunda barrera** en toda tabla con datos de grupo/módulo (ver A01-RLS).
- [ ] Recursos ajenos: se responde **sin enumerar** (404/403 uniformes, mismo cuerpo).

### A01-RLS (patrón canónico)

- [ ] RLS **habilitada**; sin política = **deny**.
- [ ] Se usan las funciones compartidas (`core_is_admin()`, `core_is_super_admin()`, `has_module_access()`, `core_can_subscribe()`), **no** condiciones ad-hoc.
- [ ] Definers: `SET search_path = ''`, `STABLE` si aplica, `REVOKE EXECUTE FROM PUBLIC`, **`OWNER` correcto**.
- [ ] **Ninguna** política permisiva sin comparar fila/topic (la combinación OR de permisivas ya causó un fallo).
- [ ] Suite de **aislamiento por tabla** (dos grupos/usuarios con datos que comparten emails/fechas).
- [ ] Actores identificables: humano (`*_by`) o clave (`*_by_key`) con CHECK de exactamente uno.
- [ ] **Atribución antes de borrado**: una clave referenciada se anonimiza, no se borra (sin `CASCADE`).

## A02 · Fallos criptográficos / exposición de datos

- [ ] Secretos **write-only** y enmascarados (`configured: true`), nunca devueltos por API.
- [ ] Cifrado: AES-256-GCM, **nonce nuevo por cifrado** (incluido re-cifrado), **AAD por clave**.
- [ ] Secretos **nunca** en logs, eventos, `admin_actions`, `idempotency_keys.response` ni `settings_public`.
- [ ] Respuestas **sin campos de más** (representación compartida); errores **sin** SQL/stack/rutas.
- [ ] Sin PII en ninguna superficie (logs, Sentry, eventos): solo UUID.
- [ ] Integraciones de terceros: **defaults de privacidad revisados** (p. ej. Sentry `sendDefaultPii:false`, sin `event.request`, sin IP).

## A03 · Inyección

- [ ] **zod en todos los bordes** (`.strict()`), y los invariantes también se validan en el caso de uso (no se confía en el borde).
- [ ] SQL **parametrizado**; ninguna consulta por concatenación.
- [ ] **Nada de DDL/SQL dinámico desde agentes** (MCP) ni desde el manifest fuera del instalador.
- [ ] Textos de usuario: **texto plano** (nunca HTML/Markdown interpretado); placeholders i18n validados (paridad con el inglés).
- [ ] Nombres dinámicos (funciones SQL de módulo, jobs) validados por **regex** y allowlist.

## A04 · Diseño inseguro / abuso

- [ ] **Rate limiting en capas** (global por identidad + sub-tope por endpoint + presupuesto de escritura), con **almacén compartido**.
- [ ] Superficies sin identidad (`/setup*`, `/health`, `/invitations/{token}/redeem`) con límite propio por IP.
- [ ] **Idempotencia** en escrituras (`id` de cliente o `idempotency_key` con `request_hash`); payload distinto → `conflict`.
- [ ] Acciones destructivas: **confirmación explícita**; `confirm: true` en tools MCP destructivas + anotación `destructiveHint`.
- [ ] Jobs: **lease/lock robusto** (no locks de sesión), **rol dedicado** con grants mínimos, **nunca** `auth.*`.
- [ ] Límites de tamaño en entradas masivas (imports, payloads) y procesado por lotes.

## A05 · Configuración insegura

- [ ] **Defaults seguros**: CORS sin `*`, rate limits activos, `security.*` y CORS **solo `super_admin`**, `security.*` con `mcp_access = none`.
- [ ] `/health` **sin detalle**; estado operativo solo para admin.
- [ ] `debug`/verbosidad **fijados en build**, nunca ajustables en runtime.
- [ ] Contraseñas **fuera** de nuestras tablas (Supabase Auth); ninguna credencial en el cliente (`NEXT_PUBLIC_*`).
- [ ] Cabeceras/errores de auth: **401 con `WWW-Authenticate`**; 403 para tipo de clave incorrecto.

## A06 · Componentes vulnerables / desactualizados

- [ ] Dependabot **activo** (semanal agrupado, sin auto-merge; security updates prioritarias).
- [ ] **Lockfile** en CI (`--frozen-lockfile`).
- [ ] Acciones de terceros **fijadas por SHA** (las `actions/*` pueden ir por tag mayor); `permissions: {}` por defecto; sin `pull_request_target`.
- [ ] Dependencia nueva: **caso real + justificación** (ADR 0005); licencia y mantenimiento revisados.
- [ ] SDK de terceros con **versión pinneada**.

## A07 · Fallos de identificación y autenticación

- [ ] Revocación **efectiva al instante**: `revoked_at`/`expires_at` comprobados en BD o caché invalidada (no TTL que lo retrase).
- [ ] Sesiones por dispositivo, revocables; recuperación con email + contraseña.
- [ ] `JWT_EXPIRY = 900 s` en el proyecto Supabase (lag de revocación de realtime acotado y documentado).
- [ ] Tokens opacos **hasheados** (SHA-256) en BD; secreto mostrado **una vez**; prefijo identificable.
- [ ] Login/registro: solo por **invitación** (salvo el primer admin); rate limiting del login (Supabase) y del canjeo.

## A08 · Integridad de datos y software

- [ ] Manifest de módulo: **esquema estricto + digest** (`up` y `down`) verificado; **confirmación humana** del diff de DDL.
- [ ] DDL ejecutado con **rol acotado** al esquema del módulo.
- [ ] Cadena de suministro (A06) y lockfile.
- [ ] Backups: cifrados, **off-site**, con la **clave maestra custodiada aparte**.
- [ ] Migraciones aplicadas por CI; sin cambios manuales de esquema en producción.

## A09 · Fallos de registro y monitorización

- [ ] Logs estructurados con **`request_id`** y sin PII/secretos; `request_id` en la respuesta (`X-Request-Id`) y en `admin_actions`.
- [ ] Errores agregados (Sentry) **solo 5xx/inesperados**; los 4xx esperados **no** generan evento; scrub fail-closed.
- [ ] Mutaciones sensibles en **`admin_actions`** (actor humano o clave, con `request_id`), sin valores ni secretos.
- [ ] Purgas/retenciones: **atribución preservada**; las purgas sensibles dejan rastro.
- [ ] Alertas al propietario (email) para errores nuevos.

## A10 · SSRF

- [ ] Ninguna petición del servidor a URLs **aportadas por el usuario** sin allowlist.
- [ ] `instance.public_url` (y cualquier URL de configuración) validada como `https` sin credenciales embebidas; solo `super_admin` la cambia.
- [ ] Webhooks/callbacks (si se añaden): allowlist + timeouts + sin seguir redirecciones a redes internas.

---

## Cierre del informe

- [ ] Cada `✘` tiene **severidad**, **resolución** (corregido / aceptado con motivo) y **evidencia** (test, comando o commit).
- [ ] **Ningún crítico ni alto sin resolver.**
- [ ] Si la tarea toca secretos, auth, permisos o datos personales: informe **por escrito** en el PR.
- [ ] Hallazgos repetidos → propuesta de **check mecánico**.
