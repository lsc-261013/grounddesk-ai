import { overviewMetricsResponseSchema } from '@grounddesk/shared'
import { afterEach, describe, expect, it } from 'vitest'

import type { AnalyticsDependencies } from '../src/analytics/dependencies.js'
import type { AnalyticsRepository } from '../src/analytics/repository.js'
import { buildApp } from '../src/app.js'
import type { IdentityDependencies } from '../src/auth/types.js'
import { parseApiEnv } from '../src/config/env.js'

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

class FakeAnalyticsRepository implements AnalyticsRepository {
  overview(): ReturnType<AnalyticsRepository['overview']> {
    return Promise.resolve({
      periodDays: 30,
      totalConversations: 7,
      assistantAnswers: 9,
      openTickets: 2,
      citationCoverageRate: 1,
      refusalRate: 0.2,
      handoffRate: 0.25,
      medianFirstTokenLatencyMs: 420,
      medianTotalLatencyMs: 1_840,
      totalTokens: 12_500,
      estimatedCostUsd: 0.0132,
      knowledgeGaps: [],
    })
  }

  close(): Promise<void> {
    return Promise.resolve()
  }
}

const identityDependencies: IdentityDependencies = {
  authVerifier: {
    verifyAccessToken: () => Promise.resolve({ userId: USER_ID, email: 'admin@example.com' }),
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
              role: 'admin',
            }
          : null,
      ),
    close: () => Promise.resolve(),
  },
}

const analyticsDependencies: AnalyticsDependencies = {
  analyticsRepository: new FakeAnalyticsRepository(),
}

const apps: Awaited<ReturnType<typeof buildApp>>[] = []

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()))
})

describe('overview route', () => {
  it('returns calculated metrics only after workspace authorization', async () => {
    const app = await buildApp({
      environment: parseApiEnv({ RUNTIME_MODE: 'offline', NODE_ENV: 'test' }),
      identityDependencies,
      analyticsDependencies,
      logger: false,
    })
    apps.push(app)

    const response = await app.inject({
      method: 'GET',
      url: `/v1/workspaces/${WORKSPACE_ID}/overview`,
      headers: { authorization: 'Bearer valid' },
    })
    const payload = overviewMetricsResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(200)
    expect(payload.metrics).toMatchObject({
      totalConversations: 7,
      citationCoverageRate: 1,
      estimatedCostUsd: 0.0132,
    })
  })
})
