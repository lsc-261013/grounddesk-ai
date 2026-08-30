import type { Sql } from 'postgres'

import { ServiceUnavailableError } from '../auth/errors.js'
import type { AgentService } from '../agent/service.js'
import type { ApiEnv } from '../config/env.js'
import { LiveEvaluationExecutor, MockEvaluationExecutor } from './executor.js'
import { createPostgresEvaluationRepository } from './postgres-evaluation-repository.js'
import { DefaultEvaluationService, type EvaluationService } from './service.js'

export interface EvaluationDependencies {
  evaluationService: EvaluationService
}

class UnavailableEvaluationService implements EvaluationService {
  private unavailable(): ServiceUnavailableError {
    return new ServiceUnavailableError('Evaluations are unavailable in offline mode.')
  }
  latestPublic(): ReturnType<EvaluationService['latestPublic']> {
    return Promise.reject(this.unavailable())
  }
  listCases(): ReturnType<EvaluationService['listCases']> {
    return Promise.reject(this.unavailable())
  }
  listRuns(): ReturnType<EvaluationService['listRuns']> {
    return Promise.reject(this.unavailable())
  }
  detail(): ReturnType<EvaluationService['detail']> {
    return Promise.reject(this.unavailable())
  }
  startRun(): ReturnType<EvaluationService['startRun']> {
    return Promise.reject(this.unavailable())
  }
  waitForIdle(): Promise<void> {
    return Promise.resolve()
  }
  close(): Promise<void> {
    return Promise.resolve()
  }
}

export const createEvaluationDependencies = (
  environment: ApiEnv,
  agentService: AgentService,
  database?: Sql,
): EvaluationDependencies => {
  if (environment.RUNTIME_MODE !== 'connected' || !environment.SUPABASE_DB_URL) {
    return { evaluationService: new UnavailableEvaluationService() }
  }
  const repository = createPostgresEvaluationRepository(database ?? environment.SUPABASE_DB_URL)
  return {
    evaluationService: new DefaultEvaluationService(
      repository,
      new MockEvaluationExecutor(repository),
      new LiveEvaluationExecutor(agentService, repository),
      process.env.RENDER_GIT_COMMIT ?? process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    ),
  }
}
