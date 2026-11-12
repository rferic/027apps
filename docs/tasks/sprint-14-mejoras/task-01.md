---
id: sprint-14-task-01
titulo: Rendimiento medido de la API y del panel
area: rendimiento
estado: test
plan: docs/superpowers/plans/2026-11-10-api-performance.md
fuente: docs/superpowers/specs/2026-11-10-api-performance-design.md
adrs: [0004, 0007]
---

**Tarea**: medir el baseline real, fijar el método repetible y corregir la latencia de
`/api/v1` y de las páginas del panel, incluyendo llamadas duplicadas y cascadas.

**Origen**: el propietario percibe lentitud al actuar en el panel. La medición del 2026-11-10
confirmó dos causas principales: las funciones corren en `iad1` mientras Postgres está en
`eu-west-2`, y cada request autenticado a `/api/v1` verifica el JWT dos veces (proxy + door).

**Alcance**
- Dentro: `docs/flows/performance.md` con protocolo y baseline; región de funciones en `lhr1`;
  una sola verificación de sesión por request de API; `/api/health` barato; auditoría de
  duplicados en tres acciones del panel; revisión de bundle/cold start; N+1 en listados si la
  medición lo justifica.
- Fuera: cambiar de plan, reescribir el stack, cachear respuestas autenticadas, cambiar
  contratos de API.

**Criterios de aceptación** (detalle en la spec §4 y §8):
- p95 de `/api/v1` ≤ 400 ms caliente y ≤ 1,2 s frío, medido con el protocolo de la spec.
- `x-vercel-id` muestra `lhr1` como región de función.
- Un request autenticado hace una sola verificación de JWT.
- Informe de peticiones por acción (antes/después) para crear invitación, activar módulo y
  guardar ajustes.
- Tests existentes en verde sin modificarlos para que pasen; CI del PR en verde.

**Puertas de usuario**: ninguna credencial nueva. El cambio de región es configuración de
Vercel; se verifica en staging antes de producción.

**Riesgos**: el refresco de sesión al tocar el proxy; `lhr1` no disponible en Hobby; ruido en
las medidas. Mitigaciones en la spec §9.

## Ejecución (2026-11-10) — primera entrega

- **Baseline** registrado en [`docs/flows/performance.md`](../../flows/performance.md) con el
  commit `17d7a0b` y las rutas medibles sin sesión.
- **L1 región**: `apps/admin/vercel.json` con `regions: ["lhr1"]`; el proyecto de Vercel se
  actualizó a `serverlessFunctionRegion: lhr1` (verificado por API). Pendiente desplegar y
  medir.
- **L2 sesión**: `proxy.ts` ya no llama a `auth.getUser()` en `/api/v1`; solo `getSession()`
  para reenviar el token, y el *door* sigue verificando el JWT. Tests nuevos en
  `proxy.test.ts` (no `getUser`, bearer reenviado, panel sin cambios).
- **L3 health**: `/api/health` hace `select 1` con un pool de `max: 1` y techo de 2 s, en vez
  de la API admin de Auth. Tests en `lib/health.test.ts` (ok, error, sin conexión, timeout,
  `no-store`).
- **Verificación local**: `pnpm lint`, `pnpm tsc`, `pnpm --filter admin test` (1092) y
  `pnpm --filter admin build` en verde. `db-tests` requiere un stack Supabase limpio (el local
  acumula usuarios de Auth de ejecuciones previas); el diff no toca `packages/` ni
  `supabase/`, así que su resultado es idéntico al de `main` y CI lo ejecuta sobre un stack
  recién arrancado.
- **Pendiente**: desplegar y rellenar la tabla «después»; L4 (captura de red del propietario
  para las tres acciones), L5 y L6.

### Medición del preview (2026-11-10)

Preview `027apps-puctl9xwz-eric-rf.vercel.app` (commit `568489f`, `027apps-dev` en `eu-west-3`),
`x-vercel-id: fra1::lhr1::…`:

| Ruta | Caliente | Frío | Antes (prod, `iad1`) |
|---|---|---|---|
| `/api/health` | 147–297 ms | — | 353–740 ms |
| `/api/v1/instance` | 151–274 ms | ~590 ms | 375–412 ms |
| `/login` | 110–125 ms | ~510 ms | 94–274 ms |

Objetivo de API (p95 ≤ 400 ms caliente) cumplido en el preview. Falta la medida en producción
tras el merge y las rutas autenticadas con una sesión de prueba.

### Segunda entrega: cascada del servidor

Auditado el render de `/members`: 4 verificaciones del mismo JWT (proxy, layout y las dos
rutas Core en proceso) y 7–9 viajes a la base. Aplicado:

- El proxy solo verifica en las tres páginas gated (`/`, `/setup`, `/login`); en el resto
  refresca la cookie sin red.
- El *door* resuelve el llamante una vez por credencial y request (`cache()` de React), así
  que `loadCategories` y `loadMembers` no repiten la verificación.

Queda 1 verificación por render. Pendiente de medir con sesión real.

### Producción (2026-11-10)

Promoción a producción vía #80 (merge `5c05c4f`). `x-vercel-id: fra1::lhr1::…` en
`027apps.ericrf.com`.

| Ruta | Antes (`iad1`) | Después (`lhr1`) |
|---|---|---|
| `/api/health` | 353–740 ms | 135–401 ms |
| `/api/v1/instance` | 375–412 ms | 132–272 ms |
| `/login` | 94–274 ms | 87–145 ms |

Auditoría del cliente con Chrome headless y un usuario de prueba: una sola petición de
documento por página y un solo fetch RSC al navegar al detalle; **no hay peticiones de datos
duplicadas**. La causa era el trabajo del servidor.

Pendiente: frío real (≥15 min sin tráfico), rutas autenticadas, L5 (bundle/cold start) y L6
(consultas).

## Auditoría (2026-11-12)

Segundo agente: **APTO CON RESERVAS**. No hay bypass de autenticación; el proxy usa
`getSession` y el door verifica el JWT, la caché de React está aislada por request y `/api/health`
no filtra información. Hallazgo bajo corregido: `probeDatabase` descarta la conexión
(`release(true)`) si la query falla o vence el timeout, con test. Queda pendiente la medición en
frío, las rutas autenticadas y L5/L6; por eso la tarea sigue en `test`. La medición en frío y
autenticada se completa en la fase de cierre con el protocolo de `docs/flows/performance.md`.
