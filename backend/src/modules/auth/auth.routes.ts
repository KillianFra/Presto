import { Router, type NextFunction, type Request, type Response } from 'express'
import type { AppConfig } from '../../config/env.js'
import { AuthError } from './auth.errors.js'
import { clearSessionCookie, readCookie, writeSessionCookie } from './cookies.js'
import type { AuthService } from './auth.types.js'

interface AuthRouterOptions {
  authService: AuthService
  config: Readonly<AppConfig>
}

function readStringBody(req: Request, field: string): string {
  const body = req.body as Record<string, unknown> | undefined
  const value = body?.[field]

  return typeof value === 'string' ? value : ''
}

function handleAuthError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof AuthError) {
    res.status(error.statusCode).json({
      error: {
        message: error.message,
      },
    })
    return
  }

  next(error)
}

export function createAuthRouter(options: AuthRouterOptions): Router {
  const router = Router()
  const { authService, config } = options

  router.post('/register', async (req, res, next) => {
    try {
      const result = await authService.register({
        email: readStringBody(req, 'email'),
        password: readStringBody(req, 'password'),
      })

      writeSessionCookie(res, result.token, config)
      res.status(201).json({ user: result.user })
    } catch (error) {
      handleAuthError(error, res, next)
    }
  })

  router.post('/login', async (req, res, next) => {
    try {
      const result = await authService.login({
        email: readStringBody(req, 'email'),
        password: readStringBody(req, 'password'),
      })

      writeSessionCookie(res, result.token, config)
      res.status(200).json({ user: result.user })
    } catch (error) {
      handleAuthError(error, res, next)
    }
  })

  router.post('/logout', async (req, res, next) => {
    try {
      const token = readCookie(req, config.sessionCookieName)

      await authService.logout(token)
      clearSessionCookie(res, config)
      res.status(204).send()
    } catch (error) {
      handleAuthError(error, res, next)
    }
  })

  router.get('/me', async (req, res, next) => {
    try {
      const user = await authService.getCurrentUser(readCookie(req, config.sessionCookieName))

      if (!user) {
        throw new AuthError(401, 'Authentication required')
      }

      res.status(200).json({ user })
    } catch (error) {
      handleAuthError(error, res, next)
    }
  })

  router.post('/forgot-password', async (req, res, next) => {
    try {
      const result = await authService.requestPasswordReset(readStringBody(req, 'email'))
      const body: Record<string, unknown> = {
        message: 'If an account exists, a password reset has been prepared.',
      }

      if (config.nodeEnv !== 'production' && result.resetToken) {
        body.resetToken = result.resetToken
      }

      res.status(202).json(body)
    } catch (error) {
      handleAuthError(error, res, next)
    }
  })

  router.post('/reset-password', async (req, res, next) => {
    try {
      await authService.resetPassword(
        readStringBody(req, 'token'),
        readStringBody(req, 'password'),
      )

      res.status(204).send()
    } catch (error) {
      handleAuthError(error, res, next)
    }
  })

  return router
}
