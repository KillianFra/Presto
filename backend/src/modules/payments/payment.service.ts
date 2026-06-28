import { PaymentStatus, type PrismaClient } from '@prisma/client'
import type { AppConfig } from '../../config/env.js'
import type { CreditService } from '../credits/credit.types.js'
import { PaymentError } from './payment.errors.js'
import type { CheckoutSessionDto, PaymentService, PaymentWebhookInput, PaymentWebhookResultDto } from './payment.types.js'

function validatePositiveInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new PaymentError(400, `${field} must be a positive integer`)
  }

  return value
}

export function createPaymentService(
  prisma: PrismaClient,
  creditService: CreditService,
  config: Readonly<AppConfig>,
): PaymentService {
  return {
    async createCheckoutSession(userId: string, creditsInput?: number, amountCentsInput?: number): Promise<CheckoutSessionDto> {
      const credits = validatePositiveInteger(creditsInput ?? config.defaultCreditPackCredits, 'credits')
      const amountCents = validatePositiveInteger(
        amountCentsInput ?? config.defaultCreditPackAmountCents,
        'amountCents',
      )
      const payment = await prisma.payment.create({
        data: {
          userId,
          credits,
          amountCents,
          checkoutUrl: 'pending',
        },
      })
      const stripeCheckoutSessionId = `cs_mock_${payment.id}`
      const checkoutUrl = `${config.stripeCheckoutBaseUrl}/${stripeCheckoutSessionId}`
      const updatedPayment = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          checkoutUrl,
          stripeCheckoutSessionId,
        },
      })

      return {
        paymentId: updatedPayment.id,
        checkoutUrl,
        status: updatedPayment.status,
        credits,
        amountCents,
      }
    },

    async handleWebhook(input: PaymentWebhookInput): Promise<PaymentWebhookResultDto> {
      if (input.type !== 'checkout.session.completed') {
        throw new PaymentError(400, 'Unsupported payment webhook type')
      }

      const payment = await prisma.payment.findUnique({
        where: { stripeCheckoutSessionId: input.checkoutSessionId },
      })

      if (!payment) {
        throw new PaymentError(404, 'Payment not found')
      }

      if (payment.status === PaymentStatus.SUCCEEDED) {
        return {
          paymentId: payment.id,
          status: payment.status,
          credited: false,
        }
      }

      if (payment.stripeEventId && payment.stripeEventId !== input.eventId) {
        throw new PaymentError(409, 'Payment already handled by another event')
      }

      const updatedPayment = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.SUCCEEDED,
          stripeEventId: input.eventId,
        },
      })

      await creditService.addCredits(
        payment.userId,
        payment.credits,
        'Stripe checkout completed',
        payment.id,
      )

      return {
        paymentId: updatedPayment.id,
        status: updatedPayment.status,
        credited: true,
      }
    },
  }
}
