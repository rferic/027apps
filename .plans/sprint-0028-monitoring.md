# Sprint 28: Sistema de monitoreo (Vercel + Supabase)

**Rama:** `sprint/28-monitoring`
**Tareas:** TASK-225 a TASK-231 (continúa desde Sprint 27, última TASK-224)

---

## Resumen

Sistema extensible de monitoreo que permite conectar proveedores (Vercel, Supabase, etc.) mediante API tokens y mostrar gráficas de consumo en el dashboard del admin.

## Arquitectura

### Provider pattern

```
src/lib/monitoring/
├── types.ts          # Interfaces comunes (Metric, ProviderConfig, MonitoringProvider)
├── registry.ts        # Registro de proveedores
├── vercel.ts          # Provider: Vercel
├── supabase.ts        # Provider: Supabase
└── index.ts           # Exports públicos
```

Cada provider implementa:

```typescript
interface MonitoringProvider {
  id: string
  name: string
  icon: string
  fields: ConfigField[]     // Campos del formulario de config (token, etc.)
  validate(config): Promise<{ valid: boolean; error?: string }>
  fetchUsage(config): Promise<Metric[]>
}

interface Metric {
  key: string
  label: string
  used: number
  limit: number
  unit: string
  color?: string           // Color de la barra de progreso
}
```

### Almacenamiento

Los tokens se guardan en `app_settings` (tabla existente, misma que GitHub settings), con prefijo `monitoring_`:

| Key | Value | Secret |
|---|---|---|
| `monitoring_vercel_token` | `...` | ✅ |
| `monitoring_supabase_token` | `...` | ✅ |

### UI en admin

- **Sidebar:** Settings → "Monitoreo" (nuevo sub-item)
- **Config:** Formulario por provider (token + validar + guardar)
- **Dashboard:** Widgets que aparecen solo cuando el provider está configurado

---

## TASK-225: Core del sistema de monitoreo (types + registry)

Crear la base del sistema: tipos, registro de providers y lógica de almacenamiento.

**Archivos:**
- `src/lib/monitoring/types.ts` — interfaces `Metric`, `ProviderConfig`, `ConfigField`, `MonitoringProvider`
- `src/lib/monitoring/registry.ts` — registro de providers, función `getConfiguredProviders()`
- `src/lib/monitoring/index.ts` — re-exports

**Criterios de aceptación:**
- Las interfaces soportan cualquier proveedor futuro
- `ConfigField` soporta `type: 'password' | 'text'` y flag `secret`
- El registry permite registrar y listar providers

**Estimación:** M (3h)

---

## TASK-226: Provider Vercel

Implementar el provider para Vercel usando la API pública de Vercel.

**API Vercel:**
```
GET https://api.vercel.com/v1/observations/usage
Headers: Authorization: Bearer <VERCEL_TOKEN>
```

**Métricas a extraer:**
- Function invocations (usado / 100k)
- Execution duration (usado / 1000h)
- Bandwidth (usado / 100GB)
- Edge requests

**Campos de configuración:**
- `token` (password) — API token de Vercel (generado en vercel.com/account/tokens, permisos de solo lectura)

**Archivos:**
- `src/lib/monitoring/vercel.ts`
- Tests: `tests/unit/monitoring/vercel.test.ts`

**Criterios de aceptación:**
- Se conecta a la API de Vercel y devuelve métricas reales
- Token se guarda en `app_settings` con prefijo `monitoring_`
- Si el token es inválido, `validate()` devuelve error descriptivo

**Estimación:** M (3h)

---

## TASK-227: Provider Supabase

Implementar el provider para Supabase usando la Management API.

**API Supabase:**
```
GET https://api.supabase.com/v1/projects/zbwvvzeljiymwqcbemyy/usage
Headers: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
```

**Métricas a extraer:**
- Database size (usado / 500MB)
- Auth requests (usado / 50000/mes)
- Storage (usado / 1GB)
- Edge function invocations

**Campos de configuración:**
- `projectRef` (text) — Project reference (ej. `zbwvvzeljiymwqcbemyy`)
- `serviceRoleKey` (password) — Service role key

**Archivos:**
- `src/lib/monitoring/supabase.ts`
- Tests: `tests/unit/monitoring/supabase.test.ts`

