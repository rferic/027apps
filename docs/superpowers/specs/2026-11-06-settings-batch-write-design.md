# Spec — Settings: escritura por lotes para evitar rate limiting

**Fecha:** 2026-11-06 · **Estado:** Borrador para aprobación del usuario
**Base:** [spec de API del Core](2026-10-26-core-api.md) (contrato estable, endpoints settings) · [ADR 0007](../../adr/0007-manejo-de-errores.md) (errores, envelope) · [rate limiting §4](2026-10-26-core-api.md#4-rate-limiting-decisión-c1)

## 1. Objetivo

Resolver un bug crítico en el wizard de instalación: 12 escrituras de settings superan el límite de 10 requests/minuto, causando un estado a medias (9 claves guardadas, 3 fallidas con 429). La solución combina un **guardado por lotes** (A) y un **aumento del límite** (B) como red de seguridad.

## 2. Problema verificado

- **Causa:** El wizard llama `PATCH /api/v1/settings/{category}.{key}` 12 veces (name, public_url, default_locale, timezone, default_currency, 4 valores públicos de FCM, service account, provider).
- **Límite actual:** 10 requests/minuto por usuario (`packages/core/src/settings/api.ts`, `rateLimits?.write ?? 10`).
- **Evidencia:** La petición 10 devuelve 429 rate_limited y el guardado se detiene: provider="none", fcm_service_account=null, otras 9 escritas.
- **Consecuencia:** El wizard de instalación **no se puede completar** con FCM configurado.

## 3. Decisión del usuario

Implementar ambas soluciones:

**A. Guardado por lotes:** Una única petición `PATCH /api/v1/settings` con cuerpo `{ updates: [{ key, value }] }` que actualiza 1..30 claves en una transacción atómica.

**B. Aumento del límite:** Subir el límite de escritura de 10 a 30 requests/minuto como red de seguridad para clientes antiguos y para el guardado individual.

## 4. Alcance

**Dentro:**

- Nueva ruta `PATCH /api/v1/settings` para actualizaciones por lotes.
- Servicio `writeSettings` que valida todas las claves antes de escribir, usa una transacción única y garantiza atomicidad.
- La ruta individual existente sigue disponible (B).
- Admin usa la ruta de lote en el wizard.
- Mensajes de error específicos para claves inválidas (ADR 0007).

**Fuera:**

- No cambia el modelo de datos de settings.
- No modifica el contrato de la ruta individual (sigue existiendo).
- No afecta a otros endpoints de settings.

## 5. Contrato técnico

### 5.1 Nueva ruta: PATCH /api/v1/settings

- **Método:** PATCH
- **Ruta:** `/api/v1/settings`
- **Scopes:** `settings:write`
- **Cuerpo:** `{ updates: Array<{ key: string; value: any }> }`
  - Mínimo: 1 entrada
  - Máximo: 30 entradas (límite del payload)
- **Límite de rate:** 30 requests/minuto (usando `DEFAULT_WRITE_LIMIT`)
- **Respuesta:** `SettingView[]` (todas las claves actualizadas)

### 5.2 Validaciones y atomicidad

1. **Validación previa:** Antes de abrir transacción, verifica que cada clave:
   - Existe en el catálogo
   - Tiene permiso de escritura
   - Pasa la validación zod del valor

2. **Duplicados:** Si el cuerpo contiene claves duplicadas, devuelve `validation_failed` con detalles.

3. **Transacción única:** `deps.withTransaction` ejecuta:
   - Lectura de todas las claves actuales
   - Fusión: `merged = actual ∪ updates`
   - Validación de coherencia entre claves del mismo lote
   - Escritura de todas las claves en una operación

4. **Secretos:** Los valores cifrados se procesan como hoy (fail-closed si falta la clave).

### 5.3 Error handling (ADR 0007)

- **Validación fallida:** `DomainError('validation_failed', 'Validation failed', { key, ...flatten })`
  - El cliente puede identificar la clave culpable con `details.key`
- **Errores de sistema:** envelope estándar con `request_id`
- **Rate limiting:** 429 con envelope y `retry_after`

### 5.4 Rate limiting (B)

- Nuevo límite: `DEFAULT_WRITE_LIMIT = 30` requests/minuto
- Aplicado a ambas rutas (individual y de lote)
- Configurable vía settings en el futuro

## 6. Cambios en componentes

### 6.1 Core

- `packages/core/src/settings/service.ts`:
  - Nueva función `writeSettings(deps, caller, updates): Promise<SettingView[]>`
  - `writeSetting` delega en `writeSettings` con un solo elemento
- `packages/core/src/settings/api.ts`:
  - Nueva ruta `patchSettingsRoute`
  - Constante `DEFAULT_WRITE_LIMIT = 30`

### 6.2 Admin

- `apps/admin/src/app/api/v1/settings/route.ts`:
  - Implementa `PATCH` usando `patchSettingsRoute`
- `apps/admin/src/app/setup/preferences-step.tsx`:
  - Una sola llamada con todas las 12 actualizaciones
  - Maneja errores con `details.key` para señalizar el campo

## 7. Riesgos

- **Payload máximo:** 30 entradas limitan actualizaciones masivas (aceptable por diseño)
- **Secretos:** Nunca se exponen en logs ni respuestas (fail-closed)
- **Coherencia:** La validación `validateCoherence` aplica reglas entre claves del mismo lote
- **Compatibilidad:** La ruta individual sigue existente (no breaking change)

## 8. Criterios de aceptación

- **Bug resuelto:** El wizard completa las 12 actualizaciones en una petición (no 429)
- **Atomicidad:** Si una clave es inválida, ninguna se escribe
- **Atomicidad (regresión):** La ruta individual sigue funcionando como antes
- **Rate limiting:** Ambas rutas usan el nuevo límite de 30/min
- **Errores:** El cliente recibe `details.key` para señalizar el campo correcto
- **Tests:** Unitarios, integración y de cliente cubren todos los escenarios
- **Performance:** Una transacción para 30 claves es más eficiente que 30 peticiones

## 9. Referencias

- Spec de API del Core: `docs/superpowers/specs/2026-10-26-core-api.md`
- ADR 0007: `docs/adr/0007-manejo-de-errores.md`
- Rate limiting: `docs/superpowers/specs/2026-10-26-core-api.md#4-rate-limiting-decisión-c1`