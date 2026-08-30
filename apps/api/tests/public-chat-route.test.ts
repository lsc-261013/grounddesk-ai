import { afterEach, describe, expect, it } from 'vitest'

import type { ChatStreamEvent } from '@grounddesk/shared'

import type { AgentDependencies } from '../src/agent/dependencies.js'
import type { AgentService } from '../src/agent/service.js'
import { buildApp } from '../src/app.js'
import { parseApiEnv } from '../src/config/env.js'

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

  submitFeedback(): Promise<boolean> {
    return Promise.resolve(true)
  }

  close(): Promise<void> {
    return Promise.resolve()
  }
}

const apps: Awaited<ReturnType<typeof buildApp>>[] = []

const createApp = async () => {
  const dependencies: AgentDependencies = { agentService: new StreamingAgentService() }
  const app = await buildApp({
    environment: parseApiEnv({ RUNTIME_MODE: 'offline', NODE_ENV: 'test' }),
    agentDependencies: dependencies,
    logger: false,
  })
  apps.push(app)
  return app
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
})
