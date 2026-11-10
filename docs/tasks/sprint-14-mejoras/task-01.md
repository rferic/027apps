---
id: sprint-14-task-01
titulo: Rendimiento medido de la API y del panel
area: rendimiento
estado: en curso
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
