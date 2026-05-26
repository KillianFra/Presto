import type { Server } from 'node:http'
import { createApp } from './app.js'
import { getConfig, type AppConfig } from './config/env.js'
import type { Logger } from './types/logger.js'

interface ServerOptions {
  config?: Readonly<AppConfig>
  logger?: Logger
}

export function startServer(options: ServerOptions = {}): Server {
  const config = options.config || getConfig()
  const logger = options.logger || console
  const app = createApp({ config, logger })

  return app.listen(config.port, () => {
    logger.info(`Presto API listening on http://localhost:${config.port}`)
  })
}

const isEntryPoint = process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href

if (isEntryPoint) {
  startServer()
}