**Criterios de aceptación:**
- Se conecta a Management API de Supabase
- Soporta cualquier project ref (no hardcodeado)
- Si las credenciales son inválidas, `validate()` devuelve error

**Estimación:** M (3h)

---

## TASK-228: Página de configuración en admin

Crear la página `/admin/settings/monitoring` con:

- Lista de providers disponibles (los del registry)
- Cada provider muestra: icono, nombre, estado (conectado/desconectado)
- Al hacer clic: formulario de configuración con los campos del provider
- Botón "Probar conexión" (llama a `validate()` del provider)
- Botón "Guardar" (persiste en `app_settings`)
- Botón "Desconectar" (elimina la config)

**Flujo:**

```
Admin → Settings → Monitoreo
  ├── Vercel       [● Conectado] → [Ver configuración]
  └── Supabase     [○ Desconectado] → [Configurar]
```

**Archivos:**
- `src/app/(admin)/[locale]/admin/settings/monitoring/page.tsx`
- `src/app/(admin)/[locale]/admin/settings/monitoring/actions.ts`
- Actualizar `sidebar.tsx` para añadir "Monitoreo" en sub-items de Settings
- Actualizar i18n (en.json con claves de monitoreo)

**Criterios de aceptación:**
- Sigue el patrón modal de formularios admin
- La conexión se prueba antes de guardar
- Los tokens se almacenan cifrados (usar `encryptSecret`/`decryptSecret` existente)

**Estimación:** L (5h)

---

## TASK-229: Widgets en el dashboard

Añadir widgets al dashboard del admin que muestren las métricas de los providers configurados.

**Layout del dashboard (sección nueva) — tabla resumen:**

```
┌──────────────────────────────────────────────────────────┐
│ Monitoreo                                                 │
│                                                           │
│ Provider   Recurso              Usado    Límite      %    │
│ ───────────────────────────────────────────────────────── │
│ Vercel     Invocaciones         42.3k    100k      42% 🟢│
│ Vercel     Tiempo ejecución      412h    1000h     41% 🟢│
│ Vercel     Ancho banda          3.2GB    100GB      3% 🟢│
│ Supabase   DB Size              120MB    500MB     24% 🟢│
│ Supabase   Auth requests        8.1k     50k       16% 🟢│
└──────────────────────────────────────────────────────────┘
```

**Comportamiento:**
- La tabla aparece solo si hay al menos un provider configurado
- Si no hay ningún provider configurado, la sección no se muestra
- Agrupado por provider (cabecera por grupo)
- Las métricas se actualizan al cargar la página (server-side, con caché de 5min)
- Colores según nivel de uso: verde 🟢 (<60%), amarillo 🟡 (60-85%), rojo 🔴 (>85%)

**Archivos:**
- `src/app/(admin)/[locale]/admin/dashboard/page.tsx` (añadir sección)
- `src/components/monitoring-table.tsx` (componente tabla reutilizable)

**Criterios de aceptación:**
- La tabla se renderiza en el mismo dashboard existente
- Al hacer clic en un provider, lleva a su página de configuración
- Caché de 5min para no sobrecargar las APIs externas

**Estimación:** M (4h)

---

## TASK-230: Tests

- Tests unitarios para cada provider (mockeando APIs externas)
- Tests de integración para la página de configuración
- Tests del dashboard (widgets se renderizan cuando hay datos)

**Estimación:** M (3h)

---

## TASK-231: Verificación frontend en preview

Ejecutar `@opencode test-frontend preview` y documentar resultados.

**Criterios de aceptación:**
- Health check: ✅
- Páginas SSR cargan sin error: ✅
- API autenticada responde: ✅
- Monitoreo configurable: ✅
- Dashboard muestra widgets: ✅
- Server-Timing headers presentes: ✅

**Estimación:** XS (30min)

---

## Resumen de esfuerzo

| TASK | Descripción | Estimación |
|---|---|---|
| 225 | Core del sistema (types + registry) | M (3h) |
| 226 | Provider Vercel | M (3h) |
| 227 | Provider Supabase | M (3h) |
| 228 | Página de configuración admin | L (5h) |
| 229 | Widgets en dashboard | M (4h) |
| 230 | Tests | M (3h) |
| 231 | Verificación frontend | XS (30min) |
| **Total** | | **~21.5h** |
