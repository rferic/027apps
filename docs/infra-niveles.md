# Infraestructura 027Apps — Niveles y mejoras

## Estado actual (Free tier)

| Componente | Qué usamos | Límite | Riesgo |
|---|---|---|---|
| **Vercel** | Hobby | 10s timeout, 100GB bandwidth | Timeout en notificaciones con >50 usuarios |
| **Supabase** | Free | 500MB DB, 2GB bandwidth, ~20 conexiones | Rate limit en `listUsers` y queries concurrentes |
| **Email** | SMTP + Resend | Según proveedor | SMTP sin pool puede saturarse |
| **Cache** | En memoria (Node.js) | Se pierde en cold start | Sin impacto real con poco tráfico |

## Mejoras incrementales

### Nivel 1 — Mínimo viable (0€/mes extra) ✅ IMPLEMENTADO

Cache en Redis gratuito (Upstash/Vercel KV) para `getUserEmailMap` y `getNotificationsConfig`.

```typescript
// src/lib/redis.ts — nuevo archivo
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const val = await redis.get<T>(key)
    return val ?? null
  },
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await redis.set(key, value, { ex: ttlSeconds })
  },
}
```

```typescript
// src/lib/use-cases/todo/notifications.tsx — getUserEmailMap con Redis
async function getUserEmailMap(userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const toFetch: string[] = []

  for (const id of userIds) {
    const cached = await cache.get<string>(`email:${id}`)
    if (cached) { map.set(id, cached); continue }
    toFetch.push(id)
  }

  if (toFetch.length === 0) return map

  const supabase = createAdminClientUntyped()
  // ... listUsers paginado igual que ahora ...
  for (const user of data.users) {
    if (targetSet.has(user.id) && user.email) {
      map.set(user.id, user.email)
      await cache.set(`email:${user.id}`, user.email, 3600) // 1h TTL
    }
  }

  return map
}
```

```typescript
// src/lib/settings/notifications.ts — getNotificationsConfig con Redis
export async function getNotificationsConfig(): Promise<NotificationsConfig> {
  const cached = await cache.get<NotificationsConfig>('notifications:config')
  if (cached) return cached

  const db = createAdminClientUntyped()
  const { data } = await db.from('notification_configs').select('*').maybeSingle()
  const config = data as NotificationsConfig
  await cache.set('notifications:config', config, 300) // 5 min TTL
  return config
}
```

**Coste**: 0€ (Upstash free: 10K comandos/día, 256MB)
**Beneficio**: Elimina queries DB redundantes en `getNotificationsConfig` y `getUserEmailMap`
**Requiere**: `npm i @upstash/redis` en el proyecto

---

### Nivel 2 — Delivery garantizado (15-25€/mes aprox)

Encola notificaciones en tabla `notification_queue` y un worker las drena.

#### 2a. Con Supabase Pro (25€/mes)

Usa `pg_cron` + `pg_net` (nativos de Supabase) para procesar la cola sin servidor externo.

```sql
-- supabase/migrations/XXXXXX_notification_queue.sql
CREATE TABLE IF NOT EXISTS notification_queue (
  id BIGSERIAL PRIMARY KEY,
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempts INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Worker: procesa cada 30 segundos
SELECT cron.schedule(
  'process-notification-queue',
  '30 seconds',
  $$
    SELECT net.http_post(
      url := current_setting('app.settings_api_url') || '/api/v1/internal/process-notifications',
      body := '{}'::jsonb
    );
  $$
);
```

