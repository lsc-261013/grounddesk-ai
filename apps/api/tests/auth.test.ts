import { authSessionResponseSchema, workspaceAccessResponseSchema } from '@grounddesk/shared'
import { afterEach, describe, expect, it } from 'vitest'

import { buildApp } from '../src/app.js'
import { AuthenticationError } from '../src/auth/errors.js'
import type {
  AuthenticatedUser,
  AuthVerifier,
  IdentityDependencies,
  IdentityProfile,
  IdentityRepository,
} from '../src/auth/types.js'
import { parseApiEnv } from '../src/config/env.js'

const DEMO_WORKSPACE_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_WORKSPACE_ID = '22222222-2222-4222-8222-222222222222'
const ADMIN_USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const AGENT_USER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const users: Record<string, AuthenticatedUser> = {
  'admin-token': { userId: ADMIN_USER_ID, email: 'admin@demo.grounddesk.app' },
  'agent-token': { userId: AGENT_USER_ID, email: 'agent@demo.grounddesk.app' },
}

const profiles: Record<string, IdentityProfile> = {
  [ADMIN_USER_ID]: {
    id: ADMIN_USER_ID,
    displayName: 'Demo Admin',
    avatarUrl: null,
    locale: 'zh-CN',
  },
  [AGENT_USER_ID]: {
    id: AGENT_USER_ID,
    displayName: 'Demo Agent',
    avatarUrl: null,
    locale: 'en-US',
  },
}

const membershipFor = (userId: string) => {
  if (userId !== ADMIN_USER_ID && userId !== AGENT_USER_ID) {
    return null
  }

  return {
    workspace: {
      id: DEMO_WORKSPACE_ID,
      name: 'Avenlo Demo Workspace',
      slug: 'northstar-audio-demo',
      isDemo: true,
    },
    role: userId === ADMIN_USER_ID ? ('admin' as const) : ('agent' as const),
  }
}

class FakeAuthVerifier implements AuthVerifier {
  verifyAccessToken(accessToken: string): Promise<AuthenticatedUser> {
    const user = users[accessToken]
    return user
      ? Promise.resolve(user)
      : Promise.reject(new AuthenticationError('The access token is invalid or expired.'))
  }
}

class FakeIdentityRepository implements IdentityRepository {
  getProfile(userId: string): Promise<IdentityProfile | null> {
    return Promise.resolve(profiles[userId] ?? null)
  }

  listMemberships(userId: string): Promise<NonNullable<ReturnType<typeof membershipFor>>[]> {
    const membership = membershipFor(userId)
    return Promise.resolve(membership ? [membership] : [])
  }

  getMembership(
    userId: string,
    workspaceId: string,
  ): Promise<NonNullable<ReturnType<typeof membershipFor>> | null> {
    return Promise.resolve(workspaceId === DEMO_WORKSPACE_ID ? membershipFor(userId) : null)
  }

  close(): Promise<void> {
    return Promise.resolve()
  }
}

const apps: Awaited<ReturnType<typeof buildApp>>[] = []

const createTestApp = async () => {
  const identityDependencies: IdentityDependencies = {
    authVerifier: new FakeAuthVerifier(),
    identityRepository: new FakeIdentityRepository(),
  }
  const app = await buildApp({
    environment: parseApiEnv({ RUNTIME_MODE: 'offline', NODE_ENV: 'test' }),
    identityDependencies,
    logger: false,
  })
  apps.push(app)
  return app
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()))
})

describe('authentication and workspace authorization', () => {
  it('rejects requests without a bearer token', async () => {
    const app = await createTestApp()
    const response = await app.inject({ method: 'GET', url: '/v1/auth/session' })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toMatchObject({ error: 'authentication_required' })
  })

  it('returns the verified profile and memberships for a valid token', async () => {
    const app = await createTestApp()
    const response = await app.inject({
      method: 'GET',
      url: '/v1/auth/session',
      headers: { authorization: 'Bearer admin-token' },
    })
    const payload = authSessionResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(200)
    expect(payload.user.email).toBe('admin@demo.grounddesk.app')
    expect(payload.memberships[0]?.role).toBe('admin')
  })

  it('does not reveal whether an inaccessible workspace exists', async () => {
    const app = await createTestApp()
    const response = await app.inject({
      method: 'GET',
      url: `/v1/workspaces/${OTHER_WORKSPACE_ID}/access`,
      headers: { authorization: 'Bearer agent-token' },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({
      error: 'permission_denied',
      message: 'You do not have permission to access this resource.',
    })
  })

  it('returns role-derived permissions for a workspace member', async () => {
    const app = await createTestApp()
    const response = await app.inject({
      method: 'GET',
      url: `/v1/workspaces/${DEMO_WORKSPACE_ID}/access`,
      headers: { authorization: 'Bearer agent-token' },
    })
    const payload = workspaceAccessResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(200)
    expect(payload.role).toBe('agent')
    expect(payload.permissions).toContain('tickets:reply')
    expect(payload.permissions).not.toContain('settings:manage')
  })

  it('allows only administrators through the settings permission guard', async () => {
    const app = await createTestApp()
    const agentResponse = await app.inject({
      method: 'GET',
      url: `/v1/workspaces/${DEMO_WORKSPACE_ID}/settings-access`,
      headers: { authorization: 'Bearer agent-token' },
    })
    const adminResponse = await app.inject({
      method: 'GET',
      url: `/v1/workspaces/${DEMO_WORKSPACE_ID}/settings-access`,
      headers: { authorization: 'Bearer admin-token' },
    })

    expect(agentResponse.statusCode).toBe(403)
    expect(adminResponse.statusCode).toBe(200)
    expect(adminResponse.json()).toEqual({ workspaceId: DEMO_WORKSPACE_ID, allowed: true })
  })
})
