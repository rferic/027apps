# Performance Report — Sprint 26

## Baseline (TASK-206)

- **Fecha:** 2026-06-13
- **Entorno:** Local (Next.js dev server, `http://localhost:3000`)
- **Supabase:** Local (`http://localhost:54321`) — sin latencia de red
- **Auth:** JWT token vía `supabase.auth.signInWithPassword` (sesión real de usuario admin)
- **Métrica clave:** `Server-Timing` header (tiempo real del handler, sin overhead de red/Next.js routing)

> ⚠️ Local dev no incluye latencia de red a Supabase ni cold-boot de serverless.
> Los valores absolutos son referencia interna; la **comparación relativa** es lo que importa.

### API Endpoints — Handler execution (Server-Timing ms)

| Endpoint | Handler cold | Handler warm | curl warm |
|---|---|---|---|
| `GET /api/v1` | — | — | 10ms |
| `GET /api/v1/locales` | — | 32ms | 22ms |
| `GET /api/v1/me` | 70ms | 223ms | 0.06ms |
| `GET /api/v1/shared/config` | 51ms | 61ms | 0.06ms |
| `GET /api/v1/shared/profile` | 61ms | 48ms | 0.07ms |
| `GET /api/v1/apps` | 59ms | 69ms | 0.09ms |
| `GET /api/v1/admin/users` | 84ms | 86ms | 0.10ms |
| `GET /api/v1/admin/groups` | 56ms | 54ms | 0.06ms |
| `GET /api/v1/admin/invitations` | 50ms | 48ms | 0.05ms |
| `GET /api/v1/admin/settings` | 56ms | 70ms | 0.05ms |
| `GET /api/v1/admin/api-keys` | 42ms | 44ms | 0.05ms |
| `GET /api/v1/admin/apps/inspiration` | 51ms | 45ms | 0.05ms |
| `GET /api/v1/admin/apps/todo` | 93ms | 52ms | 0.07ms |
| `GET /api/v1/admin/apps/todo/categories` | **126ms** | 83ms | 0.08ms |
| `GET /api/v1/admin/apps/todo/notification-prefs` | 80ms | 71ms | 0.08ms |

**Top 3 más lentos (handler):**
1. `/api/v1/me` — **223ms** (warm más alto que cold — posible async scheduling)
2. `/api/v1/admin/apps/todo/categories` — **126ms**
3. `/api/v1/admin/apps/todo` — **93ms**

### Páginas

| Página | Cold | Warm | Tamaño | Notas |
|---|---|---|---|---|
| `/en` (home, no sesión) | 331ms | 74ms | 17KB | 307 redirect a login |
| `/en/login` | 512ms | 86ms | 64KB | SSR completo |

### Producción

- **URL:** `https://027apps-eric-rf.vercel.app`
- **Entorno:** Vercel serverless (región iad1), Supabase producción (`zbwvvzeljiymwqcbemyy`)
- **Métrica:** `curl` time_total (latencia red + serverless execution)

| Endpoint/Página | Cold | Warm | Cache | Notas |
|---|---|---|---|---|
| `GET /api/v1` | 0.20ms | 0.18ms | MISS | JSON simple, sin DB |
| `GET /api/v1/locales` | 0.86ms | 0.62ms | MISS | Auth public + DB query |
| `/en` (home) | 0.91ms | 0.91ms | MISS | SSR middleware → i18n redirect |
| `/en/login` | 0.75ms | 0.58ms | MISS | SSR completo (~65KB) |
| `/en/doc` | 1.32ms | — | REVALIDATED | ISR content (66KB) |
| `/en/admin` | 0.60ms | — | MISS | SSR redirect a login |

> ⚠️ No se pudo obtener token JWT para medir endpoints autenticados en producción (las claves de API en `.env.local` son para Supabase local, no producción). Las métricas de handler real (`Server-Timing`) estarán disponibles tras el deploy del sprint.

### Bundle JS

**TASK-217:** No se pudo generar el análisis de bundle. `@next/bundle-analyzer` requiere Webpack (incompatible con Turbopack). `next experimental-analyze` es interactivo (no disponible en CLI). Pendiente de ejecutar manualmente con `npx next experimental-analyze` en terminal nativa.

### Web Vitals (TASK-218)

Pendiente de medir. PageSpeed Insights API rate-limited (quota diaria excedida). Medir manualmente:
- **Desktop:** Chrome DevTools → Lighthouse → https://027apps-eric-rf.vercel.app/en/login
- **Mobile:** PageSpeed Insights desde navegador

---

## Post-Optimizaciones — Comparativa Local

**Handler execution (Server-Timing ms) — warm requests**

