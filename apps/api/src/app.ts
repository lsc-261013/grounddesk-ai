import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify'
import { ZodError } from 'zod'

import { createIdentityDependencies } from './auth/dependencies.js'
import { isHttpError } from './auth/errors.js'
import './auth/request-context.js'
import type { IdentityDependencies } from './auth/types.js'
import { createAgentDependencies, type AgentDependencies } from './agent/dependencies.js'
import { env, type ApiEnv } from './config/env.js'
import {
  createKnowledgeDependencies,
  type KnowledgeDependencies,
} from './knowledge/dependencies.js'
import { registerAuthRoutes } from './routes/auth.js'
import { registerHealthRoute } from './routes/health.js'
import { registerKnowledgeRoutes } from './routes/knowledge.js'
import { registerPublicChatRoutes } from './routes/public-chat.js'

export interface BuildAppOptions {
  environment?: ApiEnv
  identityDependencies?: IdentityDependencies
  knowledgeDependencies?: KnowledgeDependencies
  agentDependencies?: AgentDependencies
  logger?: boolean
}

export const buildApp = async (options: BuildAppOptions = {}): Promise<FastifyInstance> => {
  const environment = options.environment ?? env
  const identityDependencies =
    options.identityDependencies ?? createIdentityDependencies(environment)
  const knowledgeDependencies =
    options.knowledgeDependencies ?? createKnowledgeDependencies(environment)
  const agentDependencies =
    options.agentDependencies ??
    createAgentDependencies(environment, knowledgeDependencies.knowledgeService)
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
  await app.register(multipart, {
    limits: {
      fileSize: environment.MAX_UPLOAD_BYTES,
      files: 1,
      fields: 3,
      parts: 4,
    },
  })

  app.decorateRequest('authContext', null)
  app.decorateRequest('workspaceAccess', null)

  registerHealthRoute(app, environment)
  registerAuthRoutes(app, identityDependencies)
  registerKnowledgeRoutes(app, identityDependencies, knowledgeDependencies)
  registerPublicChatRoutes(app, environment, agentDependencies)

  app.addHook('onClose', async () => {
    await identityDependencies.identityRepository.close()
    await knowledgeDependencies.knowledgeService.close()
    await agentDependencies.agentService.close()
  })

  app.setNotFoundHandler(async (_request, reply) => {
    await reply.status(404).send({
      error: 'not_found',
      message: 'The requested resource does not exist.',
    })
  })

  app.setErrorHandler(async (error: FastifyError, request, reply) => {
    request.log.error({ err: error }, 'Request failed')
    if (isHttpError(error)) {
      await reply.status(error.statusCode).send({ error: error.code, message: error.message })
      return
    }

    if (error instanceof ZodError) {
      await reply.status(400).send({
        error: 'validation_failed',
        message: 'Request validation failed.',
        issues: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      })
      return
    }

    const statusCode = error.statusCode ?? 500
    await reply.status(statusCode).send({
      error: statusCode < 500 ? 'request_failed' : 'internal_error',
      message: statusCode < 500 ? error.message : 'The service could not complete the request.',
    })
  })

  return app
}
