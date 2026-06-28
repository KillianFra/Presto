import cors from 'cors'
import express, { type Express } from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { getConfig, type AppConfig } from './config/env.js'
import { prisma } from './lib/prisma.js'
import { createErrorHandler, notFoundHandler } from './middleware/error-handler.js'
import { createRateLimitMiddleware } from './middleware/rate-limit.js'
import { createRequestLogger } from './middleware/request-logger.js'
import { createMockAiProvider } from './modules/ai/mock-ai.provider.js'
import type { AiProvider } from './modules/ai/ai.types.js'
import { createAuthMiddleware } from './modules/auth/auth.middleware.js'
import { createAuthService } from './modules/auth/auth.service.js'
import type { AuthService } from './modules/auth/auth.types.js'
import { createCreditService } from './modules/credits/credit.service.js'
import type { CreditService } from './modules/credits/credit.types.js'
import { createProjectEventService } from './modules/events/project-events.service.js'
import type { ProjectEventService } from './modules/events/project-events.service.js'
import { createMaintenanceService } from './modules/maintenance/maintenance.service.js'
import type { MaintenanceService } from './modules/maintenance/maintenance.types.js'
import { createPaymentService } from './modules/payments/payment.service.js'
import type { PaymentService } from './modules/payments/payment.types.js'
import { createProjectService } from './modules/projects/project.service.js'
import type { ProjectService } from './modules/projects/project.types.js'
import { createSupabaseStorageService } from './modules/storage/supabase-storage.service.js'
import type { StorageService } from './modules/storage/storage.types.js'
import { createTransformationService } from './modules/transformations/transformation.service.js'
import type { TransformationService } from './modules/transformations/transformation.types.js'
import { createAuthRouter } from './routes/auth.routes.js'
import { createCreditRouter } from './routes/credit.routes.js'
import { createHealthRouter } from './routes/health.routes.js'
import { createMaintenanceRouter } from './routes/maintenance.routes.js'
import { createPaymentRouter } from './routes/payment.routes.js'
import { createProjectEventsRouter } from './routes/project-events.routes.js'
import { createProjectRouter } from './routes/project.routes.js'
import { createTransformationRouter } from './routes/transformation.routes.js'
import type { Logger } from './types/logger.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

interface AppOptions {
  config?: Readonly<AppConfig>
  logger?: Logger
  authService?: AuthService
  storageService?: StorageService
  projectService?: ProjectService
  aiProvider?: AiProvider
  creditService?: CreditService
  eventService?: ProjectEventService
  transformationService?: TransformationService
  paymentService?: PaymentService
  maintenanceService?: MaintenanceService
}

export function createApp(options: AppOptions = {}): Express {
  const config = options.config || getConfig()
  const logger = options.logger || console
  const authService = options.authService || createAuthService(prisma, config)
  const storageService = options.storageService || createSupabaseStorageService(config)
  const projectService = options.projectService || createProjectService(prisma, storageService, config)
  const eventService = options.eventService || createProjectEventService(prisma)
  const creditService = options.creditService || createCreditService(prisma)
  const aiProvider = options.aiProvider || createMockAiProvider(config)
  const transformationService = options.transformationService || createTransformationService(
    prisma,
    aiProvider,
    creditService,
    eventService,
    config,
  )
  const paymentService = options.paymentService || createPaymentService(prisma, creditService, config)
  const maintenanceService = options.maintenanceService || createMaintenanceService(prisma)
  const authMiddleware = createAuthMiddleware(authService, config.sessionCookieName)
  const app = express()

  app.disable('x-powered-by')
  app.use(cors({
    origin: config.corsOrigin,
    credentials: config.corsOrigin !== '*',
  }))
  app.use(express.json({ limit: '1mb' }))
  app.use(createRequestLogger(logger))
  app.use('/api', createRateLimitMiddleware(config))

  app.use('/api/health', createHealthRouter())
  app.use('/api/auth', createAuthRouter({ authService, config }))
  app.use('/api/payments', createPaymentRouter({ paymentService, config, authMiddleware }))
  app.use(
    '/api/projects',
    authMiddleware,
    createProjectRouter({ projectService }),
  )
  app.use('/api/projects', authMiddleware, createProjectEventsRouter({ projectService, eventService }))
  app.use('/api/projects', authMiddleware, createTransformationRouter({ transformationService }))
  app.use('/api/credits', authMiddleware, createCreditRouter({ creditService }))
  app.use('/api/maintenance', createMaintenanceRouter({ maintenanceService, config }))

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
