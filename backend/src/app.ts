import cors from 'cors'
import express, { type Express } from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { getConfig, type AppConfig } from './config/env.js'
import { prisma } from './lib/prisma.js'
import { createErrorHandler, notFoundHandler } from './middleware/error-handler.js'
import { createRequestLogger } from './middleware/request-logger.js'
import { createAuthMiddleware } from './modules/auth/auth.middleware.js'
import { createAuthService } from './modules/auth/auth.service.js'
import type { AuthService } from './modules/auth/auth.types.js'
import { createProjectService } from './modules/projects/project.service.js'
import type { ProjectService } from './modules/projects/project.types.js'
import { createSupabaseStorageService } from './modules/storage/supabase-storage.service.js'
import type { StorageService } from './modules/storage/storage.types.js'
import { createAuthRouter } from './routes/auth.routes.js'
import { createHealthRouter } from './routes/health.routes.js'
import { createProjectRouter } from './routes/project.routes.js'
import type { Logger } from './types/logger.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

interface AppOptions {
  config?: Readonly<AppConfig>
  logger?: Logger
  authService?: AuthService
  storageService?: StorageService
  projectService?: ProjectService
}

export function createApp(options: AppOptions = {}): Express {
  const config = options.config || getConfig()
  const logger = options.logger || console
  const authService = options.authService || createAuthService(prisma, config)
  const storageService = options.storageService || createSupabaseStorageService(config)
  const projectService = options.projectService || createProjectService(prisma, storageService, config)
  const app = express()

  app.disable('x-powered-by')
  app.use(cors({
    origin: config.corsOrigin,
    credentials: config.corsOrigin !== '*',
  }))
  app.use(express.json({ limit: '1mb' }))
  app.use(createRequestLogger(logger))

  app.use('/api/health', createHealthRouter())
  app.use('/api/auth', createAuthRouter({ authService, config }))
  app.use(
    '/api/projects',
    createAuthMiddleware(authService, config.sessionCookieName),
    createProjectRouter({ projectService }),
  )

  if (config.nodeEnv === 'production') {
    const publicPath = path.join(__dirname, '..', 'public')
    app.use(express.static(publicPath))
    app.use((req, res, next) => {
      if (req.path.startsWith('/api')) return next()
      res.sendFile(path.join(publicPath, 'index.html'))
    })
  }

  app.use(notFoundHandler)
  app.use(createErrorHandler(logger))

  return app
}
