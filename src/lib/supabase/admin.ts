import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

const SLOW_QUERY_MS = 200
const LOG_SLOW = process.env.NODE_ENV !== 'production' || process.env.LOG_SLOW_QUERIES === '1'

function logSlow<T>(table: string, method: string, start: number): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve: (v: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return {
    promise,
    resolve: (v: T) => {
      const elapsed = performance.now() - start
      if (LOG_SLOW && elapsed > SLOW_QUERY_MS) {
        console.warn(`[SLOW QUERY] ${table}.${method} — ${elapsed.toFixed(0)}ms`)
      }
      resolve(v)
    },
  }
}

function withSlowLog<T extends object>(client: T): T {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === 'from') {
        const from = Reflect.get(target, prop, receiver) as (table: string) => object
        return (table: string) => {
          const builder = from.call(target, table)
          return new Proxy(builder as object, {
            get(bTarget, bProp) {
              const bVal = Reflect.get(bTarget, bProp, bTarget)
              if (typeof bVal !== 'function') return bVal
              return (...args: unknown[]) => {
                const result = bVal.apply(bTarget, args)
                if (result && typeof result.then === 'function' && typeof result.finally === 'function') {
                  const start = performance.now()
                  const { promise, resolve } = logSlow(table, String(bProp), start)
                  result.then(resolve, resolve)
                  return promise
                }
                return result
              }
            },
          })
        }
      }
      return Reflect.get(target, prop, receiver)
    },
  })
}

function createAdminClientBase<DB>() {
  return createClient<DB>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export function createAdminClient() {
  return withSlowLog(createAdminClientBase<Database>())
}

export function createAdminClientUntyped() {
  return withSlowLog(createAdminClientBase())
}
