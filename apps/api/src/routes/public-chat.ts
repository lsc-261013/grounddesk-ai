import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { chatStreamEventSchema, publicChatRequestSchema } from '@grounddesk/shared'

import type { AgentDependencies } from '../agent/dependencies.js'
import type { ApiEnv } from '../config/env.js'

const workspaceParamsSchema = z.object({
  workspaceSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
})

export const registerPublicChatRoutes = (
  app: FastifyInstance,
  environment: ApiEnv,
  dependencies: AgentDependencies,
): void => {
  app.post(
    '/v1/public/workspaces/:workspaceSlug/chat/stream',
    {
      config: {
        rateLimit: {
          max: environment.PUBLIC_CHAT_RATE_LIMIT,
          timeWindow: environment.PUBLIC_CHAT_RATE_WINDOW_MS,
        },
      },
    },
    async (request, reply) => {
      const { workspaceSlug } = workspaceParamsSchema.parse(request.params)
      const input = publicChatRequestSchema.parse(request.body)
      const chat = await dependencies.agentService.openPublicChat(workspaceSlug, input)

      reply.hijack()
      reply.raw.statusCode = 200
      reply.raw.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
      reply.raw.setHeader('Cache-Control', 'no-cache, no-transform')
      reply.raw.setHeader('Connection', 'keep-alive')
      reply.raw.setHeader('X-Accel-Buffering', 'no')
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
