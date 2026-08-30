import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import {
  demoResetResponseSchema,
  workspaceMemberCreateInputSchema,
  workspaceMemberListResponseSchema,
  workspaceMemberSchema,
  workspaceMemberUpdateInputSchema,
  workspaceOnboardingInputSchema,
  workspaceOnboardingResponseSchema,
  workspaceSettingsResponseSchema,
  workspaceSettingsUpdateInputSchema,
} from '@grounddesk/shared'

import { AuthenticationError } from '../auth/errors.js'
import { createAuthenticateGuard, createWorkspaceGuard } from '../auth/guards.js'
import type { IdentityDependencies } from '../auth/types.js'
import type { WorkspaceDependencies } from '../workspaces/dependencies.js'

const workspaceParamsSchema = z.object({ workspaceId: z.uuid() })
const memberParamsSchema = workspaceParamsSchema.extend({ userId: z.uuid() })

export const registerWorkspaceRoutes = (
  app: FastifyInstance,
  identity: IdentityDependencies,
  workspaces: WorkspaceDependencies,
): void => {
  app.post(
    '/v1/auth/onboard',
    { preHandler: createAuthenticateGuard(identity) },
    async (request, reply) => {
      if (!request.authContext) throw new AuthenticationError()
      const input = workspaceOnboardingInputSchema.parse(request.body)
      const membership = await workspaces.workspaceRepository.onboard(
        request.authContext.userId,
        input,
      )
      if (!membership) {
        return reply.code(409).send({
          error: 'workspace_unavailable',
          message: 'The workspace slug is unavailable or onboarding is already complete.',
        })
      }
      return workspaceOnboardingResponseSchema.parse({ membership })
    },
  )

  app.get(
    '/v1/workspaces/:workspaceId/settings',
    { preHandler: createWorkspaceGuard(identity, 'settings:manage') },
    async (request, reply) => {
      const { workspaceId } = workspaceParamsSchema.parse(request.params)
      const workspace = await workspaces.workspaceRepository.getSettings(workspaceId)
      if (!workspace) return reply.code(404).send({ error: 'not_found' })
      return workspaceSettingsResponseSchema.parse({ workspace })
    },
  )

  app.patch(
    '/v1/workspaces/:workspaceId/settings',
    { preHandler: createWorkspaceGuard(identity, 'settings:manage') },
    async (request, reply) => {
      const { workspaceId } = workspaceParamsSchema.parse(request.params)
      const input = workspaceSettingsUpdateInputSchema.parse(request.body)
      const workspace = await workspaces.workspaceRepository.updateSettings(workspaceId, input)
      if (!workspace) return reply.code(404).send({ error: 'not_found' })
      return workspaceSettingsResponseSchema.parse({ workspace })
    },
  )

  app.get(
    '/v1/workspaces/:workspaceId/members',
    { preHandler: createWorkspaceGuard(identity, 'settings:manage') },
    async (request) => {
      const { workspaceId } = workspaceParamsSchema.parse(request.params)
      return workspaceMemberListResponseSchema.parse({
        members: await workspaces.workspaceRepository.listMembers(workspaceId),
      })
    },
  )

  app.post(
    '/v1/workspaces/:workspaceId/members',
    { preHandler: createWorkspaceGuard(identity, 'settings:manage') },
    async (request, reply) => {
      const { workspaceId } = workspaceParamsSchema.parse(request.params)
      const input = workspaceMemberCreateInputSchema.parse(request.body)
      const member = await workspaces.workspaceRepository.addMember(
        workspaceId,
        input.email,
        input.role,
      )
      if (!member) {
        return reply.code(404).send({
          error: 'user_not_found',
          message: 'Ask the member to create a GroundDesk account before adding them.',
        })
      }
      return workspaceMemberSchema.parse(member)
    },
  )

  app.patch(
    '/v1/workspaces/:workspaceId/members/:userId',
    { preHandler: createWorkspaceGuard(identity, 'settings:manage') },
    async (request, reply) => {
      const { workspaceId, userId } = memberParamsSchema.parse(request.params)
      const { role } = workspaceMemberUpdateInputSchema.parse(request.body)
      const member = await workspaces.workspaceRepository.updateMember(workspaceId, userId, role)
      if (!member) {
        return reply.code(409).send({
          error: 'member_update_blocked',
          message: 'The last workspace administrator cannot be demoted.',
        })
      }
      return workspaceMemberSchema.parse(member)
    },
  )

  app.delete(
    '/v1/workspaces/:workspaceId/members/:userId',
    { preHandler: createWorkspaceGuard(identity, 'settings:manage') },
    async (request, reply) => {
      const { workspaceId, userId } = memberParamsSchema.parse(request.params)
      const removed = await workspaces.workspaceRepository.removeMember(workspaceId, userId)
      if (!removed) {
        return reply.code(409).send({
          error: 'member_removal_blocked',
          message: 'The member was not found or is the last workspace administrator.',
        })
      }
      return reply.code(204).send()
    },
  )

  app.post(
    '/v1/workspaces/:workspaceId/demo-reset',
    { preHandler: createWorkspaceGuard(identity, 'settings:manage') },
    async (request, reply) => {
      const { workspaceId } = workspaceParamsSchema.parse(request.params)
      if (!(await workspaces.workspaceRepository.resetDemo(workspaceId))) {
        return reply.code(409).send({
          error: 'reset_unavailable',
          message: 'Only Demo Workspaces can be reset.',
        })
      }
      return demoResetResponseSchema.parse({ reset: true, completedAt: new Date().toISOString() })
    },
  )
}
