import { createHmac, timingSafeEqual } from 'node:crypto'
import { Router, type NextFunction, type Request, type RequestHandler, type Response } from 'express'
import type { AppConfig } from '../config/env.js'
import type { AuthUser } from '../modules/auth/auth.types.js'
import { PaymentError } from '../modules/payments/payment.errors.js'
import type { PaymentService } from '../modules/payments/payment.types.js'

interface PaymentRouterOptions {
  paymentService: PaymentService
  config: Readonly<AppConfig>
  authMiddleware: RequestHandler
}

function getAuthUser(req: Request): AuthUser {
  if (!req.authUser) {
    throw new PaymentError(500, 'Authenticated user is missing from request')
  }

  return req.authUser
}

function readBody(req: Request): Record<string, unknown> {
  return req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {}
}

function readOptionalNumberBody(req: Request, field: string): number | undefined {
  const value = readBody(req)[field]
  return typeof value === 'number' ? value : undefined
}

function readStringBody(req: Request, field: string): string {
  const value = readBody(req)[field]
  return typeof value === 'string' ? value : ''
}

function isValidWebhookSignature(req: Request, config: Readonly<AppConfig>): boolean {
  if (!config.stripeWebhookSecret) return true

  const signature = req.header('stripe-signature') || ''
  const expected = createHmac('sha256', config.stripeWebhookSecret)
    .update(JSON.stringify(req.body || {}))
    .digest('hex')
  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)

  return signatureBuffer.length === expectedBuffer.length && timingSafeEqual(signatureBuffer, expectedBuffer)
}

function handlePaymentError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof PaymentError) {
    res.status(error.statusCode).json({ error: { message: error.message } })
    return
  }

  next(error)
}

export function createPaymentRouter(options: PaymentRouterOptions): Router {
  const router = Router()
  const { paymentService, config, authMiddleware } = options

  router.post('/checkout', authMiddleware, async (req, res, next) => {
    try {
      const checkout = await paymentService.createCheckoutSession(
        getAuthUser(req).id,
        readOptionalNumberBody(req, 'credits'),
        readOptionalNumberBody(req, 'amountCents'),
      )
      res.status(201).json({ checkout })
    } catch (error) {
      handlePaymentError(error, res, next)
    }
  })

  router.post('/webhook', async (req, res, next) => {
    try {
      if (!isValidWebhookSignature(req, config)) {
        throw new PaymentError(401, 'Invalid payment webhook signature')
      }

      const result = await paymentService.handleWebhook({
        eventId: readStringBody(req, 'eventId'),
        type: readStringBody(req, 'type'),
        checkoutSessionId: readStringBody(req, 'checkoutSessionId'),
      })
      res.status(200).json({ result })
    } catch (error) {
      handlePaymentError(error, res, next)
    }
  })

  return router
}
