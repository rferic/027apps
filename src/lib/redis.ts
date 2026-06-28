import { Redis } from '@upstash/redis'

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

let _redis: Redis | null = null

function getRedis(): Redis | null {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null
  if (!_redis) {
    _redis = new Redis({ url: UPSTASH_URL, token: UPSTASH_TOKEN })
  }
  return _redis
}

export const cache = {
  async get<T = string>(key: string): Promise<T | null> {
    const redis = getRedis()
    if (!redis) return null
    try {
      const val = await redis.get<T>(key)
      return val ?? null
    } catch (err) {
      console.warn('[Redis] get failed:', key, err)
      return null
    }
  },

  async set<T = string>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const redis = getRedis()
    if (!redis) return
    try {
      await redis.set(key, value, { ex: ttlSeconds })
    } catch (err) {
      console.warn('[Redis] set failed:', key, err)
    }
  },

  async del(key: string): Promise<void> {
    const redis = getRedis()
    if (!redis) return
    try {
      await redis.del(key)
    } catch (err) {
      console.warn('[Redis] del failed:', key, err)
    }
  },

  available(): boolean {
    return getRedis() !== null
  },
}
