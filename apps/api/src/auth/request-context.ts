import type { RequestAuthContext, WorkspaceAccessContext } from './types.js'

declare module 'fastify' {
  interface FastifyRequest {
    authContext: RequestAuthContext | null
    workspaceAccess: WorkspaceAccessContext | null
  }
}
