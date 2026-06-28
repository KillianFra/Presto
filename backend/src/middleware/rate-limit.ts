import type { RequestHandler } from 'express'
import type { AppConfig } from '../config/env.js'

interface RateLimitBucket {
  count: number
  resetAt: number
}

export function createRateLimitMiddleware(config: Readonly<AppConfig>): RequestHandler {
  const buckets = new Map<string, RateLimitBucket>()

  return (req, res, next) => {
    const now = Date.now()
    const key = req.ip || req.socket.remoteAddress || 'unknown'
    const bucket = buckets.get(key)

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, {
        count: 1,
        resetAt: now + config.rateLimitWindowMs,
      })
      next()
      return
    }

    bucket.count += 1

    if (bucket.count > config.rateLimitMaxRequests) {
      res.status(429).json({
        error: {
          message: 'Too many requests',
        },
      })
      return
    }

    next()
  }
}
