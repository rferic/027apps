---
id: sprint-06-task-10
titulo: Documentación de la API
area: web
estado: finalizada
adrs: [0004, 0005, 0007]
plan: docs/superpowers/plans/2026-11-06-web-admin.md
spec: docs/superpowers/specs/2026-11-06-web-admin-design.md
---

**Alcance**: registro declarativo con `z.toJSONSchema()` de zod 4 (nativo; `zod-to-openapi` no soporta zod 4), `docs/api/openapi.json`, `GET /api/v1/openapi.json`, visor Scalar autoalojado, CI de paridad y de documento al día.

> Documento en **JSON**, no YAML: zod 4 emite JSON Schema nativamente y evitar un serializador YAML elimina una dependencia.

**TDD**: generación determinista, registro completo, página, checks.

**DoD**: igual, énfasis A03 y cadena de suministro.

## Informe de auditoría (2026-11-06)

**Veredicto: corregido.** Los hallazgos altos A1/A2 y los medios M3–M8 se han
subsanado con tests de regresión; el documento regenerado tiene **51
operaciones** y los gates de la tarea pasan. Queda deuda menor documentada más
abajo (no bloquea).

### Altos

- **A1 · `ErrorResponse.details` era un array en el contrato y un objeto en
  runtime.** `packages/core/src/openapi/schemas.ts` publica ahora
  `z.record(z.string(), z.json())` y el schema lleva
  `satisfies z.ZodType<ErrorEnvelope>`; para que el `code` también sea fiel,
  `errors.ts` exporta `DOMAIN_ERROR_CODES`. Test: acepta
  `{ formErrors, fieldErrors }` y rechaza un array. `docs/api/README.md`
  documenta el objeto real.
- **A2 · 42 operaciones declaraban solo `sessionAuth` y el door acepta JWT y
  API keys.** El registro distingue `public | session | session-only | key |
  service-key`. `session` emite `[{sessionAuth}, {apiKeyAuth}]`;
  `/setup/test-email` y `/maintenance/status` quedan `session-only`;
  `/maintenance/run`, `service-key`. `key` queda reservado porque ninguna ruta
  lo exige hoy. El test que fijaba longitud 1 se sustituye por la matriz de
  credenciales reales y por casos explícitos de cada modo.

### Medios

- **M3 · `POST /setup/test-email` sin body.** `setupTestEmailBodySchema` es
  `.optional()` además de estricto; un body con campos sigue dando 400. Test de
  POST sin body en `setup/api.test.ts`.
- **M4 · Respuestas 503/304.** El registro admite `responses` extra y
  `errorDefault: false`. `/health` documenta `503` con el schema `Health` y ya
  no publica el `default` engañoso; `/translations` documenta `304` sin body.
  Tests de ambos.
- **M5 · `requestBody.required` siempre `true`.** Se calcula con
  `!request.safeParse(undefined).success`: `moduleUninstall` y
  `maintenanceRun` quedan `required: false`; `setup/super-admin` sigue `true`.
- **M6 · Guía desalineada.** El banner pasa a «partial — 51 operations
  documented» y cada sección se reconcilia: paginación real
  `{users,total,active_total,limit,offset}` (sin `{data,meta}` ni cursor),
  `/me`, `/me/modules`, `modules/{key}/docs/*`, i18n de gestión,
  `admin-actions`/`audit`, idempotencia y MCP marcados **Previsto**. El
  catálogo de errores se ajusta a los códigos reales (fuera `not_a_member`;
  entran `cors_origin_not_allowed`, `payload_too_large`, `currency_is_default`).
- **M8 · `UserPatch` aceptaba `{}` en el documento.** Se añade
  `overrideComponent("UserPatch", { minProperties: 1 })`, que el generador
  fusiona en el componente. Test: el documento publica `minProperties: 1` y el
  schema de runtime rechaza `{}` (400).

### Lows aplicados

- Paridad: `scripts/check-openapi.mjs` reconoce `export const/let/var`,
  `export { GET }` y falla si un `route.ts` exporta 0 métodos.
- `tsx` pasa a `devDependencies` de `packages/core` (lockfile actualizado).
- El job `admin` de CI ejecuta `pnpm --filter @027apps/core test` (sustituye
  al test aislado del manifest, que queda incluido).
- `GET /api/v1/openapi.json`: `export const dynamic = "force-dynamic"`; se
  conserva `x-request-id` (respuesta uniforme del borde).
- Scalar: `hideClientButton`, `agent.disabled`, `mcp.disabled`,
  `showDeveloperTools: "never"` y `configuration` memoizada con `useMemo`.

### Deuda aceptada (no bloquea)

- **M7 · `$ref` anidados.** Un post-proceso de deduplicación no reduce el
  documento sin cambiar el registro de zod (los modelos anidados no coinciden
  con componentes existentes) y el refactor no es barato. Documento actual:
  **179 535 bytes** (~175 KB), **79** schemas en `components.schemas`. Se
  mantiene inline; queda como deuda de tamaño del contrato.
- **CSP enforcing.** Scalar inyecta estilos inline; pasar a
  `style-src` sin `'unsafe-inline'` exige nonces/hashes y revisar el visor.
- **Peso del visor.** Scalar se sirve local, pero su bundle es grande; medir y
  valorar carga diferida si afecta al panel.
- **Rate limit del endpoint `/openapi.json`.** Es público y cacheable, pero no
  tiene límite propio; evaluar si el borde general basta.
- **`info.version`.** Usa `CORE_VERSION` (`0.0.1`); falta una versión de
  contrato independiente de la del paquete.

### Verificación

```text
pnpm --filter @027apps/core test   → 20 files / 190 tests passed
pnpm --filter admin test           → 61 files / 397 tests passed
pnpm lint && pnpm tsc              → OK
pnpm check:openapi                 → 51 route operations, 51 documented, up to date
```
