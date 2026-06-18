import type { CookieOptions, Request, Response } from 'express'
import type { AppConfig } from '../../config/env.js'

export function readCookie(req: Request, name: string): string | null {
  const cookieHeader = req.headers.cookie

  if (!cookieHeader) {
    return null
  }

  for (const part of cookieHeader.split(';')) {
    const [rawKey, ...rawValueParts] = part.trim().split('=')

    if (rawKey === name) {
      return decodeURIComponent(rawValueParts.join('='))
    }
  }

  return null
}

export function getSessionCookieOptions(config: Readonly<AppConfig>): CookieOptions {
  return {
    httpOnly: true,
    maxAge: config.sessionTtlDays * 24 * 60 * 60 * 1000,
    path: '/',
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
  }
}

export function writeSessionCookie(
  res: Response,
  token: string,
  config: Readonly<AppConfig>,
): void {
  res.cookie(config.sessionCookieName, token, getSessionCookieOptions(config))
}

export function clearSessionCookie(res: Response, config: Readonly<AppConfig>): void {
  res.clearCookie(config.sessionCookieName, {
    path: '/',
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
  })
}
