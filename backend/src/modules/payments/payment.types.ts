import type { PaymentStatus } from '@prisma/client'

export interface CheckoutSessionDto {
  paymentId: string
  checkoutUrl: string
  status: PaymentStatus
  credits: number
  amountCents: number
}

export interface PaymentWebhookInput {
  eventId: string
  type: string
  checkoutSessionId: string
}

export interface PaymentWebhookResultDto {
  paymentId: string
  status: PaymentStatus
  credited: boolean
}

export interface PaymentService {
  createCheckoutSession(userId: string, credits?: number, amountCents?: number): Promise<CheckoutSessionDto>
  handleWebhook(input: PaymentWebhookInput): Promise<PaymentWebhookResultDto>
}
