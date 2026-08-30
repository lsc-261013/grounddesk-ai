import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import {
  evaluationCaseListResponseSchema,
  evaluationRunCreateInputSchema,
  evaluationRunDetailResponseSchema,
  evaluationRunListResponseSchema,
  evaluationRunResponseSchema,
  publicEvaluationSummaryResponseSchema,
} from '@grounddesk/shared'

import { AuthenticationError } from '../auth/errors.js'
import { createWorkspaceGuard } from '../auth/guards.js'
import type { IdentityDependencies } from '../auth/types.js'
import type { EvaluationDependencies } from '../evaluations/dependencies.js'

const workspaceParamsSchema = z.object({ workspaceId: z.uuid() })
const runParamsSchema = workspaceParamsSchema.extend({ runId: z.uuid() })
const publicWorkspaceParamsSchema = z.object({
  workspaceSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
})

export const registerEvaluationRoutes = (
  app: FastifyInstance,
  identity: IdentityDependencies,
  evaluations: EvaluationDependencies,
): void => {
  app.get('/v1/public/workspaces/:workspaceSlug/evaluations/latest', async (request) => {
    const { workspaceSlug } = publicWorkspaceParamsSchema.parse(request.params)
    return publicEvaluationSummaryResponseSchema.parse({
      evaluation: await evaluations.evaluationService.latestPublic(workspaceSlug),
    })
  })

  app.get(
    '/v1/workspaces/:workspaceId/evaluations/cases',
    { preHandler: createWorkspaceGuard(identity, 'evaluations:read') },
    async (request) => {
      const { workspaceId } = workspaceParamsSchema.parse(request.params)
      return evaluationCaseListResponseSchema.parse({
        cases: await evaluations.evaluationService.listCases(workspaceId),
      })
    },
  )

  app.get(
    '/v1/workspaces/:workspaceId/evaluations/runs',
    { preHandler: createWorkspaceGuard(identity, 'evaluations:read') },
    async (request) => {
      const { workspaceId } = workspaceParamsSchema.parse(request.params)
      return evaluationRunListResponseSchema.parse({
        runs: await evaluations.evaluationService.listRuns(workspaceId),
      })
    },
  )

  app.get(
    '/v1/workspaces/:workspaceId/evaluations/runs/:runId',
    { preHandler: createWorkspaceGuard(identity, 'evaluations:read') },
    async (request) => {
      const { workspaceId, runId } = runParamsSchema.parse(request.params)
      return evaluationRunDetailResponseSchema.parse(
        await evaluations.evaluationService.detail(workspaceId, runId),
      )
    },
  )

  app.post(
    '/v1/workspaces/:workspaceId/evaluations/runs',
    { preHandler: createWorkspaceGuard(identity, 'evaluations:run') },
    async (request, reply) => {
      const { workspaceId } = workspaceParamsSchema.parse(request.params)
      const input = evaluationRunCreateInputSchema.parse(request.body)
      const authContext = request.authContext
      const workspace = request.workspaceAccess
      if (!authContext || !workspace) throw new AuthenticationError()
      const membership = await identity.identityRepository.getMembership(
        authContext.userId,
        workspaceId,
      )
      if (!membership) throw new AuthenticationError()
      const run = await evaluations.evaluationService.startRun(
        workspaceId,
        membership.workspace.slug,
        authContext.userId,
        input.providerMode,
      )
      await reply.status(202).send(evaluationRunResponseSchema.parse({ run }))
    },
  )
}
