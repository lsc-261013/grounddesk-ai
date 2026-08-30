import type { JSONValue, Sql } from 'postgres'

import {
  evaluationCaseSchema,
  evaluationMetricsSchema,
  evaluationResultSchema,
  evaluationRunSchema,
  publicEvaluationSummarySchema,
  type EvaluationCase,
  type EvaluationMetrics,
  type EvaluationResult,
  type EvaluationRun,
  type PublicEvaluationSummary,
} from '@grounddesk/shared'

import {
  closeRepositoryDatabase,
  createRepositoryDatabase,
  type DatabaseSource,
} from '../db/client.js'
import type { EvaluationRepository, IsolationProbeInput } from './repository.js'

interface CaseRow {
  id: string
  caseKey: string
  category: string
  locale: string
  input: unknown
  expected: unknown
  enabled: boolean
}

interface RunRow {
  id: string
  status: string
  providerMode: 'mock' | 'live'
  gitCommitSha: string | null
  startedAt: Date | null
  completedAt: Date | null
  summary: unknown
  createdAt: Date
}

interface ResultRow {
  id: string
  caseId: string
  caseKey: string
  category: string
  locale: string
  passed: boolean
  actual: unknown
  failures: string[]
  latencyMs: number | null
}

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

const jsonValue = (value: Record<string, unknown>): JSONValue =>
  JSON.parse(JSON.stringify(value)) as JSONValue

const mapCase = (row: CaseRow): EvaluationCase =>
  evaluationCaseSchema.parse({
    ...row,
    input: asRecord(row.input),
    expected: asRecord(row.expected),
  })

const mapRun = (row: RunRow): EvaluationRun =>
  evaluationRunSchema.parse({
    ...row,
    summary: row.summary === null ? null : evaluationMetricsSchema.parse(row.summary),
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  })

const mapResult = (row: ResultRow): EvaluationResult =>
  evaluationResultSchema.parse({ ...row, actual: asRecord(row.actual) })

const runSelection = `
  run.id,
  run.status::text as status,
  run.provider_mode as "providerMode",
  run.git_commit_sha as "gitCommitSha",
  run.started_at as "startedAt",
  run.completed_at as "completedAt",
  run.summary,
  run.created_at as "createdAt"
`

export class PostgresEvaluationRepository implements EvaluationRepository {
  constructor(private readonly database: Sql) {}

  async latestPublic(workspaceSlug: string): Promise<PublicEvaluationSummary | null> {
    const rows = await this.database<RunRow[]>`
      select ${this.database.unsafe(runSelection)}
      from public.eval_runs run
      join public.workspaces workspace on workspace.id = run.workspace_id
      where workspace.slug = ${workspaceSlug} and workspace.is_demo
        and run.provider_mode = 'live' and run.status = 'completed'
        and run.summary is not null and run.completed_at is not null
      order by run.completed_at desc
      limit 1
    `
    const run = rows[0] ? mapRun(rows[0]) : null
    if (!run?.summary || !run.completedAt) return null
    return publicEvaluationSummarySchema.parse({
      runId: run.id,
      completedAt: run.completedAt,
      metrics: run.summary,
    })
  }

  async listCases(workspaceId: string): Promise<EvaluationCase[]> {
    const rows = await this.database<CaseRow[]>`
      select id, case_key as "caseKey", category, locale, input, expected, enabled
      from public.eval_cases
      where workspace_id = ${workspaceId}
      order by category, case_key
    `
    return rows.map(mapCase)
  }

  async listRuns(workspaceId: string): Promise<EvaluationRun[]> {
    const rows = await this.database<RunRow[]>`
      select ${this.database.unsafe(runSelection)}
      from public.eval_runs run
      where run.workspace_id = ${workspaceId}
      order by run.created_at desc
      limit 30
    `
    return rows.map(mapRun)
  }

  async getRun(workspaceId: string, runId: string): Promise<EvaluationRun | null> {
    const rows = await this.database<RunRow[]>`
      select ${this.database.unsafe(runSelection)}
      from public.eval_runs run
      where run.workspace_id = ${workspaceId} and run.id = ${runId}
      limit 1
    `
    return rows[0] ? mapRun(rows[0]) : null
  }

