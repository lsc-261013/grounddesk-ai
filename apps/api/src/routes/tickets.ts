import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'

import {
  assignableAgentsResponseSchema,
  ticketAssignmentInputSchema,
  ticketDetailResponseSchema,
  ticketListResponseSchema,
  ticketReplyInputSchema,
  ticketStatusUpdateInputSchema,
} from '@grounddesk/shared'

import { AuthenticationError } from '../auth/errors.js'
import { createWorkspaceGuard } from '../auth/guards.js'
import type { IdentityDependencies } from '../auth/types.js'
import type { TicketDependencies } from '../tickets/dependencies.js'
import type { TicketAccess } from '../tickets/repository.js'

const workspaceParamsSchema = z.object({ workspaceId: z.uuid() })
const ticketParamsSchema = workspaceParamsSchema.extend({ ticketId: z.uuid() })

const requestAccess = (request: FastifyRequest): TicketAccess => {
  if (!request.authContext || !request.workspaceAccess) throw new AuthenticationError()
  return {
    userId: request.authContext.userId,
    role: request.workspaceAccess.role,
  }
}

export const registerTicketRoutes = (
  app: FastifyInstance,
  identity: IdentityDependencies,
  tickets: TicketDependencies,
): void => {
  app.get(
    '/v1/workspaces/:workspaceId/tickets',
    { preHandler: createWorkspaceGuard(identity, 'tickets:read') },
    async (request) => {
      const { workspaceId } = workspaceParamsSchema.parse(request.params)
      return ticketListResponseSchema.parse({
        tickets: await tickets.ticketService.list(workspaceId, requestAccess(request)),
      })
    },
  )

  app.get(
    '/v1/workspaces/:workspaceId/tickets/agents',
    { preHandler: createWorkspaceGuard(identity, 'tickets:assign') },
    async (request) => {
      const { workspaceId } = workspaceParamsSchema.parse(request.params)
      return assignableAgentsResponseSchema.parse({
        agents: await tickets.ticketService.agents(workspaceId),
      })
    },
  )

  app.get(
    '/v1/workspaces/:workspaceId/tickets/:ticketId',
    { preHandler: createWorkspaceGuard(identity, 'tickets:read') },
    async (request) => {
      const { workspaceId, ticketId } = ticketParamsSchema.parse(request.params)
      return ticketDetailResponseSchema.parse({
        ticket: await tickets.ticketService.detail(workspaceId, ticketId, requestAccess(request)),
      })
    },
  )

  app.post(
    '/v1/workspaces/:workspaceId/tickets/:ticketId/replies',
    { preHandler: createWorkspaceGuard(identity, 'tickets:reply') },
    async (request) => {
      const { workspaceId, ticketId } = ticketParamsSchema.parse(request.params)
      const { body } = ticketReplyInputSchema.parse(request.body)
      return ticketDetailResponseSchema.parse({
        ticket: await tickets.ticketService.reply(
          workspaceId,
          ticketId,
          requestAccess(request),
          body,
        ),
      })
    },
  )

  app.patch(
    '/v1/workspaces/:workspaceId/tickets/:ticketId/status',
    { preHandler: createWorkspaceGuard(identity, 'tickets:reply') },
    async (request) => {
      const { workspaceId, ticketId } = ticketParamsSchema.parse(request.params)
      const { status } = ticketStatusUpdateInputSchema.parse(request.body)
      return ticketDetailResponseSchema.parse({
        ticket: await tickets.ticketService.setStatus(
          workspaceId,
          ticketId,
          requestAccess(request),
          status,
        ),
      })
    },
  )

  app.patch(
    '/v1/workspaces/:workspaceId/tickets/:ticketId/assignment',
    { preHandler: createWorkspaceGuard(identity, 'tickets:assign') },
    async (request) => {
      const { workspaceId, ticketId } = ticketParamsSchema.parse(request.params)
      const update = ticketAssignmentInputSchema.parse(request.body)
      return ticketDetailResponseSchema.parse({
        ticket: await tickets.ticketService.assign(
          workspaceId,
          ticketId,
          requestAccess(request),
          update.assignedTo,
          update.priority,
        ),
      })
    },
  )
}
