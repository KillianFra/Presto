import { Router, type NextFunction, type Request, type Response } from 'express'
import type { AppConfig } from '../config/env.js'
import { MaintenanceError } from '../modules/maintenance/maintenance.errors.js'
import type { MaintenanceService } from '../modules/maintenance/maintenance.types.js'

interface MaintenanceRouterOptions {
  maintenanceService: MaintenanceService
  config: Readonly<AppConfig>
}

function assertMaintenanceSecret(req: Request, config: Readonly<AppConfig>): void {
  if (!config.maintenanceSecret && config.nodeEnv === 'production') {
    throw new MaintenanceError(500, 'Maintenance secret is not configured')
  }

  if (config.maintenanceSecret && req.header('x-maintenance-secret') !== config.maintenanceSecret) {
    throw new MaintenanceError(401, 'Invalid maintenance secret')
  }
}

function handleMaintenanceError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof MaintenanceError) {
    res.status(error.statusCode).json({ error: { message: error.message } })
    return
  }

  next(error)
}

export function createMaintenanceRouter(options: MaintenanceRouterOptions): Router {
  const router = Router()
  const { maintenanceService, config } = options

  router.post('/purge-expired-assets', async (req, res, next) => {
    try {
      assertMaintenanceSecret(req, config)
      const result = await maintenanceService.purgeExpiredOriginalAssets()
      res.status(200).json(result)
    } catch (error) {
      handleMaintenanceError(error, res, next)
    }
  })

  return router
}
