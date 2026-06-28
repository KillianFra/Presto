import type { CreditTransactionType } from '@prisma/client'

export interface CreditWalletDto {
  balance: number
  updatedAt: string
}

export interface CreditTransactionDto {
  id: string
  type: CreditTransactionType
  amount: number
  balanceAfter: number
  reason: string
  createdAt: string
}

export interface CreditLedgerDto {
  wallet: CreditWalletDto
  transactions: CreditTransactionDto[]
}

export interface CreditService {
  getLedger(userId: string): Promise<CreditLedgerDto>
  addCredits(userId: string, amount: number, reason: string, paymentId?: string): Promise<CreditWalletDto>
  consumeCredits(userId: string, amount: number, reason: string, transformationId: string): Promise<CreditWalletDto>
}
