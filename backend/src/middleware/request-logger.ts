import type { RequestHandler } from 'express'
import type { Logger } from '../types/logger.js'

export function createRequestLogger(logger: Logger = console): RequestHandler {
  return (req, res, next) => {
    const startedAt = process.hrtime.bigint()

    res.on('finish', () => {
      const durationNs = process.hrtime.bigint() - startedAt

      logger.info({
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Number(durationNs) / 1_000_000,
      })
    })

    next()
  }
}
