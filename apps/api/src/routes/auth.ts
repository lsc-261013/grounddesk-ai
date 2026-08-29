import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import {
  authSessionResponseSchema,
  getPermissionsForRole,
  workspaceAccessResponseSchema,
} from '@grounddesk/shared'

import { AuthenticationError } from '../auth/errors.js'
import { createAuthenticateGuard, createWorkspaceGuard } from '../auth/guards.js'
import type { IdentityDependencies } from '../auth/types.js'

const workspaceParamsSchema = z.object({ workspaceId: z.uuid() })

export const registerAuthRoutes = (
  app: FastifyInstance,
  dependencies: IdentityDependencies,
): void => {
  app.get(
    '/v1/auth/session',
    { preHandler: createAuthenticateGuard(dependencies) },
    async (request) => {
      const authContext = request.authContext
      if (!authContext) {
        throw new AuthenticationError()
      }

      const [profile, memberships] = await Promise.all([
        dependencies.identityRepository.getProfile(authContext.userId),
        dependencies.identityRepository.listMemberships(authContext.userId),
      ])

      if (!profile) {
        throw new AuthenticationError('The authenticated user profile is unavailable.')
      }

      return authSessionResponseSchema.parse({
        user: { id: authContext.userId, email: authContext.email },
        profile,
        memberships,
      })
    },
  )

  app.get(
    '/v1/workspaces/:workspaceId/access',
    { preHandler: createWorkspaceGuard(dependencies, 'workspace:read') },
    async (request) => {
      const { workspaceId } = workspaceParamsSchema.parse(request.params)
      const authContext = request.authContext
      if (!authContext) {
        throw new AuthenticationError()
      }

      const membership = await dependencies.identityRepository.getMembership(
        authContext.userId,
        workspaceId,
      )

      if (!membership) {
        throw new AuthenticationError('Workspace membership is unavailable.')
      }

      return workspaceAccessResponseSchema.parse({
        ...membership,
        permissions: getPermissionsForRole(membership.role),
      })
    },
  )

  app.get(
    '/v1/workspaces/:workspaceId/settings-access',
    { preHandler: createWorkspaceGuard(dependencies, 'settings:manage') },
    (request) => {
      const { workspaceId } = workspaceParamsSchema.parse(request.params)
      return { workspaceId, allowed: true }
    },
  )
}
