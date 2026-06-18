import cors from 'cors'
import express, { type Express } from 'express'
import { getConfig, type AppConfig } from './config/env.js'
import { createErrorHandler, notFoundHandler } from './middleware/error-handler.js'
import { createRequestLogger } from './middleware/request-logger.js'
import { createHealthRouter } from './routes/health.routes.js'
import type { Logger } from './types/logger.js'

interface AppOptions {
  config?: Readonly<AppConfig>
  logger?: Logger
}

export function createApp(options: AppOptions = {}): Express {
  const config = options.config || getConfig()
  const logger = options.logger || console
  const app = express()

  app.disable('x-powered-by')
  app.use(cors({
    origin: config.corsOrigin,
    credentials: config.corsOrigin !== '*',
  }))
  app.use(express.json({ limit: '1mb' }))
  app.use(createRequestLogger(logger))

  app.use('/api/health', createHealthRouter())

  app.use(notFoundHandler)
  app.use(createErrorHandler(logger))

  return app
}