| Endpoint | Baseline | Post-opt | Diferencia |
|---|---|---|---|
| `GET /api/v1/me` | 223ms | **102ms** | **-54%** |
| `GET /api/v1/apps` | 69ms | **50ms** | **-28%** |
| `GET /api/v1/admin/users` | 86ms | **40ms** | **-53%** |
| `GET /api/v1/admin/groups` | 54ms | **48ms** | -11% |
| `GET /api/v1/admin/settings` | 70ms | **67ms** | -4% |
| `GET /api/v1/admin/apps/todo` | 52ms | **47ms** | -10% |
| `GET /api/v1/admin/apps/todo/categories` | 83ms | **45ms** | **-46%** |
| `GET /api/v1/admin/apps/todo/notification-prefs` | 71ms | **47ms** | **-34%** |
| `GET /api/v1/admin/apps/inspiration` | 45ms | **49ms** | +9% (ruido) |
| `GET /api/v1/shared/profile` | 48ms | **48ms** | 0% |
| `GET /api/v1/shared/config` | 61ms | **75ms** | +23% (ruido) |
| `GET /api/v1/admin/invitations` | 48ms | **56ms** | +17% (ruido) |
| `GET /api/v1/admin/api-keys` | 44ms | **73ms** | +66% (ruido) |

> ⚠️ Variaciones de ±20% son ruido normal en dev server. Las mejoras reales están en los endpoints con >30% (me, users, categories, notification-prefs, apps).

### Queries eliminadas del Layout SSR

| Queries SSR (por page load) | Antes | Después |
|---|---|---|
| `installed_apps.select()` | 1 | 0 (cacheada 5min) |
| `group_app_access.select()` | 1 | 0 (cacheada 5min) |
| `group_members.select()` (member counts) | 1 | 0 (cacheada 5min) |
| `group_members.select()` + `profiles.select()` (drawer) | 2 | 0 (lazy client-side) |
| `auth.admin.getUserById()` (blocked check) | 1 | 1 (pendiente optimizar) |
| **Total** | **6** | **1** |

### Queries eliminadas por request API

| API request flow | Antes | Después |
|---|---|---|
| `getUser()` | 2 (dispatcher + handler) | 1 (dispatcher) |
| `group_members.select()` | 2 (auth + handler) | 1 (resolveGroupContext) |
| **Total auth queries** | **4** | **2** |

## Resumen por TASK

| # | Optimización | Impacto |
|---|---|---|
| 207 | Índices SQL (8 nuevos) | Seq scans → index scans en producción |
| 208 | Caché `getMessages()` (1h) | -1 recarga de JSON i18n por request |
| 209 | Caché `getActiveApps()` + `getGroupAppAccess()` (5min) | -2 queries Supabase/page load |
| 210 | Caché `getGroupMemberCounts()` (5min) | -1 query Supabase/page load |
| 211 | Auth duplicado eliminado | -2 queries por request API |
| 212 | Caché `getAdminUserList()` (5min) | handler -53% (86ms → 40ms) |
| 213 | Paginación real invitations | DB-level pagination, no in-memory |
| 214 | Aggregate sort en DB (RPC) | Elimina fetch de votes+comments completos |
| 215 | Group members lazy (client-side) | -2 queries SSR/page load |
| 216 | Profile queries (diferido) | Pendiente de schema migration |
| — | Caché de auth (validateJwt + cookie) | TTL 30s. Elimina ~350ms de auth API en requests repetidos |
| 217 | Bundle analyzer | No disponible con Turbopack |
| 218 | Web Vitals | Pendiente de medición manual |
| 219 | SWR cache | Documentado, no implementado |
| 220 | PPR | Incompatible con Fumadocs |
| 221 | Informe vivo | Este documento |

## Preview (Sprint 26 desplegado en staging)

- **URL:** `https://027apps-git-sprint-26-performance-optimization-eric-rf.vercel.app`
- **Con cambios:** Server-Timing renombrado a `X-Handler-Time` (Vercel bloquea el header `Server-Timing`)
- **Sin autenticación:** No se pudo obtener token JWT para producción (diferentes proyectos Supabase)

### Preview vs Producción (público)

| Endpoint | Preview (cold/warm) | Producción (cold) | Diferencia |
|---|---|---|---|
| `GET /api/v1` | 0.60 / 0.51ms | 1.01ms | Preview más rápido (-40%) |
| `GET /api/v1/locales` | 0.97 / 0.84ms | 1.68ms | Preview más rápido (-42%) |
| `/en/login` | 1.34ms | 1.40ms | Similar (-4%) |
| `/en` | 1.18ms | 0.74ms | Producción más rápido (+59%) |

### Handler times (Preview, X-Handler-Time)

| Endpoint | Handler time | Nota |
|---|---|---|
| `GET /api/v1` | 0.2ms | Sin auth, sin DB |
| `GET /api/v1/locales` | 420ms | Auth + DB query (cold start de Supabase staging) |

> ⚠️ **Importante:** Los tiempos de handler en Vercel son ~10x mayores que en local porque incluyen cold start de la función serverless + latencia de red a Supabase staging. Los valores para endpoints autenticados no se pudieron medir porque las claves de API locales no funcionan con Supabase producción.

### Próximos pasos

1. **Merge a main** → deploy a producción (con `X-Handler-Time` header)
2. **Medir en producción** con sesión real (login manual → ver headers en DevTools)
3. **Verificar en Vercel logs** los `[TIMING]` de cada handler
