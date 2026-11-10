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

## Cascada de `/members` (auditoría de código, 2026-11-10)

Un render del listado de miembros hacía, en secuencia:

1. `proxy.ts` → `auth.getUser()` (red a Supabase Auth).
2. Layout → `requirePanel` → `auth.getUser()` **otra vez** (misma sesión).
3. `profiles` (rol y nombre) — 1 consulta.
4. `translations` del locale — 1 consulta.
5. `settings` públicos — 1 consulta.
6. `loadCategories()` → ruta Core en proceso → *door* → `getUser()` **otra vez** + rate-limit + consulta.
7. `loadMembers()` → ruta Core en proceso → *door* → `getUser()` **otra vez** + rate-limit + usuarios + conteos + emails de `auth.users`.

Total: **4 verificaciones del mismo JWT y 7–9 viajes a la base** por página. Con funciones en
`iad1` y la base en `eu-west-2`, cada viaje pagaba el Atlántico: de ahí la sensación de
«tarda un poco» con pocos datos.

Aplicado en esta entrega: el proxy ya no verifica en páginas no gated (solo refresca la
cookie) y el *door* comparte una única resolución por credencial y request (`cache()`), así
que las rutas en proceso dejan de repetir la verificación. Queda **1 verificación** por
render. Siguiente candidato: cachear `settings`/`translations` entre requests y no aplicar
rate-limit a llamadas en proceso.

## Cambios aplicados

| Cambio | Estado | Evidencia |
|---|---|---|
| Funciones en `lhr1` (`apps/admin/vercel.json` + ajuste del proyecto) | desplegado en preview | `x-vercel-id: …::lhr1::…` |
| Una sola verificación de JWT por request de `/api/v1` (proxy → door) | implementado | test en `proxy.test.ts` + medida |
| `/api/health` con `select 1` en vez de la API admin de Auth | implementado | test en `lib/health.test.ts` + medida |
| Cascada del servidor: 4 verificaciones de JWT → 1 por render | implementado | `proxy.test.ts` + inventario de arriba |
| Duplicados y cascadas del cliente | pendiente de captura del propietario | pestaña Red |

## Reglas

- No se cachean respuestas autenticadas.
- Una optimización no cambia contratos ni autorización; los tests existentes no se tocan para
  que pasen.
- Sin número antes/después no se declara mejora.
