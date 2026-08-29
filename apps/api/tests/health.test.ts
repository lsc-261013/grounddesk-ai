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
})
