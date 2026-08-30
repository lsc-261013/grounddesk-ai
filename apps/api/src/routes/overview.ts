import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { overviewMetricsResponseSchema } from '@grounddesk/shared'

import type { AnalyticsDependencies } from '../analytics/dependencies.js'
import { createWorkspaceGuard } from '../auth/guards.js'
import type { IdentityDependencies } from '../auth/types.js'

const workspaceParamsSchema = z.object({ workspaceId: z.uuid() })

export const registerOverviewRoutes = (
  app: FastifyInstance,
  identity: IdentityDependencies,
  analytics: AnalyticsDependencies,
): void => {
  app.get(
    '/v1/workspaces/:workspaceId/overview',
    { preHandler: createWorkspaceGuard(identity, 'workspace:read') },
    async (request) => {
      const { workspaceId } = workspaceParamsSchema.parse(request.params)
      return overviewMetricsResponseSchema.parse({
        metrics: await analytics.analyticsRepository.overview(workspaceId, 30),
      })
    },
  )
}
