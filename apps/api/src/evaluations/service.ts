import type {
  EvaluationCase,
  EvaluationResult,
  EvaluationRun,
  PublicEvaluationSummary,
} from '@grounddesk/shared'

import { EvaluationConflictError, EvaluationNotFoundError } from './errors.js'
import type { EvaluationExecutionContext, EvaluationExecutor } from './executor.js'
import type { EvaluationRepository } from './repository.js'
import { calculateEvaluationMetrics, scoreOutcome } from './scoring.js'

export interface EvaluationRunDetail {
  run: EvaluationRun
  results: EvaluationResult[]
}

export interface EvaluationService {
  latestPublic(workspaceSlug: string): Promise<PublicEvaluationSummary | null>
  listCases(workspaceId: string): Promise<EvaluationCase[]>
  listRuns(workspaceId: string): Promise<EvaluationRun[]>
  detail(workspaceId: string, runId: string): Promise<EvaluationRunDetail>
  startRun(
    workspaceId: string,
    workspaceSlug: string,
    userId: string,
    providerMode: 'mock' | 'live',
  ): Promise<EvaluationRun>
  waitForIdle(): Promise<void>
  close(): Promise<void>
}

export class DefaultEvaluationService implements EvaluationService {
  private readonly jobs = new Map<string, Promise<void>>()

  constructor(
    private readonly repository: EvaluationRepository,
    private readonly mockExecutor: EvaluationExecutor,
    private readonly liveExecutor: EvaluationExecutor,
    private readonly gitCommitSha: string | null,
  ) {}

  latestPublic(workspaceSlug: string): Promise<PublicEvaluationSummary | null> {
    return this.repository.latestPublic(workspaceSlug)
  }

  listCases(workspaceId: string): Promise<EvaluationCase[]> {
    return this.repository.listCases(workspaceId)
  }

  listRuns(workspaceId: string): Promise<EvaluationRun[]> {
    return this.repository.listRuns(workspaceId)
  }

  async detail(workspaceId: string, runId: string): Promise<EvaluationRunDetail> {
    const run = await this.repository.getRun(workspaceId, runId)
    if (!run) throw new EvaluationNotFoundError()
    return { run, results: await this.repository.listResults(workspaceId, runId) }
  }

  async startRun(
    workspaceId: string,
    workspaceSlug: string,
    userId: string,
    providerMode: 'mock' | 'live',
  ): Promise<EvaluationRun> {
    const cases = (await this.repository.listCases(workspaceId)).filter(
      (evaluationCase) => evaluationCase.enabled,
    )
    if (cases.length < 24 || cases.length > 30) {
      throw new EvaluationConflictError(
        `Evaluation requires 24-30 enabled cases; found ${cases.length}.`,
      )
    }
    const run = await this.repository.createRun(
      workspaceId,
      userId,
      providerMode,
      this.gitCommitSha,
    )
    const context: EvaluationExecutionContext = { workspaceId, workspaceSlug, userId }
    const job = this.executeRun(run, cases, context).finally(() => this.jobs.delete(run.id))
    this.jobs.set(run.id, job)
    return run
  }

  async waitForIdle(): Promise<void> {
    await Promise.all(this.jobs.values())
  }

  async close(): Promise<void> {
    await this.waitForIdle()
    await this.repository.close()
  }

  private async executeRun(
    run: EvaluationRun,
    cases: EvaluationCase[],
    context: EvaluationExecutionContext,
  ): Promise<void> {
    try {
      await this.repository.markRunning(context.workspaceId, run.id)
      const executor = run.providerMode === 'live' ? this.liveExecutor : this.mockExecutor
      const results: Array<Omit<EvaluationResult, 'id'>> = []
      for (const evaluationCase of cases) {
        let actual: Record<string, unknown>
        try {
          actual = await executor.execute(evaluationCase, context)
        } catch (cause) {
          actual = {
            errorType: cause instanceof Error ? cause.name : 'unknown_error',
            errorMessage:
              cause instanceof Error ? cause.message.slice(0, 240) : 'Execution failed.',
          }
        }
        const result = scoreOutcome(evaluationCase, actual)
        await this.repository.saveResult(context.workspaceId, run.id, result)
        results.push(result)
      }
      await this.repository.completeRun(
        context.workspaceId,
        run.id,
        calculateEvaluationMetrics(cases, results),
      )
    } catch (cause) {
      await this.repository.failRun(context.workspaceId, run.id)
      throw cause
    }
  }
}
