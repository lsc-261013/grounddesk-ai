import type { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

const sessionBodySchema = z.object({ sessionId: z.uuid() })

interface SessionWindow {
  count: number
  resetAt: number
}

export const createPublicSessionRateLimitGuard = (
  maxRequests: number,
  timeWindowMs: number,
  now: () => number = Date.now,
): ((request: FastifyRequest, reply: FastifyReply) => Promise<void>) => {
  const windows = new Map<string, SessionWindow>()

  return async (request, reply): Promise<void> => {
    const parsed = sessionBodySchema.safeParse(request.body)
    if (!parsed.success) return

    const currentTime = now()
    const existing = windows.get(parsed.data.sessionId)
    if (!existing || existing.resetAt <= currentTime) {
      windows.set(parsed.data.sessionId, {
        count: 1,
        resetAt: currentTime + timeWindowMs,
      })
    } else if (existing.count >= maxRequests) {
      await reply.status(429).send({
        error: 'session_rate_limit_exceeded',
        message: 'This Demo browser session has sent too many requests. Please retry shortly.',
        retryAfterMs: Math.max(0, existing.resetAt - currentTime),
      })
      return
    } else {
      existing.count += 1
    }

    // The public Demo has a small global daily quota, but opportunistic cleanup also bounds
    // stale in-memory session windows without introducing another infrastructure service.
    if (windows.size > 5_000) {
      for (const [sessionId, window] of windows) {
        if (window.resetAt <= currentTime) windows.delete(sessionId)
      }
      while (windows.size > 5_000) {
        const oldestSessionId = windows.keys().next().value
        if (typeof oldestSessionId !== 'string') break
        windows.delete(oldestSessionId)
      }
    }
  }
}
