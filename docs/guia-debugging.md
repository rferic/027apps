# Guía de depuración

Cómo diagnosticar un fallo de una instancia de 027Apps **sin leer código**. Pensada para el propietario de la instancia (admin), no para desarrolladores del Core.

> Si el problema es **pérdida o corrupción de datos**, no empieces por aquí: ve a [Restauración](#6-cuándo-restaurar-desde-un-backup). Los logs no arreglan datos.

## 1. Correlacionar un aviso

Toda respuesta de la API lleva la cabecera **`X-Request-Id`**, y todo error la repite además en el cuerpo:

```json
{ "error": { "code": "internal", "message": "…", "request_id": "9f2c…" } }
```

La app móvil y el panel muestran ese `request_id` en la pantalla de error.

1. Pide al usuario **el `request_id`** (o la captura de la pantalla de error). No pidas capturas de datos.
2. Búscalo en **Sentry** (tag `request_id`).
3. Búscalo en los **logs del despliegue** (Vercel → Deployments → Functions/Logs).
4. Si aparece en `admin_actions` (mismo `request_id`), tienes la acción concreta que lo provocó.

## 2. Orden de mirada

| Paso | Qué | Dónde |
|---|---|---|
| 1 | ¿La instancia está sana? | `GET /api/v1/health` |
| 2 | ¿Hay algo atascado? | `GET /api/v1/maintenance/status` (admin) |
| 3 | ¿Qué error exacto? | Sentry, filtrando por `request_id` |
| 4 | ¿Qué pasó justo antes? | Logs del despliegue, por `request_id` |

```bash
# 1) Salud (503 = degradado; el cuerpo solo dice el estado)
curl -s https://<tu-instancia>/api/v1/health

# 2) Estado operativo (necesita sesión de super_admin en el panel)
#    En el panel: Ajustes → Mantenimiento
```

## 3. Diagnóstico por síntoma

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| **5xx repetidos** en una ruta | Error de código o dato corrupto | Sentry → issue → `request_id` → logs. Si empezó tras un despliegue, revertir (ver flujo de bugfix) |
| `/health` = `degraded` (503) con Supabase caído | Proyecto Supabase pausado (free tier) o credenciales inválidas | Abrir el proyecto en Supabase (despierta la pausa) y comprobar que las env del hosting son correctas |
| `/health` = `degraded` con **outbox atascado** | Los eventos no se entregan (fallo de Realtime/FCM) | `/maintenance/status` → contadores de outbox → ejecutar mantenimiento (o esperar al horario) |
| `/health` = `degraded` con **job atrasado** | `pg_cron` no corre o el workflow horario está deshabilitado | Revisar GitHub Actions (workflow `maintenance`) y que `pg_cron` esté activo en Supabase |
| **Nadie recibe push** | FCM sin configurar o service account caducado | Ajustes → Notificaciones; comprobar `notifications.push.provider` y las claves |
| **No llegan emails de reset** | SMTP del **proyecto Supabase** mal configurado (no es de la app) | Supabase → Authentication → SMTP; enviar un reset de prueba |
| **429** | Rate limit por identidad | Es esperado si hay mucho tráfico; ajustable en Ajustes → Seguridad (solo `super_admin`) |
| **`validation_failed`** con `details` | La app envió datos inválidos | Es un fallo de cliente: revisar el formulario/petición, no el servidor |
| **Invitación caducada / ya usada** | Token de un solo uso con `expires_at` | Crear una invitación nueva |
| **No veo un módulo** | No está activo, no está expuesto, o el usuario no tiene acceso | Ajustes → Módulos (estado y `mcp_exposed`) y Ajustes → Usuarios (acceso) |

## 4. Qué NO hacer

- **No pegues tokens, contraseñas, emails ni cuerpos de petición** en issues, tickets o chats. Usa el `request_id`.
- **No edites `auth.users`** a mano en Supabase: rompe `profiles` y las sesiones. Usa el panel (invitar, desactivar, revocar).
- **No borres filas de la BD** para "arreglar" algo: el historial de dinero no se borra (se corrige con transferencias/asientos del módulo).
- **No desactives el rate limiting** como solución temporal: es parte de la seguridad de la instancia.

## 5. Qué mirar cuando no hay error

| Pregunta | Dónde |
|---|---|
| ¿Qué versión corre? | `/api/v1/instance` (versión) o el commit desplegado en Vercel |
| ¿Qué se ejecutó y cuándo? | `/api/v1/maintenance/status` (última ejecución por job) |
| ¿Qué cambió la configuración? | `admin_actions` (acciones sensibles con `request_id`) |
| ¿Qué hizo una clave/API? | `audit` (contadores por clave × endpoint) |

## 6. Cuándo restaurar desde un backup

Si hay **pérdida o corrupción de datos** (borrado accidental, migración defectuosa, proyecto destruido), los logs no ayudan: hay que restaurar.

El procedimiento vive en el **runbook de infraestructura** (la spec de backup del sprint de infraestructura), no en esta guía. Resumen del criterio:

- El **esquema** vive en git (migraciones); lo que hay que recuperar es el **dato**.
- El backup es un **dump lógico diario, cifrado y off-site**.
- La **clave maestra de secretos** (`SETTINGS_ENCRYPTION_KEY`) se custodia **aparte del backup**: sin ella, los secretos guardados no se descifran (ver "Custodia de la clave").

## 7. Verificar que la observabilidad funciona

Después de instalar o cambiar configuración:

1. Haz una petición correcta → debe volver con cabecera **`X-Request-Id`**.
2. Provoca un error controlado (p. ej. un `GET /api/v1/users/{id}` con id inexistente y credenciales válidas): debe devolver `not_found` **con** `request_id` y **no** generar evento en Sentry (es 4xx esperado).
3. Fuerza un error interno en preproducción (o espera al primero real): debe aparecer en **Sentry** con `release`, `environment` y `request_id`.
4. Comprueba que `/health` responde `ok`.

Si (2) genera evento en Sentry o (3) no lo genera, la configuración de filtrado está mal.

## 8. Referencias

- Errores y códigos: `docs/adr/0007-manejo-de-errores.md`
- Salud y mantenimiento: `docs/superpowers/specs/2026-10-26-jobs-mantenimiento.md`
- Observabilidad (contrato): `docs/superpowers/specs/2026-10-26-observabilidad.md`
- Backups y operación: el documento de infraestructura (rama `sprint/infra-backups`) (rama de infraestructura)
- Flujos: `docs/flows/bugfix.md`, `docs/flows/hotfix.md`