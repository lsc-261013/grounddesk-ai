import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify'
import { ZodError } from 'zod'

import { createIdentityDependencies } from './auth/dependencies.js'
import {
  createAnalyticsDependencies,
  type AnalyticsDependencies,
} from './analytics/dependencies.js'
import { isHttpError } from './auth/errors.js'
import './auth/request-context.js'
import type { IdentityDependencies } from './auth/types.js'
import { createAgentDependencies, type AgentDependencies } from './agent/dependencies.js'
import { createCatalogDependencies, type CatalogDependencies } from './catalog/dependencies.js'
import { env, type ApiEnv } from './config/env.js'
import { createDatabaseClient } from './db/client.js'
import {
  createConversationDependencies,
  type ConversationDependencies,
} from './conversations/dependencies.js'
import {
  createEvaluationDependencies,
  type EvaluationDependencies,
} from './evaluations/dependencies.js'
import {
  createKnowledgeDependencies,
  type KnowledgeDependencies,
} from './knowledge/dependencies.js'
import { createOrderDependencies, type OrderDependencies } from './orders/dependencies.js'
import { registerAuthRoutes } from './routes/auth.js'
import { registerCatalogRoutes } from './routes/catalog.js'
import { registerConversationRoutes } from './routes/conversations.js'
import { registerEvaluationRoutes } from './routes/evaluations.js'
import { registerHealthRoute } from './routes/health.js'
import { registerKnowledgeRoutes } from './routes/knowledge.js'
import { registerOverviewRoutes } from './routes/overview.js'
import { registerOrderRoutes } from './routes/orders.js'
import { registerPlaygroundRoutes } from './routes/playground.js'
import { registerPublicChatRoutes } from './routes/public-chat.js'
import { registerTicketRoutes } from './routes/tickets.js'
import { registerWebhookRoutes } from './routes/webhooks.js'
import { registerWorkspaceRoutes } from './routes/workspaces.js'
import { createTicketDependencies, type TicketDependencies } from './tickets/dependencies.js'
import { createWebhookDependencies, type WebhookDependencies } from './webhooks/dependencies.js'
import {
  createWorkspaceDependencies,
  type WorkspaceDependencies,
} from './workspaces/dependencies.js'

export interface BuildAppOptions {
  environment?: ApiEnv
  identityDependencies?: IdentityDependencies
  knowledgeDependencies?: KnowledgeDependencies
  agentDependencies?: AgentDependencies
  ticketDependencies?: TicketDependencies
  webhookDependencies?: WebhookDependencies
  evaluationDependencies?: EvaluationDependencies
  analyticsDependencies?: AnalyticsDependencies
  catalogDependencies?: CatalogDependencies
  conversationDependencies?: ConversationDependencies
  orderDependencies?: OrderDependencies
  workspaceDependencies?: WorkspaceDependencies
  logger?: boolean
}

export const buildApp = async (options: BuildAppOptions = {}): Promise<FastifyInstance> => {
  const environment = options.environment ?? env
  const database =
    environment.RUNTIME_MODE === 'connected' && environment.SUPABASE_DB_URL
      ? createDatabaseClient(environment.SUPABASE_DB_URL)
      : null
  const identityDependencies =
    options.identityDependencies ?? createIdentityDependencies(environment, database ?? undefined)
  const knowledgeDependencies =
    options.knowledgeDependencies ?? createKnowledgeDependencies(environment, database ?? undefined)
  const agentDependencies =
    options.agentDependencies ??
    createAgentDependencies(
      environment,
      knowledgeDependencies.knowledgeService,
      database ?? undefined,
    )
  const ticketDependencies =
    options.ticketDependencies ?? createTicketDependencies(environment, database ?? undefined)
  const webhookDependencies =
    options.webhookDependencies ?? createWebhookDependencies(environment, database ?? undefined)
  const evaluationDependencies =
    options.evaluationDependencies ??
    createEvaluationDependencies(environment, agentDependencies.agentService, database ?? undefined)
  const analyticsDependencies =
    options.analyticsDependencies ?? createAnalyticsDependencies(environment, database ?? undefined)
  const catalogDependencies =
    options.catalogDependencies ?? createCatalogDependencies(environment, database ?? undefined)
  const conversationDependencies =
    options.conversationDependencies ??
    createConversationDependencies(environment, database ?? undefined)
  const orderDependencies =
    options.orderDependencies ?? createOrderDependencies(environment, database ?? undefined)
  const workspaceDependencies =
    options.workspaceDependencies ?? createWorkspaceDependencies(environment, database ?? undefined)
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
  registerCatalogRoutes(app, catalogDependencies)
  registerAuthRoutes(app, identityDependencies)
  registerKnowledgeRoutes(app, identityDependencies, knowledgeDependencies)
  registerPublicChatRoutes(app, environment, agentDependencies)
  registerPlaygroundRoutes(app, environment, identityDependencies, agentDependencies)
  registerConversationRoutes(app, identityDependencies, conversationDependencies)
  registerOrderRoutes(app, identityDependencies, orderDependencies)
  registerWorkspaceRoutes(app, identityDependencies, workspaceDependencies)
  registerTicketRoutes(app, identityDependencies, ticketDependencies)
  registerWebhookRoutes(app, identityDependencies, webhookDependencies)
  registerEvaluationRoutes(app, identityDependencies, evaluationDependencies)
  registerOverviewRoutes(app, identityDependencies, analyticsDependencies)

  app.addHook('onClose', async () => {
    await workspaceDependencies.workspaceRepository.close()
    await orderDependencies.orderRepository.close()
    await conversationDependencies.conversationRepository.close()
    await catalogDependencies.catalogRepository.close()
    await analyticsDependencies.analyticsRepository.close()
    await evaluationDependencies.evaluationService.close()
    await webhookDependencies.webhookService.close()
    await ticketDependencies.ticketService.close()
    await agentDependencies.agentService.close()
    await knowledgeDependencies.knowledgeService.close()
    await identityDependencies.identityRepository.close()
    await database?.end({ timeout: 5 })
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
