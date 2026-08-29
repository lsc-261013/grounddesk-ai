import { buildApp } from './app.js'
import { env } from './config/env.js'

const app = await buildApp()

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  app.log.info({ signal }, 'Graceful shutdown started')
  await app.close()
  process.exit(0)
}

process.once('SIGINT', () => {
  void shutdown('SIGINT')
})
process.once('SIGTERM', () => {
  void shutdown('SIGTERM')
})

try {
  await app.listen({ host: env.API_HOST, port: env.API_PORT })
} catch (error) {
  app.log.fatal({ err: error }, 'API failed to start')
  process.exit(1)
}
