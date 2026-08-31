import { afterEach, describe, expect, it } from 'vitest'

import type { ChatStreamEvent } from '@grounddesk/shared'

import type { AgentDependencies } from '../src/agent/dependencies.js'
import type { AgentService } from '../src/agent/service.js'
import { buildApp } from '../src/app.js'
import type { IdentityDependencies } from '../src/auth/types.js'
import { parseApiEnv } from '../src/config/env.js'

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111'
const CONVERSATION_ID = '70000000-0000-4000-8000-000000000001'
const MESSAGE_ID = '80000000-0000-4000-8000-000000000001'

class StreamingAgentService implements AgentService {
  openPublicChat(): Promise<{
    conversationId: string
    events: AsyncGenerator<ChatStreamEvent, void, undefined>
  }> {
    const events = async function* (): AsyncGenerator<ChatStreamEvent, void, undefined> {
      await Promise.resolve()
      yield { type: 'session', conversationId: CONVERSATION_ID }
      yield { type: 'stage', stage: 'understanding', status: 'active' }
      yield { type: 'token', delta: 'Grounded answer [1].' }
      yield {
        type: 'done',
        messageId: MESSAGE_ID,
        intent: 'knowledge_answer',
        refused: false,
        handedOff: false,
      }
    }
    return Promise.resolve({ conversationId: CONVERSATION_ID, events: events() })
  }

  openWorkspaceChat(): ReturnType<AgentService['openWorkspaceChat']> {
    return this.openPublicChat()
  }

  submitFeedback(): Promise<boolean> {
    return Promise.resolve(true)
  }

  submitWorkspaceFeedback(): Promise<boolean> {
    return Promise.resolve(true)
  }

  close(): Promise<void> {
    return Promise.resolve()
  }
}

const apps: Awaited<ReturnType<typeof buildApp>>[] = []

const createApp = async (environmentOverrides: NodeJS.ProcessEnv = {}) => {
  const dependencies: AgentDependencies = { agentService: new StreamingAgentService() }
  const app = await buildApp({
    environment: parseApiEnv({
      RUNTIME_MODE: 'offline',
      NODE_ENV: 'test',
      ...environmentOverrides,
    }),
    agentDependencies: dependencies,
    logger: false,
  })
  apps.push(app)
  return app
}

async function injectPublicChat(app: Awaited<ReturnType<typeof buildApp>>, sessionId: string) {
  return app.inject({
    method: 'POST',
    url: '/v1/public/workspaces/avenlo-demo/chat/stream',
    payload: { sessionId, message: 'What is the return window?', locale: 'en-US' },
  })
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()))
})

describe('public chat SSE route', () => {
  it('streams observable events using the public schema', async () => {
    const app = await createApp()
    const response = await app.inject({
      method: 'POST',
      url: '/v1/public/workspaces/avenlo-demo/chat/stream',
      headers: { origin: 'http://localhost:5173' },
      payload: {
        sessionId: '90000000-0000-4000-8000-000000000001',
        message: 'What is the return window?',
        locale: 'en-US',
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('text/event-stream')
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173')
    expect(response.headers['access-control-allow-credentials']).toBe('true')
    expect(response.body).toContain('"stage":"understanding"')
    expect(response.body).toContain('Grounded answer [1].')
    expect(response.body).not.toContain('reasoning_content')
  })

  it('protects the workspace playground and preserves SSE CORS headers', async () => {
    const identityDependencies: IdentityDependencies = {
      authVerifier: {
        verifyAccessToken: () =>
          Promise.resolve({
            userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            email: 'agent@example.com',
          }),
      },
      identityRepository: {
        getProfile: () => Promise.resolve(null),
        listMemberships: () => Promise.resolve([]),
        getMembership: (_userId, workspaceId) =>
          Promise.resolve(
            workspaceId === WORKSPACE_ID
              ? {
                  workspace: {
                    id: WORKSPACE_ID,
                    name: 'Avenlo Demo Workspace',
                    slug: 'avenlo-demo',
                    isDemo: true,
                  },
                  role: 'agent',
                }
              : null,
          ),
        close: () => Promise.resolve(),
      },
    }
    const dependencies: AgentDependencies = { agentService: new StreamingAgentService() }
    const app = await buildApp({
      environment: parseApiEnv({ RUNTIME_MODE: 'offline', NODE_ENV: 'test' }),
      identityDependencies,
      agentDependencies: dependencies,
      logger: false,
    })
    apps.push(app)
    const payload = {
      sessionId: '90000000-0000-4000-8000-000000000001',
      message: 'What is the return window?',
      locale: 'en-US',
    }

    const denied = await app.inject({
      method: 'POST',
      url: `/v1/workspaces/${WORKSPACE_ID}/playground/stream`,
      payload,
    })
    const response = await app.inject({
      method: 'POST',
      url: `/v1/workspaces/${WORKSPACE_ID}/playground/stream`,
      headers: {
        authorization: 'Bearer valid',
        origin: 'http://localhost:5173',
      },
      payload,
    })

    expect(denied.statusCode).toBe(401)
    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('text/event-stream')
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173')
    expect(response.body).toContain('Grounded answer [1].')
  })

  it('rejects malformed public input before opening a stream', async () => {
    const app = await createApp()
    const response = await app.inject({
      method: 'POST',
      url: '/v1/public/workspaces/avenlo-demo/chat/stream',
      payload: { sessionId: 'not-a-uuid', message: '', locale: 'en-US' },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ error: 'validation_failed' })
  })

  it('accepts feedback only through the validated public message boundary', async () => {
    const app = await createApp()
    const response = await app.inject({
      method: 'POST',
      url: '/v1/public/workspaces/avenlo-demo/chat/feedback',
      payload: {
        sessionId: '90000000-0000-4000-8000-000000000001',
        conversationId: CONVERSATION_ID,
        messageId: MESSAGE_ID,
        rating: 'helpful',
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ accepted: true })
  })

  it('limits repeated requests from the same browser session independently of its IP', async () => {
    const app = await createApp({
      PUBLIC_CHAT_RATE_LIMIT: '10',
      PUBLIC_CHAT_SESSION_RATE_LIMIT: '1',
      PUBLIC_CHAT_RATE_WINDOW_MS: '60000',
    })
    const first = await injectPublicChat(app, '90000000-0000-4000-8000-000000000001')
    const repeated = await injectPublicChat(app, '90000000-0000-4000-8000-000000000001')
    const independent = await injectPublicChat(app, '90000000-0000-4000-8000-000000000002')

    expect(first.statusCode).toBe(200)
    expect(repeated.statusCode).toBe(429)
    expect(repeated.json()).toMatchObject({ error: 'session_rate_limit_exceeded' })
    expect(independent.statusCode).toBe(200)
  })

  it('retains the separate IP limit even when sessions rotate', async () => {
    const app = await createApp({
      PUBLIC_CHAT_RATE_LIMIT: '1',
      PUBLIC_CHAT_SESSION_RATE_LIMIT: '10',
      PUBLIC_CHAT_RATE_WINDOW_MS: '60000',
    })
    const first = await injectPublicChat(app, '90000000-0000-4000-8000-000000000001')
    const rotated = await injectPublicChat(app, '90000000-0000-4000-8000-000000000002')

    expect(first.statusCode).toBe(200)
    expect(rotated.statusCode).toBe(429)
  })
})
