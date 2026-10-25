# ADR 0007 — Manejo de errores: un modelo de error estable, sin fuga de internos

**Fecha:** 2026-10-25
**Estado:** Borrador para aprobación del usuario
**Decisora:** usuario (rferic), en conversación de diseño
**Base:** [ADR 0004](0004-bordes-y-capa-de-aplicacion.md) (puertas delgadas, zod en el borde, invariantes en el caso de uso, efectos externos tras el commit, representación compartida) · [ADR 0005](0005-estado-y-fetching-del-admin.md) (estados de error en el admin) · [DoD](../conventions/definition-of-done.md) (errores sin detalles internos, fallos explícitos)
**Resuelve:** el ítem «manejo de errores» del backlog de la [spec de diseño §11](../superpowers/specs/2026-10-24-027apps-design.md)

## Contexto

El sistema expone operaciones por varias puertas — la **API `/api/v1`** (móvil y terceros), **MCP** y **comandos** — que llaman a los mismos casos de uso (ADR 0004). Cada puerta valida forma con **zod en el borde** y los casos de uso lanzan **invariantes de dominio**. Los clientes (app móvil Kotlin, admin web) necesitan distinguir *qué* falló para traducir, reintentar o mostrar un estado, y el requisito OWASP del DoD exige **errores sin detalles internos**.

Sin una decisión, cada puerta formatearía los fallos a su manera (strings sueltos, status HTTP desnudos, stacks al cliente en dev), los clientes tendrían que adivinar, y se filtraría información interna (SQL, rutas, secrets) por el canal de errores.

## Decisión

Se adopta un **modelo de error único y estable en el borde**, con un **código máquina-legible** como contrato y un **message** de texto por defecto que los clientes traducen. El código es la fuente de verdad para la lógica del cliente (retry, i18n, tests); el texto es solo presentación.

1. **Envelope de error en toda puerta.** Toda respuesta de error usa la misma forma:

   ```json
   { "error": { "code": "validation_failed", "message": "…", "request_id": "…", "details": [ … ] } }
   ```

   - `code`: identificador estable, versionado, en `snake_case` (p. ej. `validation_failed`, `unauthorized`, `insufficient_scope`, `not_found`, `conflict`, `rate_limited`, `internal`). Cambiar un `code` es un breaking change del contrato.
   - `message`: texto por defecto, en inglés (la lingua franca técnica del código). **El servidor no localiza**: el cliente mapea `code` → texto por locale (flujo i18n, clave `error.<code>`).
   - `details`: **solo** errores de validación (lista de campos/reglas) o información no sensible que el cliente necesita; nunca internos.
   - `request_id`: id de correlación para soporte (ver 6).

2. **Taxonomía de errores en el dominio.** Los casos de uso lanzan **errores tipados de dominio con código** (jerarquía `DomainError`), nunca strings ni mensajes crudos. El borde los mapea al envelope:
   - **Validación de forma (zod, en el borde)** → `validation_failed`, con `details` de campos (el cliente los pinta en el formulario).
   - **Invariante de dominio (dentro del caso de uso)** → código específico (`invitation_expired`, `not_a_member`, `transfer_imbalance`, …), con su `message` por defecto. El caso de uso **no confía en que el borde validó** (ADR 0004 §3): un invariante que falle siempre tiene su código propio.

3. **Errores de autorización distintos y sin enumeración.** 401 (no autenticado) ≠ 403 (autenticado sin scope). Un 403 **no revela si el recurso existe** (no permite enumerar por el mensaje de error): mismo `message` genérico tenga o no el llamador permiso de verlo.

4. **Mapeo HTTP mínimo.** `400` (validación de forma), `401`, `403`, `404`, `409` (conflicto de estado), `429` (rate limit), `500` (inesperado). No se añaden códigos salvo que un caso lo justifique en la spec de API v1.

5. **Sin fuga de internos (OWASP A02/A05).** **Nunca** stack traces, SQL, rutas internas, secrets ni tokens en el envelope — ni siquiera en dev (superficie uniforme). Todo lo inesperado cae en `internal` genérico. Los detalles técnicos van solo al **log del servidor**, no a la respuesta. El `guard-secrets` del CI y la auditoría OWASP de cada tarea vigilan esto.

6. **Logging estructurado con correlación.** Cada error se loguea server-side con `request_id` (generado en la puerta), `code`, mensaje técnico (sin secrets) y stack. El cliente recibe el mismo `request_id` en el envelope para poder reportar. El `code` permite agrupar y medir (frecuencia por tipo de error).

7. **Efectos externos tras el commit (ADR 0004 §6).** Si un efecto externo (email, realtime) falla **después** del commit, **no** se revierte el dato ni se propaga como fallo de la mutación: el dato ya se salvó. Se loguea con severidad y queda para reintento/cola — el cliente recibe éxito, el operador ve el fallo en logs.

8. **Clientes.** El móvil mapea `code` → texto localizado y decide el comportamiento (retry con backoff en `429`/`5xx`; mostrar formulario en `validation_failed`). El admin usa el estado `error` de su librería (ADR 0005) y muestra el `message` traducido; `request_id` visible en el estado de error para soporte.

## Alternativas consideradas

- **RFC 9457 Problem Details:** descartado por ahora — estándar y útil para interop con terceros, pero sobrepeso (URI type, per-request `title`/`detail`) para el rango interno móvil + admin; nuestro envelope cubre lo que los clientes necesitan con un `code` estable. La **spec de API v1** puede reabrir esto si la superficie pública de terceros lo justifica, y traducir al envelope de manera transparente.
- **El servidor localiza el mensaje:** descartado — el servidor no conoce el locale del cliente, y mezclar presentación en la capa de error rompe el modelo `code` → i18n en cliente.
- **Status HTTP desnudo o strings sueltos:** descartado — los clientes necesitan un código estable para lógica, traducción y tests; el status solo no distingue `invitation_expired` de `not_a_member`.
- **Stack traces / detalles técnicos al cliente en dev:** descartado — la superficie de error debe ser uniforme en todos los entornos para que la app no dependa de "en dev sí se ve".
- **Códigos de error como constantes no versionadas:** descartado — el `code` es parte del contrato de API; su evolución sigue el versionado de la API v1.

## Consecuencias

- El Core tendrá un paquete compartido con la **jerarquía de errores de dominio** y el **mapeo a envelope** (el formato HTTP exacto de la respuesta lo fija la spec de API v1, que referencia este ADR).
- Los **tests de puerta** (ADR 0004 §46) verifican: envelope correcto por error, mapeo HTTP, y **ausencia de fuga de internos** (no contener SQL/stack/rutas en la respuesta).
- El `request_id` entra como requisito en logs y respuestas de error.
- El microcopy de errores se gestiona por el **flujo i18n** (claves `error.<code>`, locales es/ca/en/it).
- Los clientes (móvil, admin) implementan el mapeo `code` → texto/acción como patrón fijo, con su tarea de patrones UX del backlog.
