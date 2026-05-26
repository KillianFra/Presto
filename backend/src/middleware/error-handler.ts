import type { ErrorRequestHandler, RequestHandler } from 'express'
import type { Logger } from '../types/logger.js'

interface HttpError extends Error {
  status?: number
  statusCode?: number
  type?: string
}

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: {
      message: `Route ${req.method} ${req.originalUrl} not found`,
    },
  })
}

export function createErrorHandler(logger: Logger = console): ErrorRequestHandler {
  return (receivedError, req, res, next) => {
    if (res.headersSent) {
      next(receivedError)
      return
    }

    const error = receivedError as HttpError
    const statusCode = Number.isInteger(error.status)
      ? error.status as number
      : Number.isInteger(error.statusCode)
        ? error.statusCode as number
        : 500

    if (statusCode >= 500) {
      logger.error({
        error: error.message,
        method: req.method,
        path: req.originalUrl,
      })
    }

    const message = error.type === 'entity.parse.failed'
      ? 'Invalid JSON body'
      : statusCode >= 500
        ? 'Internal server error'
        : error.message

    res.status(statusCode).json({
      error: { message },
    })
  }
}
