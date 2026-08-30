import type {
  EvaluationCase,
  EvaluationMetrics,
  EvaluationResult,
  EvaluationRun,
  PublicEvaluationSummary,
} from '@grounddesk/shared'

export interface IsolationProbeInput {
  authorizedWorkspaceId: string
  targetWorkspaceId: string
  userId: string
  resource: 'orders' | 'products'
  marker: string
}

export interface EvaluationRepository {
  latestPublic(workspaceSlug: string): Promise<PublicEvaluationSummary | null>
  listCases(workspaceId: string): Promise<EvaluationCase[]>
  listRuns(workspaceId: string): Promise<EvaluationRun[]>
  getRun(workspaceId: string, runId: string): Promise<EvaluationRun | null>
  listResults(workspaceId: string, runId: string): Promise<EvaluationResult[]>
  createRun(
    workspaceId: string,
    userId: string,
    providerMode: 'mock' | 'live',
    gitCommitSha: string | null,
  ): Promise<EvaluationRun>
  markRunning(workspaceId: string, runId: string): Promise<void>
  saveResult(
    workspaceId: string,
    runId: string,
    result: Omit<EvaluationResult, 'id'>,
  ): Promise<void>
  completeRun(workspaceId: string, runId: string, summary: EvaluationMetrics): Promise<void>
  failRun(workspaceId: string, runId: string): Promise<void>
  probeIsolation(input: IsolationProbeInput): Promise<Record<string, unknown>>
  close(): Promise<void>
}
