# Guía de depuración

Cómo seguir una petición de la API de 027Apps desde el log hasta Sentry, y qué hacer con los fallos más comunes. Complementa [`docs/flows/cicd.md`](flows/cicd.md) y [`docs/infrastructure.md`](infrastructure.md).

## 1. Un log por petición (JSON de una línea)

Cada paso por `withDoor` (`packages/core/src/api/door.ts`) emite una línea JSON al logger del hosting. Nunca incluye cuerpos, contraseñas, tokens, emails ni IPs.

```json
{"ts":"2026-11-05T10:00:00.000Z","level":"info","msg":"request completed","request_id":"6f1c…","route":"/api/v1/settings","status":200,"duration_ms":12,"actor":"session:1047…"}
```

| Campo | Significado |
|---|---|
| `request_id` | UUID de la petición; es también la cabecera `X-Request-Id` de la respuesta |
| `route` | Ruta solicitada (`/api/v1/...`) |
| `status` | Código HTTP final |
| `duration_ms` | Tiempo total en el door |
| `actor` | `session:<userId>`, `service:<keyId>` o `anon` (nunca email/IP) |
| `code` | Código del envelope de error (solo en la línea del error) |
| `level` | `info` (2xx/3xx/4xx), `error` (5xx) |

Los 5xx añaden otra línea con `code: internal` y un mensaje genérico (nunca el mensaje crudo del error). El `stack` no se serializa en el log.

### Dónde verlos

- **Local**: la terminal de `pnpm dev` (o `pnpm start`).
- **Vercel**: `vercel logs <deployment-url>`; filtrar por `request_id`.
- **CI**: los tests no emiten logs de producción.

### Correlacionar

1. El cliente recibe `X-Request-Id: <id>`.
2. Busca ese `request_id` en los logs del hosting.
3. Si es 5xx, el mismo `request_id` aparece en Sentry como tag (si hay DSN).

## 2. Sentry (solo 5xx, sin PII)

- Se activa solo si existe `SENTRY_DSN` (variable **de servidor**, nunca `NEXT_PUBLIC_`). Sin DSN la instancia funciona igual, sin agregación.
- `sendDefaultPii: false` y `beforeSend` pasa por `scrubEvent` (`packages/core/src/observability/scrub.ts`):
  - elimina `request.*`, `user.ip`, `user.email`, `breadcrumbs` y `extra`;
  - **no envía 4xx** ni el **503 operativo de `/health`**;
  - si el scrub falla, el evento se descarta (**fail-closed**).
- La inicialización vive en `apps/admin/instrumentation.ts` (y `sentry.server.config.ts`).

## 3. Salud operativa: `/api/v1/health`

- `200 { status: "ok" }` o `503 { status: "degraded", degradedReasons: [...] }`.
- `503` es un **estado operativo**, no un bug: no genera evento en Sentry.
- Motivos habituales: `database_unreachable` (BD caída o `SUPABASE_DB_URL` mal) y `encryption_key_missing` (secretos FCM configurados sin `SETTINGS_ENCRYPTION_KEY`).

## 4. Fallos comunes

| Síntoma | Causa probable | Qué mirar |
|---|---|---|
| `/` redirige a `/setup` | no hay ningún `super_admin` activo | `select role from profiles`; completar el wizard |
| `/` o `/setup` redirigen a `/login` | hay admin pero no sesión | cookies `sb-*`; `supabase.auth.getUser()` |
| El wizard bloquea en el paso 2 | el proyecto Supabase emite tokens ≠ 900 s | `security.jwt_expiry`; Auth → Sessions → JWT expiry = 900 |
| `POST /setup/super-admin` 409 | el email pertenece a una cuenta real | usar otro email; los huérfanos sin perfil se recuperan solos |
| 500 en setup con "already registered" | auth user huérfano de un intento fallido | el door lo borra y reintenta si no tiene perfil ni login |
| Paso 3 no envía email | SMTP del proyecto Supabase sin configurar | Auth → Emails → SMTP (Resend/Brevo); en local, Mailpit `:54324` |
| `401` en `/api/v1/*` con sesión | falta el Bearer; el proxy lo inyecta para `/api/v1` | `proxy.ts` matcher y cookies de sesión |
| `429` | rate limit del door | `retry-after`; límites en `rate_limit.*` |
| Logs sin `request_id` | petición fuera del door (asset, página) | solo las rutas `/api/v1` pasan por `withDoor` |

## 5. Comandos útiles

```bash
# Logs de un deployment de Vercel
vercel logs <deployment-url>

# Estado del stack local
supabase status

# Correo de prueba atrapado en local
open http://localhost:54324

# Puerta completa antes de commitear
pnpm lint && pnpm tsc && pnpm test && pnpm --filter admin build
```
