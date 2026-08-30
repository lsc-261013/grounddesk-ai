import { healthResponseSchema } from '@grounddesk/shared'
import { afterEach, describe, expect, it } from 'vitest'

import { buildApp } from '../src/app.js'
import { parseApiEnv } from '../src/config/env.js'

const apps: Awaited<ReturnType<typeof buildApp>>[] = []

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()))
})

describe('GET /health', () => {
  it('reports provider readiness without exposing secrets', async () => {
    const app = await buildApp({
      environment: parseApiEnv({ RUNTIME_MODE: 'offline', NODE_ENV: 'test' }),
      logger: false,
    })
    apps.push(app)

    const response = await app.inject({ method: 'GET', url: '/health' })
    const payload = healthResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(200)
    expect(payload.providers).toEqual({
      database: 'unconfigured',
      generation: 'unconfigured',
      embedding: 'unconfigured',
    })
    expect(response.body).not.toContain('key')
  })

  it('allows configured browser origins to preflight mutation routes', async () => {
    const app = await buildApp({
      environment: parseApiEnv({
        RUNTIME_MODE: 'offline',
        NODE_ENV: 'test',
        WEB_ORIGIN: 'http://localhost:5173',
      }),
      logger: false,
    })
    apps.push(app)

    const response = await app.inject({
      method: 'OPTIONS',
      url: '/v1/workspaces/11111111-1111-4111-8111-111111111111/tickets/test/assignment',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'PATCH',
        'access-control-request-headers': 'authorization,content-type',
      },
    })

    expect(response.statusCode).toBe(204)
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173')
    expect(response.headers['access-control-allow-methods']).toContain('PATCH')
    expect(response.headers['access-control-allow-methods']).toContain('DELETE')
  })
})
