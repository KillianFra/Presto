import type { RequestHandler } from 'express'
import { AuthError } from './auth.errors.js'
import { readCookie } from './cookies.js'
import type { AuthService } from './auth.types.js'

export function createAuthMiddleware(
  authService: AuthService,
  sessionCookieName: string,
): RequestHandler {
  return async (req, _res, next) => {
    const token = readCookie(req, sessionCookieName)
    const user = await authService.getCurrentUser(token)

    if (!user) {
      next(new AuthError(401, 'Authentication required'))
      return
    }

    req.authUser = user
    next()
  }
}
