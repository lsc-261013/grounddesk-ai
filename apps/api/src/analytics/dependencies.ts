import type { Sql } from 'postgres'

import type { ApiEnv } from '../config/env.js'
import { ServiceUnavailableError } from '../auth/errors.js'
import { createPostgresAnalyticsRepository } from './postgres-analytics-repository.js'
import type { AnalyticsRepository } from './repository.js'

class UnavailableAnalyticsRepository implements AnalyticsRepository {
  overview(): Promise<never> {
    return Promise.reject(new ServiceUnavailableError('Analytics are unavailable in offline mode.'))
  }

  close(): Promise<void> {
    return Promise.resolve()
  }
}

export interface AnalyticsDependencies {
  analyticsRepository: AnalyticsRepository
}

export const createAnalyticsDependencies = (
  environment: ApiEnv,
  database?: Sql,
): AnalyticsDependencies => ({
  analyticsRepository:
    environment.RUNTIME_MODE === 'connected' && environment.SUPABASE_DB_URL
      ? createPostgresAnalyticsRepository(database ?? environment.SUPABASE_DB_URL)
      : new UnavailableAnalyticsRepository(),
})
