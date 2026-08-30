import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'

import {
  conversationDetailResponseSchema,
  conversationListResponseSchema,
} from '@grounddesk/shared'

import { AuthenticationError } from '../auth/errors.js'
import { createWorkspaceGuard } from '../auth/guards.js'
import type { IdentityDependencies } from '../auth/types.js'
import type { ConversationDependencies } from '../conversations/dependencies.js'
import type { ConversationAccess } from '../conversations/repository.js'

const workspaceParamsSchema = z.object({ workspaceId: z.uuid() })
const conversationParamsSchema = workspaceParamsSchema.extend({ conversationId: z.uuid() })

const requestAccess = (request: FastifyRequest): ConversationAccess => {
  if (!request.authContext || !request.workspaceAccess) throw new AuthenticationError()
  return { userId: request.authContext.userId, role: request.workspaceAccess.role }
}

export const registerConversationRoutes = (
  app: FastifyInstance,
  identity: IdentityDependencies,
  conversations: ConversationDependencies,
): void => {
  app.get(
    '/v1/workspaces/:workspaceId/conversations',
    { preHandler: createWorkspaceGuard(identity, 'conversations:read') },
    async (request) => {
      const { workspaceId } = workspaceParamsSchema.parse(request.params)
      return conversationListResponseSchema.parse(
        await conversations.conversationRepository.list(workspaceId, requestAccess(request)),
      )
    },
  )

  app.get(
    '/v1/workspaces/:workspaceId/conversations/:conversationId',
    { preHandler: createWorkspaceGuard(identity, 'conversations:read') },
    async (request, reply) => {
      const { workspaceId, conversationId } = conversationParamsSchema.parse(request.params)
      const conversation = await conversations.conversationRepository.get(
        workspaceId,
        conversationId,
        requestAccess(request),
      )
      if (!conversation) {
        return reply.code(404).send({ error: 'not_found', message: 'Conversation not found.' })
      }
      return conversationDetailResponseSchema.parse({ conversation })
    },
  )
}
