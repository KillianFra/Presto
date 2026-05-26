export interface AppConfig {
  nodeEnv: string
  port: number
  corsOrigin: string
}

function parsePort(value: string | undefined): number {
  const port = Number(value ?? 3000)

  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('PORT must be an integer between 0 and 65535')
  }

  return port
}

export function getConfig(env: NodeJS.ProcessEnv = process.env): Readonly<AppConfig> {
  return Object.freeze({
    nodeEnv: env.NODE_ENV || 'development',
    port: parsePort(env.PORT),
    corsOrigin: env.CORS_ORIGIN || 'http://localhost:5173',
  })
}
