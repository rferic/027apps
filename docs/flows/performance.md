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

## Después — producción con `lhr1` (2026-11-10, commit `5c05c4f`)

Medido con `curl` desde España contra `https://027apps.ericrf.com`, 6 peticiones seguidas por
ruta (caliente) y verificando la región con `x-vercel-id: fra1::lhr1::…`.

| Ruta | Antes (`iad1`) | Después (`lhr1`) | Cambio |
|---|---|---|---|
| `/api/health` | 353–740 ms | **135–401 ms** | ~2× |
| `/api/v1/instance` | 375–412 ms | **132–272 ms** | ~2× |
| `/login` | 94–274 ms | **87–145 ms** | ~1,5× |

Objetivo de API caliente (p95 ≤ 400 ms) cumplido en producción. `/api/health` responde `200`
`{"status":"ok"}` con la base de producción. **Pendiente**: medida en frío tras ≥15 min sin
tráfico y rutas autenticadas (requieren una sesión de prueba).

## Auditoría del cliente: sin duplicados (2026-11-10)

Reproducido en local con un usuario de prueba y Chrome headless (CDP), sobre el mismo código:

- Carga completa de `/members`: **1 petición de documento** (209 ms en caliente, dev).
- Clic de fila al detalle: **1 fetch RSC** (`?_rsc=…`), sin peticiones de datos duplicadas.
- Único duplicado observado: un chunk `_next/static/…js` pedido dos veces (200 y 304) en dev.
  No es una petición de datos y en producción el cliente lo deduplica; se vigila.

Conclusión: la lentitud percibida **no** viene de peticiones duplicadas en el navegador. Viene
del trabajo del servidor por render (verificaciones de JWT y viajes a la base), que es lo que
se ha reducido de 4 a 1 verificación.

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
| Funciones en `lhr1` (`apps/admin/vercel.json` + ajuste del proyecto) | **en producción** | `x-vercel-id: …::lhr1::…` |
| Una sola verificación de JWT por request de `/api/v1` (proxy → door) | implementado | test en `proxy.test.ts` + medida |
| `/api/health` con `select 1` en vez de la API admin de Auth | implementado | test en `lib/health.test.ts` + medida |
| Cascada del servidor: 4 verificaciones de JWT → 1 por render | implementado | `proxy.test.ts` + inventario de arriba |
| Duplicados y cascadas del cliente | auditado: no hay duplicados de datos | captura CDP local |

## Reglas

- No se cachean respuestas autenticadas.
- Una optimización no cambia contratos ni autorización; los tests existentes no se tocan para
  que pasen.
- Sin número antes/después no se declara mejora.
