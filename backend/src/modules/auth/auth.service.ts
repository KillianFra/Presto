import { Prisma, type PrismaClient } from '@prisma/client'
import type { AppConfig } from '../../config/env.js'
import { AuthError } from './auth.errors.js'
import { hashPassword, verifyPassword } from './password.js'
import { createOpaqueToken, hashOpaqueToken } from './tokens.js'
import type {
  AuthService,
  AuthSessionResult,
  AuthUser,
  LoginInput,
  PasswordResetResult,
  RegisterInput,
} from './auth.types.js'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const minimumPasswordLength = 8

interface UserRecord {
  id: string
  email: string
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function validateEmail(email: string): void {
  if (!emailPattern.test(email)) {
    throw new AuthError(400, 'A valid email is required')
  }
}

function validatePassword(password: string): void {
  if (password.length < minimumPasswordLength) {
    throw new AuthError(400, `Password must contain at least ${minimumPasswordLength} characters`)
  }
}

function toAuthUser(user: UserRecord): AuthUser {
  return {
    id: user.id,
    email: user.email,
  }
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000)
}

export function createAuthService(
  prisma: PrismaClient,
  config: Readonly<AppConfig>,
): AuthService {
  async function createSession(user: UserRecord): Promise<AuthSessionResult> {
    const token = createOpaqueToken()
    const expiresAt = addDays(new Date(), config.sessionTtlDays)

    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: hashOpaqueToken(token),
        expiresAt,
      },
    })

    return {
      user: toAuthUser(user),
      token,
      expiresAt,
    }
  }

  return {
    async register(input: RegisterInput): Promise<AuthSessionResult> {
      const email = normalizeEmail(input.email)
      validateEmail(email)
      validatePassword(input.password)

      try {
        const user = await prisma.user.create({
          data: {
            email,
            passwordHash: await hashPassword(input.password),
          },
          select: {
            id: true,
            email: true,
          },
        })

        return createSession(user)
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new AuthError(409, 'Email is already registered')
        }

        throw error
      }
    },

    async login(input: LoginInput): Promise<AuthSessionResult> {
      const email = normalizeEmail(input.email)
      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          passwordHash: true,
        },
      })

      if (!user || !await verifyPassword(input.password, user.passwordHash)) {
        throw new AuthError(401, 'Invalid email or password')
      }

      return createSession(user)
    },

    async logout(token: string | null): Promise<void> {
      if (!token) {
        return
      }

      await prisma.session.updateMany({
        where: {
          tokenHash: hashOpaqueToken(token),
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      })
    },

    async getCurrentUser(token: string | null): Promise<AuthUser | null> {
      if (!token) {
        return null
      }

      const session = await prisma.session.findUnique({
        where: { tokenHash: hashOpaqueToken(token) },
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      })

      if (!session || session.revokedAt || session.expiresAt <= new Date()) {
        return null
      }

      return toAuthUser(session.user)
    },

    async requestPasswordReset(emailInput: string): Promise<PasswordResetResult> {
      const email = normalizeEmail(emailInput)

      if (!emailPattern.test(email)) {
        return {}
      }

      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      })

      if (!user) {
        return {}
      }

      const resetToken = createOpaqueToken()
      const expiresAt = addMinutes(new Date(), config.passwordResetTtlMinutes)

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashOpaqueToken(resetToken),
          expiresAt,
        },
      })

      return {
        resetToken,
        expiresAt,
      }
    },

    async resetPassword(token: string, password: string): Promise<void> {
      validatePassword(password)

      const resetToken = await prisma.passwordResetToken.findUnique({
        where: { tokenHash: hashOpaqueToken(token) },
      })

      if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) {
        throw new AuthError(400, 'Invalid or expired password reset token')
      }

      const passwordHash = await hashPassword(password)
      const usedAt = new Date()

      await prisma.$transaction([
        prisma.user.update({
          where: { id: resetToken.userId },
          data: { passwordHash },
        }),
        prisma.passwordResetToken.update({
          where: { id: resetToken.id },
          data: { usedAt },
        }),
        prisma.session.updateMany({
          where: {
            userId: resetToken.userId,
            revokedAt: null,
          },
          data: {
            revokedAt: usedAt,
          },
        }),
      ])
    },
  }
}
