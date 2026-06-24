export interface AppConfig {
  nodeEnv: string
  port: number
  corsOrigin: string
  sessionCookieName: string
  sessionTtlDays: number
  passwordResetTtlMinutes: number
}

function parsePort(value: string | undefined): number {
  const port = Number(value ?? 3000)

  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('PORT must be an integer between 0 and 65535')
  }

  return port
}

function parsePositiveInteger(value: string | undefined, defaultValue: number, name: string): number {
  const parsedValue = Number(value ?? defaultValue)

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${name} must be a positive integer`)
  }

  return parsedValue
}

export function getConfig(env: NodeJS.ProcessEnv = process.env): Readonly<AppConfig> {
  return Object.freeze({
    nodeEnv: env.NODE_ENV || 'development',
    port: parsePort(env.PORT),
    corsOrigin: env.CORS_ORIGIN || 'http://localhost:5173',
    sessionCookieName: env.SESSION_COOKIE_NAME || 'presto_session',
    sessionTtlDays: parsePositiveInteger(env.SESSION_TTL_DAYS, 7, 'SESSION_TTL_DAYS'),
    passwordResetTtlMinutes: parsePositiveInteger(
      env.PASSWORD_RESET_TTL_MINUTES,
      60,
      'PASSWORD_RESET_TTL_MINUTES',
    ),
  })
}
