import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import {
  chatStreamEventSchema,
  publicChatFeedbackInputSchema,
  publicChatFeedbackResponseSchema,
  publicChatRequestSchema,
} from '@grounddesk/shared'

import type { AgentDependencies } from '../agent/dependencies.js'
import { PublicChatError } from '../agent/errors.js'
import { createWorkspaceGuard } from '../auth/guards.js'
import type { IdentityDependencies } from '../auth/types.js'
import type { ApiEnv } from '../config/env.js'

const workspaceParamsSchema = z.object({ workspaceId: z.uuid() })

export const registerPlaygroundRoutes = (
  app: FastifyInstance,
  environment: ApiEnv,
  identity: IdentityDependencies,
  dependencies: AgentDependencies,
): void => {
  app.post(
    '/v1/workspaces/:workspaceId/playground/feedback',
    { preHandler: createWorkspaceGuard(identity, 'conversations:read') },
    async (request) => {
      const { workspaceId } = workspaceParamsSchema.parse(request.params)
      const input = publicChatFeedbackInputSchema.parse(request.body)
      const accepted = await dependencies.agentService.submitWorkspaceFeedback(workspaceId, input)
      if (!accepted) {
        throw new PublicChatError('The feedback target is not available.', 404, 'not_found')
      }
      return publicChatFeedbackResponseSchema.parse({ accepted: true })
    },
  )

  app.post(
    '/v1/workspaces/:workspaceId/playground/stream',
    { preHandler: createWorkspaceGuard(identity, 'conversations:read') },
    async (request, reply) => {
      const { workspaceId } = workspaceParamsSchema.parse(request.params)
      const input = publicChatRequestSchema.parse(request.body)
      const chat = await dependencies.agentService.openWorkspaceChat(workspaceId, input)

      reply.hijack()
      reply.raw.statusCode = 200
      reply.raw.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
      reply.raw.setHeader('Cache-Control', 'no-cache, no-transform')
      reply.raw.setHeader('Connection', 'keep-alive')
      reply.raw.setHeader('X-Accel-Buffering', 'no')
      reply.raw.setHeader('Access-Control-Allow-Origin', environment.WEB_ORIGIN)
      reply.raw.setHeader('Access-Control-Allow-Credentials', 'true')
      reply.raw.setHeader('Vary', 'Origin')
      reply.raw.flushHeaders()

      try {
        for await (const streamEvent of chat.events) {
          if (request.raw.aborted) break
          const payload = chatStreamEventSchema.parse(streamEvent)
          reply.raw.write(`event: grounddesk\ndata: ${JSON.stringify(payload)}\n\n`)
        }
      } catch {
        const payload = chatStreamEventSchema.parse({
          type: 'error',
          code: 'stream_failed',
          message: 'The chat stream ended unexpectedly. Please retry.',
        })
        if (!request.raw.aborted) {
          reply.raw.write(`event: grounddesk\ndata: ${JSON.stringify(payload)}\n\n`)
        }
      } finally {
        if (!reply.raw.writableEnded) reply.raw.end()
      }
    },
  )
}
