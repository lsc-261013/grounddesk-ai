import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import {
  webhookDeliveryListResponseSchema,
  webhookEndpointCreateInputSchema,
  webhookEndpointCreateResponseSchema,
  webhookEndpointListResponseSchema,
  webhookEndpointResponseSchema,
  webhookEndpointUpdateInputSchema,
  webhookTestResponseSchema,
} from '@grounddesk/shared'

import { AuthenticationError } from '../auth/errors.js'
import { createWorkspaceGuard } from '../auth/guards.js'
import type { IdentityDependencies } from '../auth/types.js'
import type { WebhookDependencies } from '../webhooks/dependencies.js'

const workspaceParamsSchema = z.object({ workspaceId: z.uuid() })
const endpointParamsSchema = workspaceParamsSchema.extend({ endpointId: z.uuid() })

export const registerWebhookRoutes = (
  app: FastifyInstance,
  identity: IdentityDependencies,
  webhooks: WebhookDependencies,
): void => {
  app.get(
    '/v1/workspaces/:workspaceId/webhooks',
    { preHandler: createWorkspaceGuard(identity, 'settings:manage') },
    async (request) => {
      const { workspaceId } = workspaceParamsSchema.parse(request.params)
      return webhookEndpointListResponseSchema.parse({
        endpoints: await webhooks.webhookService.listEndpoints(workspaceId),
      })
    },
  )

  app.post(
    '/v1/workspaces/:workspaceId/webhooks',
    { preHandler: createWorkspaceGuard(identity, 'settings:manage') },
    async (request, reply) => {
      const { workspaceId } = workspaceParamsSchema.parse(request.params)
      const authContext = request.authContext
      if (!authContext) throw new AuthenticationError()
      const input = webhookEndpointCreateInputSchema.parse(request.body)
      const created = await webhooks.webhookService.createEndpoint(
        workspaceId,
        authContext.userId,
        input.url,
        input.subscribedEvents,
      )
      await reply.status(201).send(webhookEndpointCreateResponseSchema.parse(created))
    },
  )

  app.patch(
    '/v1/workspaces/:workspaceId/webhooks/:endpointId',
    { preHandler: createWorkspaceGuard(identity, 'settings:manage') },
    async (request) => {
      const { workspaceId, endpointId } = endpointParamsSchema.parse(request.params)
      const input = webhookEndpointUpdateInputSchema.parse(request.body)
      return webhookEndpointResponseSchema.parse({
        endpoint: await webhooks.webhookService.updateEndpoint(workspaceId, endpointId, {
          ...(input.url ? { url: input.url } : {}),
          ...(input.subscribedEvents ? { subscribedEvents: input.subscribedEvents } : {}),
          ...(input.enabled === undefined ? {} : { enabled: input.enabled }),
        }),
      })
    },
  )

  app.post(
    '/v1/workspaces/:workspaceId/webhooks/:endpointId/test',
    { preHandler: createWorkspaceGuard(identity, 'settings:manage') },
    async (request) => {
      const { workspaceId, endpointId } = endpointParamsSchema.parse(request.params)
      return webhookTestResponseSchema.parse({
        delivery: await webhooks.webhookService.testEndpoint(workspaceId, endpointId),
      })
    },
  )

  app.get(
    '/v1/workspaces/:workspaceId/webhook-deliveries',
    { preHandler: createWorkspaceGuard(identity, 'settings:manage') },
    async (request) => {
      const { workspaceId } = workspaceParamsSchema.parse(request.params)
      return webhookDeliveryListResponseSchema.parse({
        deliveries: await webhooks.webhookService.listDeliveries(workspaceId),
      })
    },
  )
}
