import { Router, type NextFunction, type Request, type Response } from 'express'
import type { AuthUser } from '../modules/auth/auth.types.js'
import { CreditError } from '../modules/credits/credit.errors.js'
import type { CreditService } from '../modules/credits/credit.types.js'

interface CreditRouterOptions {
  creditService: CreditService
}

function getAuthUser(req: Request): AuthUser {
  if (!req.authUser) {
    throw new CreditError(500, 'Authenticated user is missing from request')
  }

  return req.authUser
}

function handleCreditError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof CreditError) {
    res.status(error.statusCode).json({ error: { message: error.message } })
    return
  }

  next(error)
}

export function createCreditRouter(options: CreditRouterOptions): Router {
  const router = Router()
  const { creditService } = options

  router.get('/', async (req, res, next) => {
    try {
      const ledger = await creditService.getLedger(getAuthUser(req).id)
      res.status(200).json(ledger)
    } catch (error) {
      handleCreditError(error, res, next)
    }
  })

  router.get('/transactions', async (req, res, next) => {
    try {
      const ledger = await creditService.getLedger(getAuthUser(req).id)
      res.status(200).json({ transactions: ledger.transactions })
    } catch (error) {
      handleCreditError(error, res, next)
    }
  })

  return router
}
