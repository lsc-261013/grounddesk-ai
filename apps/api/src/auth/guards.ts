import type { FastifyReply, FastifyRequest } from 'fastify'

import { hasPermission, type Permission } from '@grounddesk/shared'

import { AuthenticationError, AuthorizationError } from './errors.js'
import type { IdentityDependencies } from './types.js'

export type RequestGuard = (request: FastifyRequest, reply: FastifyReply) => Promise<void>

const getBearerToken = (request: FastifyRequest): string => {
  const authorization = request.headers.authorization

  if (!authorization) {
    throw new AuthenticationError()
  }

  const [scheme, token, unexpectedPart] = authorization.trim().split(/\s+/)

  if (scheme?.toLowerCase() !== 'bearer' || !token || unexpectedPart) {
    throw new AuthenticationError('Authorization must use a single Bearer token.')
  }

  return token
}

const authenticateRequest = async (
  request: FastifyRequest,
  dependencies: IdentityDependencies,
): Promise<void> => {
  request.authContext = await dependencies.authVerifier.verifyAccessToken(getBearerToken(request))
}

export const createAuthenticateGuard =
  (dependencies: IdentityDependencies): RequestGuard =>
  async (request): Promise<void> => {
    await authenticateRequest(request, dependencies)
  }

export const createWorkspaceGuard = (
  dependencies: IdentityDependencies,
  permission: Permission,
): RequestGuard => {
  return async (request): Promise<void> => {
    await authenticateRequest(request, dependencies)

    const workspaceId = (request.params as { workspaceId?: unknown }).workspaceId

    if (typeof workspaceId !== 'string') {
      throw new AuthorizationError()
    }

    const authContext = request.authContext
    if (!authContext) {
      throw new AuthenticationError()
    }

    const membership = await dependencies.identityRepository.getMembership(
      authContext.userId,
      workspaceId,
    )

    if (!membership || !hasPermission(membership.role, permission)) {
      throw new AuthorizationError()
    }

    request.workspaceAccess = {
      workspaceId: membership.workspace.id,
      role: membership.role,
    }
  }
}
