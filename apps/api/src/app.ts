import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify'

import { env, type ApiEnv } from './config/env.js'
import { registerHealthRoute } from './routes/health.js'

export interface BuildAppOptions {
  environment?: ApiEnv
  logger?: boolean
}

export const buildApp = async (options: BuildAppOptions = {}): Promise<FastifyInstance> => {
  const environment = options.environment ?? env
  const app = Fastify({
    logger: options.logger ?? environment.NODE_ENV !== 'test',
    bodyLimit: environment.MAX_UPLOAD_BYTES,
    trustProxy: true,
  })

  await app.register(helmet, { global: true })
  await app.register(cors, {
    origin: environment.WEB_ORIGIN,
    credentials: true,
  })
  await app.register(rateLimit, {
    global: false,
    max: environment.PUBLIC_CHAT_RATE_LIMIT,
    timeWindow: environment.PUBLIC_CHAT_RATE_WINDOW_MS,
  })

  registerHealthRoute(app, environment)

  app.setNotFoundHandler(async (_request, reply) => {
    await reply.status(404).send({
      error: 'not_found',
      message: 'The requested resource does not exist.',
    })
  })

  app.setErrorHandler(async (error: FastifyError, request, reply) => {
    request.log.error({ err: error }, 'Request failed')
    await reply.status(error.statusCode ?? 500).send({
      error: error.statusCode && error.statusCode < 500 ? 'request_failed' : 'internal_error',
      message:
        error.statusCode && error.statusCode < 500
          ? error.message
          : 'The service could not complete the request.',
    })
  })

  return app
}