```typescript
// src/lib/push/send.ts — encolar en vez de enviar directo
export async function sendPushNotifications(userIds: string[], payload: PushPayload): Promise<void> {
  const enabled = await shouldSendPush()
  if (!enabled) return
  if (userIds.length === 0) return

  const db = createAdminClientUntyped()
  await db.from('notification_queue').insert({
    payload: { userIds, ...payload },
    status: 'pending',
  })
}

// src/app/api/v1/internal/process-notifications/route.ts — worker endpoint
export async function POST() {
  const db = createAdminClientUntyped()
  const { data } = await db.from('notification_queue')
    .select('*')
    .eq('status', 'pending')
    .limit(50)

  for (const job of data ?? []) {
    await db.from('notification_queue').update({ status: 'processing' }).eq('id', job.id)
    try {
      await sendPushDirect(job.payload.userIds, job.payload)
      await db.from('notification_queue').update({ status: 'sent' }).eq('id', job.id)
    } catch (err) {
      await db.from('notification_queue')
        .update({ status: job.attempts >= 3 ? 'failed' : 'pending', attempts: job.attempts + 1 })
        .eq('id', job.id)
    }
  }

  return new Response(null, { status: 204 })
}
```

**Coste**: 25€/mes (Supabase Pro)
**Beneficio**: Delivery garantizado con reintentos. La API responde en <50ms (solo inserta en cola)
**Requiere**: Supabase Pro (pg_cron + pg_net)

#### 2b. Con Inngest (gratis hasta 10M steps/mes)

Alternativa a pg_cron si prefieres no tocar Supabase. Inngest es un sistema de background jobs serverless.

```typescript
// src/lib/inngest.ts
import { Inngest } from 'inngest'

export const inngest = new Inngest({ id: '027apps' })

export const processQueue = inngest.createFunction(
  { id: 'process-notification-queue' },
  { cron: '*/30 * * * * *' }, // cada 30 segundos
  async ({ step }) => {
    const jobs = await step.run('fetch-pending', async () => {
      const db = createAdminClientUntyped()
      const { data } = await db.from('notification_queue').select('*').eq('status', 'pending').limit(50)
      return data ?? []
    })

    for (const job of jobs) {
      await step.run(`send-${job.id}`, async () => {
        await sendPushDirect(job.payload.userIds, job.payload)
      })
    }
  },
)
```

**Coste**: 0€ (Inngest free tier: 10M steps/mes)
**Beneficio**: Igual que 2a, pero sin depender de Supabase Pro
**Requiere**: `npm i inngest` + cuenta gratuita en inngest.com

---

### Nivel 3 — Full observabilidad (0-19€/mes)

Si quieres saber cuántas notificaciones se envían, cuántas fallan, latencia, etc.

| Herramienta | Capa gratuita | Qué mide |
|---|---|---|
| **Axiom** | 0.5GB/mes | Logs + métricas de Vercel + Supabase |
| **Sentry** | 5K errors/mes | Errores en serverless functions |
| **OpenTelemetry** | 0€ (self-host) | Trazas distribuidas |

```typescript
// src/lib/telemetry.ts
import { trace } from '@opentelemetry/api'

const tracer = trace.getTracer('027apps')

export async function sendPushNotifications(userIds: string[], payload: PushPayload): Promise<void> {
  return tracer.startActiveSpan('sendPushNotifications', async (span) => {
    span.setAttributes({ userIdCount: userIds.length, type: payload.type })
    try {
      // ... lógica actual ...
      span.setStatus({ code: SpanStatusCode.OK })
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) })
      throw err
    } finally {
      span.end()
    }
  })
}
```

**Coste**: 0-19€/mes (según capa elegida)
**Beneficio**: Sabes exactamente qué pasa en producción sin mirar logs manualmente

---

## Resumen: qué añadir y cuándo

| Nivel | Cuándo | Coste | Cambios de código |
|---|---|---|---|
| **1 — Redis cache** | Ahora mismo (gratis) | 0€ | ~100 líneas |
| **2b — Inngest queue** | Cuando un email perdido duela | 0€ | ~150 líneas + migration |
| **2a — pg_cron queue** | Si ya tienes Supabase Pro | 25€/mes | ~150 líneas + migration |
| **3 — Observabilidad** | Cuando debugging manual sea lento | 0-19€/mes | ~50 líneas |

**Recomendación**: Implementar Nivel 1 ahora (es gratis, reduce queries DB). El resto solo cuando haya una métrica o incidencia que lo justifique.
