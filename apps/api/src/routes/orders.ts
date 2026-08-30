import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import {
  consoleOrderListResponseSchema,
  consoleOrderResponseSchema,
  orderStatusSchema,
  orderStatusUpdateInputSchema,
} from '@grounddesk/shared'

import { createWorkspaceGuard } from '../auth/guards.js'
import type { IdentityDependencies } from '../auth/types.js'
import type { OrderDependencies } from '../orders/dependencies.js'

const workspaceParamsSchema = z.object({ workspaceId: z.uuid() })
const orderParamsSchema = workspaceParamsSchema.extend({ orderId: z.uuid() })
const listQuerySchema = z.object({
  query: z.string().trim().max(120).optional(),
  status: orderStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export const registerOrderRoutes = (
  app: FastifyInstance,
  identity: IdentityDependencies,
  orders: OrderDependencies,
): void => {
  app.get(
    '/v1/workspaces/:workspaceId/orders',
    { preHandler: createWorkspaceGuard(identity, 'orders:read') },
    async (request) => {
      const { workspaceId } = workspaceParamsSchema.parse(request.params)
      const query = listQuerySchema.parse(request.query)
      return consoleOrderListResponseSchema.parse(
        await orders.orderRepository.list(workspaceId, {
          query: query.query || null,
          status: query.status ?? null,
          limit: query.limit,
          offset: query.offset,
        }),
      )
    },
  )

  app.get(
    '/v1/workspaces/:workspaceId/orders/:orderId',
    { preHandler: createWorkspaceGuard(identity, 'orders:read') },
    async (request, reply) => {
      const { workspaceId, orderId } = orderParamsSchema.parse(request.params)
      const order = await orders.orderRepository.get(workspaceId, orderId)
      if (!order) return reply.code(404).send({ error: 'not_found', message: 'Order not found.' })
      return consoleOrderResponseSchema.parse({ order })
    },
  )

  app.patch(
    '/v1/workspaces/:workspaceId/orders/:orderId/status',
    { preHandler: createWorkspaceGuard(identity, 'orders:write') },
    async (request, reply) => {
      const { workspaceId, orderId } = orderParamsSchema.parse(request.params)
      const { status } = orderStatusUpdateInputSchema.parse(request.body)
      const order = await orders.orderRepository.updateStatus(workspaceId, orderId, status)
      if (!order) return reply.code(404).send({ error: 'not_found', message: 'Order not found.' })
      return consoleOrderResponseSchema.parse({ order })
    },
  )
}
