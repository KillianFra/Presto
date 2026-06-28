import { CreditTransactionType, type PrismaClient } from '@prisma/client'
import { CreditError } from './credit.errors.js'
import type { CreditLedgerDto, CreditService, CreditTransactionDto, CreditWalletDto } from './credit.types.js'

function toWalletDto(wallet: { balance: number, updatedAt: Date }): CreditWalletDto {
  return {
    balance: wallet.balance,
    updatedAt: wallet.updatedAt.toISOString(),
  }
}

function toTransactionDto(transaction: {
  id: string
  type: CreditTransactionType
  amount: number
  balanceAfter: number
  reason: string
  createdAt: Date
}): CreditTransactionDto {
  return {
    id: transaction.id,
    type: transaction.type,
    amount: transaction.amount,
    balanceAfter: transaction.balanceAfter,
    reason: transaction.reason,
    createdAt: transaction.createdAt.toISOString(),
  }
}

function validateAmount(amount: number): number {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new CreditError(400, 'Credit amount must be a positive integer')
  }

  return amount
}

export function createCreditService(prisma: PrismaClient): CreditService {
  async function ensureWallet(userId: string) {
    return prisma.creditWallet.upsert({
      where: { userId },
      create: { userId },
      update: {},
    })
  }

  return {
    async getLedger(userId: string): Promise<CreditLedgerDto> {
      const wallet = await ensureWallet(userId)
      const transactions = await prisma.creditTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })

      return {
        wallet: toWalletDto(wallet),
        transactions: transactions.map(toTransactionDto),
      }
    },

    async addCredits(userId: string, amountInput: number, reason: string, paymentId?: string): Promise<CreditWalletDto> {
      const amount = validateAmount(amountInput)

      const wallet = await prisma.$transaction(async (tx) => {
        const currentWallet = await tx.creditWallet.upsert({
          where: { userId },
          create: { userId, balance: amount },
          update: { balance: { increment: amount } },
        })

        await tx.creditTransaction.create({
          data: {
            userId,
            walletId: currentWallet.id,
            paymentId,
            type: CreditTransactionType.PURCHASE,
            amount,
            balanceAfter: currentWallet.balance,
            reason,
          },
        })

        return currentWallet
      })

      return toWalletDto(wallet)
    },

    async consumeCredits(
      userId: string,
      amountInput: number,
      reason: string,
      transformationId: string,
    ): Promise<CreditWalletDto> {
      const amount = validateAmount(amountInput)

      const wallet = await prisma.$transaction(async (tx) => {
        const currentWallet = await tx.creditWallet.upsert({
          where: { userId },
          create: { userId, balance: 0 },
          update: {},
        })

        if (currentWallet.balance < amount) {
          throw new CreditError(402, 'Insufficient credits')
        }

        const updatedWallet = await tx.creditWallet.update({
          where: { id: currentWallet.id },
          data: { balance: { decrement: amount } },
        })

        await tx.creditTransaction.create({
          data: {
            userId,
            walletId: updatedWallet.id,
            transformationId,
            type: CreditTransactionType.CONSUMPTION,
            amount: -amount,
            balanceAfter: updatedWallet.balance,
            reason,
          },
        })

        return updatedWallet
      })

      return toWalletDto(wallet)
    },
  }
}
