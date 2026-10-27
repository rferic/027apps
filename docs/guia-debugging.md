# Guía de depuración

Cómo diagnosticar un fallo de una instancia de 027Apps **sin leer código**. Pensada para el propietario de la instancia (admin), no para desarrolladores del Core.

> **Estado**: las rutas de esta guía son las **canónicas de diseño** (`/api/v1/...`). Mientras no se implementen, hoy existe el alias **`/api/health`** (lo usa el keep-alive); cuando el PR de `keep-alive.yml`/`cicd.md` migre al canónico, el alias desaparecerá.
>
> Si el problema es **pérdida o corrupción de datos**, esto no ayuda: ve a [Restauración](#7-cuándo-restaurar-desde-un-backup).

## 1. Correlación: `request_id`

Toda respuesta lleva la cabecera **`X-Request-Id`**; los errores la repiten en el cuerpo:

```json
{ "error": { "code": "internal", "message": "…", "request_id": "9f2c…" } }
```

En MCP, el mismo `request_id` va dentro del error de ejecución (`structuredContent.error.request_id`). La app móvil y el panel lo muestran en la pantalla de error.

1. Pide al usuario **el `request_id`** (o la captura de la pantalla de error). **No** pidas capturas con datos.
2. Búscalo en **Sentry** (tag `request_id`).
3. Búscalo en los **logs del despliegue** (Vercel → Deployments → Functions/Logs).
4. Si aparece en `admin_actions`, tienes la acción concreta que lo provocó.

> Los logs del hosting tienen **retención corta**. Si el aviso es antiguo, tira de Sentry (30 días) y de `audit`/`admin_actions` en la base de datos.

## 2. Orden de mirada

| Paso | Qué | Dónde |
|---|---|---|
| 1 | ¿La instancia está sana? | `GET /api/v1/health` (hoy `/api/health`) |
| 2 | ¿Hay algo atascado? | `GET /api/v1/maintenance/status` (sesión **`super_admin`**) |
| 3 | ¿Qué error exacto? | Sentry, filtrando por `request_id` |
| 4 | ¿Qué pasó justo antes? | Logs del despliegue o `admin_actions` |

```bash
# Salud (usa -i para ver la cabecera X-Request-Id)
curl -sS -i "$INSTANCE_URL/api/v1/health"

# Comprobar solo el header, sin cuerpo
curl -sS -D - -o /dev/null "$INSTANCE_URL/api/v1/health"
```

> `/health` está **cacheado 30 s**: si acabas de arreglar algo, espera medio minuto antes de dar el incidente por cerrado.

## 3. Diagnóstico por síntoma

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| **5xx repetidos** | Error de código o dato corrupto | Sentry → issue → `request_id` → logs. Si empezó tras un despliegue, revertir (flujo de bugfix) |
| `/health` = `degraded` (503) · Supabase | Proyecto Supabase pausado (free) o env inválidas | Abrir el proyecto Supabase (despierta la pausa); revisar env del hosting |
| `/health` = `degraded` · **migraciones** | Migraciones sin aplicar | Aplicar migraciones (Supabase CLI / CI) y repetir |
| `/health` = `degraded` · **outbox** | Eventos sin entregar (Realtime/FCM) | `/maintenance/status` → contadores → lanzar el job de mantenimiento (abajo) |
| `/health` = `degraded` · **job atrasado** | `pg_cron` parado o workflow `maintenance` deshabilitado | Revisar Actions y que `pg_cron` esté activo |
| **Nadie recibe push** | FCM sin configurar o service account caducado | Ajustes → Notificaciones: `notifications.push.provider` y claves |
| **No llegan emails de reset** | SMTP del **proyecto Supabase** (no de la app) | Supabase → Authentication → SMTP; enviar un reset de prueba |
| **429** | Rate limit por identidad | Esperado con mucho tráfico; ajustable solo por `super_admin` |
| **`validation_failed`** con `details` | La app envió datos inválidos | Fallo de cliente: revisar formulario/petición |
| **Invitación caducada/usada** | Token de un solo uso | Crear invitación nueva |
| **No veo un módulo** | No activo, no expuesto o sin acceso | Ajustes → Módulos / Usuarios |

**Lanzar mantenimiento a mano** (cuando el outbox está atascado): lo ejecuta una **clave de instancia** (`027_svc_`) con scope `maintenance:run` y `role_cap=super_admin` — no una sesión de admin:

```bash
curl -sS -X POST "$INSTANCE_URL/api/v1/maintenance/run" \
  -H "Authorization: Bearer $SERVICE_KEY" -H 'Content-Type: application/json' -d '{}'
```

Si responde **409**, ya hay una ejecución en curso: espera y repite.

## 4. Qué NO hacer

- **No pegues tokens, contraseñas, emails ni cuerpos de petición** en issues o chats. Usa el `request_id`.
- **No edites `auth.users`** a mano: rompe `profiles` y las sesiones. Usa el panel.
- **No borres filas de la BD** para "arreglar": el historial de dinero no se borra.
- **No desactives el rate limiting** como parche.

## 5. Qué mirar cuando no hay error

| Pregunta | Dónde |
|---|---|
| ¿Qué versión corre? | `/api/v1/instance` → `version` (o el commit desplegado en Vercel) |
| ¿Qué se ejecutó y cuándo? | `/api/v1/maintenance/status` |
| ¿Qué cambió la configuración? | `admin_actions` (con `request_id`) |
| ¿Qué hizo una clave? | `audit` (contadores por clave × endpoint) |

## 6. Entornos y primera instalación

- **`environment` de Sentry**: `production`, `preview` (ramas/PR) y `development` (local). Filtra por entorno antes de concluir que algo está roto en producción.
- **`debug`**: solo existe en desarrollo (`NODE_ENV`); en producción y preview está apagado y **no se puede activar desde el panel**.
- **Primer arranque (`/setup`)**: si el asistente no aparece, la instancia ya tiene `super_admin`; si devuelve **429**, estás en el límite de intentos por IP (espera). Si falla el paso de cifrado, comprueba que `SETTINGS_ENCRYPTION_KEY` está definida (32 bytes) — sin ella la instancia arranca en `degraded`.

## 7. Cuándo restaurar desde un backup

Si hay **pérdida o corrupción de datos** (borrado accidental, migración defectuosa, proyecto destruido), los logs no arreglan nada: hay que restaurar.

El procedimiento vive en el **runbook de infraestructura** ([`docs/infrastructure.md`](infrastructure.md)) y en la [spec de backup](superpowers/specs/2026-10-26-backups.md). Criterio:

- El **esquema** vive en git (migraciones); lo que se recupera es el **dato**.
- El backup es un **dump lógico diario, cifrado y off-site**.
- La **clave maestra de secretos** (`SETTINGS_ENCRYPTION_KEY`) se custodia **aparte del backup** (ver `docs/superpowers/specs/2026-10-26-instance-config.md` §5): sin ella, los secretos guardados no se descifran.

## 8. Verificar que la observabilidad funciona

1. Una petición correcta debe volver con **`X-Request-Id`**.
2. Un error **esperado** (p. ej. recurso inexistente con credenciales válidas) debe devolver su `code` con `request_id` y **no** generar evento en Sentry.
3. Un error **inesperado** (solo en preproducción) debe aparecer en Sentry con `release`, `environment` y `request_id`.
4. `/health` debe responder `ok`.

Si (2) genera evento o (3) no lo genera, el filtrado de Sentry está mal configurado.

## 9. Referencias

- Errores y códigos: `docs/adr/0007-manejo-de-errores.md`
- Observabilidad (contrato): `docs/superpowers/specs/2026-10-26-observabilidad.md`
- Salud y mantenimiento: `docs/superpowers/specs/2026-10-26-jobs-mantenimiento.md`
- Configuración y secretos: `docs/superpowers/specs/2026-10-26-instance-config.md`
- Backups y operación: [`docs/infrastructure.md`](infrastructure.md) · [spec de backup](superpowers/specs/2026-10-26-backups.md)
- Flujos: `docs/flows/bugfix.md`, `docs/flows/hotfix.md`