  async listResults(workspaceId: string, runId: string): Promise<EvaluationResult[]> {
    const rows = await this.database<ResultRow[]>`
      select result.id, result.case_id as "caseId", evaluation_case.case_key as "caseKey",
        evaluation_case.category, evaluation_case.locale, result.passed, result.actual,
        result.failures, result.latency_ms as "latencyMs"
      from public.eval_results result
      join public.eval_cases evaluation_case on evaluation_case.id = result.case_id
      where result.workspace_id = ${workspaceId} and result.run_id = ${runId}
      order by evaluation_case.category, evaluation_case.case_key
    `
    return rows.map(mapResult)
  }

  async createRun(
    workspaceId: string,
    userId: string,
    providerMode: 'mock' | 'live',
    gitCommitSha: string | null,
  ): Promise<EvaluationRun> {
    const rows = await this.database<RunRow[]>`
      insert into public.eval_runs as run (
        workspace_id, status, provider_mode, git_commit_sha, created_by
      ) values (${workspaceId}, 'queued', ${providerMode}, ${gitCommitSha}, ${userId})
      returning ${this.database.unsafe(runSelection)}
    `
    const row = rows[0]
    if (!row) throw new Error('Evaluation run creation returned no result.')
    return mapRun(row)
  }

  async markRunning(workspaceId: string, runId: string): Promise<void> {
    await this.database`
      update public.eval_runs set status = 'running', started_at = now()
      where workspace_id = ${workspaceId} and id = ${runId}
    `
  }

  async saveResult(
    workspaceId: string,
    runId: string,
    result: Omit<EvaluationResult, 'id'>,
  ): Promise<void> {
    await this.database`
      insert into public.eval_results (
        workspace_id, run_id, case_id, passed, actual, failures, latency_ms
      ) values (
        ${workspaceId}, ${runId}, ${result.caseId}, ${result.passed},
        ${this.database.json(jsonValue(result.actual))}, ${result.failures}, ${result.latencyMs}
      )
      on conflict (run_id, case_id) do update set
        passed = excluded.passed, actual = excluded.actual, failures = excluded.failures,
        latency_ms = excluded.latency_ms
    `
  }

  async completeRun(workspaceId: string, runId: string, summary: EvaluationMetrics): Promise<void> {
    await this.database`
      update public.eval_runs set status = 'completed', completed_at = now(),
        summary = ${this.database.json(jsonValue(summary))}
      where workspace_id = ${workspaceId} and id = ${runId}
    `
  }

  async failRun(workspaceId: string, runId: string): Promise<void> {
    await this.database`
      update public.eval_runs set status = 'failed', completed_at = now()
      where workspace_id = ${workspaceId} and id = ${runId}
    `
  }

  async probeIsolation(input: IsolationProbeInput): Promise<Record<string, unknown>> {
    const membership = await this.database<{ exists: boolean }[]>`
      select exists(
        select 1 from public.workspace_members
        where workspace_id = ${input.targetWorkspaceId} and user_id = ${input.userId}
      ) as exists
    `
    const markerChecks =
      input.resource === 'orders'
        ? await this.database<{ targetHasData: boolean; leaked: boolean }[]>`
            select
              exists(select 1 from public.orders where workspace_id = ${input.targetWorkspaceId}
                and order_number = ${input.marker}) as "targetHasData",
              exists(select 1 from public.orders where workspace_id = ${input.authorizedWorkspaceId}
                and order_number = ${input.marker}) as leaked
          `
        : await this.database<{ targetHasData: boolean; leaked: boolean }[]>`
            select
              exists(select 1 from public.products where workspace_id = ${input.targetWorkspaceId}
                and specs::text like ${`%${input.marker}%`}) as "targetHasData",
              exists(select 1 from public.products where workspace_id = ${input.authorizedWorkspaceId}
                and specs::text like ${`%${input.marker}%`}) as leaked
          `
    return {
      leaked: markerChecks[0]?.leaked ?? false,
      targetHasData: markerChecks[0]?.targetHasData ?? false,
      memberHasAccess: membership[0]?.exists ?? false,
    }
  }

  async close(): Promise<void> {
    await closeRepositoryDatabase(this.database)
  }
}

export const createPostgresEvaluationRepository = (source: DatabaseSource): EvaluationRepository =>
  new PostgresEvaluationRepository(
    createRepositoryDatabase(source, {
      max: 3,
      applicationName: 'grounddesk-evaluations',
    }),
  )
