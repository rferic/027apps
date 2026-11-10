# Flujo: rendimiento medible

Cómo se mide la latencia de la API y del panel, qué objetivos hay y cómo se demuestra una
mejora. Cualquier afirmación de «ahora va más rápido» sin esta tabla es una opinión.

- **Spec:** [`docs/superpowers/specs/2026-11-10-api-performance-design.md`](../superpowers/specs/2026-11-10-api-performance-design.md)
- **Plan:** [`docs/superpowers/plans/2026-11-10-api-performance.md`](../superpowers/plans/2026-11-10-api-performance.md)

## Objetivos

| Métrica | Objetivo |
|---|---|
| `/api/v1/*` TTFB p95 caliente | ≤ 400 ms |
| `/api/v1/*` TTFB p95 frío | ≤ 1,2 s |
| Páginas del panel TTFB p95 caliente | ≤ 300 ms |
| Landing (cuando exista) | TTFB ≤ 100 ms en caché, LCP ≤ 1,5 s, CLS ≤ 0,1 |
| Acción de panel (clic → feedback) p95 | ≤ 700 ms |

## Protocolo

1. **Caliente**: 2 peticiones de calentamiento y 10 medidas; se reportan p50 y p95 de
   `time_starttransfer`. Se descarta la primera.
2. **Frío**: primera petición tras ≥15 min sin tráfico o justo después de un deploy; se repite
   en 3 deploys.
3. **Autenticado**: cookie de una cuenta de prueba, nunca la del propietario.
4. **Acción**: pestaña Red con *Preserve log*; se cuenta el tiempo hasta el primer feedback
   visible, no hasta el último request, y el número de peticiones.
5. Se anota fecha, commit desplegado y región observada en `x-vercel-id`.

```bash
# Caliente (repetir 10 veces, ignorar la primera)
curl -s -o /dev/null -w '%{time_starttransfer}\n' https://027apps.ericrf.com/api/health

# Región de la función (segundo segmento)
curl -s -D - -o /dev/null https://027apps.ericrf.com/api/health | grep -i x-vercel-id
```

## Baseline — 2026-11-10, producción, commit `17d7a0b`

Funciones en `iad1`, Postgres en `eu-west-2`. Medido desde España.

| Ruta | Caliente | Frío |
|---|---|---|
| `/api/health` | 353–740 ms | 1,82 s |
| `/api/v1/instance` | 375–412 ms | 1,30 s |
| `/login` | 94–274 ms | 1,60 s |
| `/help/firebase` | 161–533 ms | — |

## Después — preview con `lhr1` (2026-11-10, commit `568489f`)

Medido sobre el preview `027apps-puctl9xwz-eric-rf.vercel.app`, que apunta a `027apps-dev`
(`eu-west-3`), con `vercel curl` (bypass de la protección). `x-vercel-id: fra1::lhr1::…`.

| Ruta | Caliente | Frío | Antes (prod, `iad1`) |
|---|---|---|---|
| `/api/health` | 147–297 ms | — | 353–740 ms |
| `/api/v1/instance` | 151–274 ms | ~590 ms | 375–412 ms |
| `/login` | 110–125 ms | ~510 ms | 94–274 ms |

**Pendiente**: repetir en producción tras el merge (mismo proyecto, `eu-west-2`) y con sesión
real para las rutas autenticadas. El preview no sustituye a esa medida: distinto proyecto
Supabase y tráfico de protección.

## Cambios aplicados

| Cambio | Estado | Evidencia |
|---|---|---|
| Funciones en `lhr1` (`apps/admin/vercel.json` + ajuste del proyecto) | desplegado en preview | `x-vercel-id: …::lhr1::…` |
| Una sola verificación de JWT por request de `/api/v1` (proxy → door) | implementado | test en `proxy.test.ts` + medida |
| `/api/health` con `select 1` en vez de la API admin de Auth | implementado | test en `lib/health.test.ts` + medida |
| Duplicados y cascadas del cliente | pendiente de captura del propietario | pestaña Red |

## Reglas

- No se cachean respuestas autenticadas.
- Una optimización no cambia contratos ni autorización; los tests existentes no se tocan para
  que pasen.
- Sin número antes/después no se declara mejora.
