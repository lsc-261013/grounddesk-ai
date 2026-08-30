import type { Sql } from 'postgres'

import { overviewMetricsSchema, type OverviewMetrics } from '@grounddesk/shared'

import {
  closeRepositoryDatabase,
  createRepositoryDatabase,
  type DatabaseSource,
} from '../db/client.js'
import type { AnalyticsRepository } from './repository.js'

interface MetricsRow {
  totalConversations: number
  assistantAnswers: number
  openTickets: number
  citationCoverageRate: number | null
  refusalRate: number | null
  handoffRate: number | null
  medianFirstTokenLatencyMs: number | null
  medianTotalLatencyMs: number | null
  totalTokens: number | null
  estimatedCostUsd: number | null
}

interface GapRow {
  query: string
  occurrenceCount: number
  lastSeenAt: Date
}

export class PostgresAnalyticsRepository implements AnalyticsRepository {
  constructor(private readonly database: Sql) {}

  async overview(workspaceId: string, periodDays: number): Promise<OverviewMetrics> {
    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1_000)
    const [metricRows, gapRows] = await Promise.all([
      this.database<MetricsRow[]>`
        with scoped_conversations as (
          select id
          from public.conversations
          where workspace_id = ${workspaceId}
            and source <> 'evaluation'
            and created_at >= ${since}
        ),
        scoped_answers as (
          select message.*
          from public.messages message
          join scoped_conversations conversation on conversation.id = message.conversation_id
          where message.role = 'assistant'
        ),
        factual_answers as (
          select message.id
          from scoped_answers message
          where message.intent = 'knowledge_answer' and not message.refused
        ),
        scoped_usage as (
          select usage.*
          from public.ai_usage_events usage
          join scoped_conversations conversation on conversation.id = usage.conversation_id
        )
        select
          (select count(*)::integer from scoped_conversations) as "totalConversations",
          (select count(*)::integer from scoped_answers) as "assistantAnswers",
          (
            select count(*)::integer
            from public.tickets ticket
            join scoped_conversations conversation on conversation.id = ticket.conversation_id
            where ticket.status <> 'resolved'
          ) as "openTickets",
          (
            select case when count(*) = 0 then null else
              count(*) filter (where exists (
                select 1 from public.message_citations citation where citation.message_id = answer.id
              ))::double precision / count(*)::double precision end
            from factual_answers answer
          ) as "citationCoverageRate",
          (
            select case when count(*) = 0 then null else
              count(*) filter (where refused)::double precision / count(*)::double precision end
            from scoped_answers
          ) as "refusalRate",
          (
            select case when count(*) = 0 then null else
              count(*) filter (where exists (
                select 1 from public.tickets ticket where ticket.conversation_id = conversation.id
              ))::double precision / count(*)::double precision end
            from scoped_conversations conversation
          ) as "handoffRate",
          (
            select round(percentile_cont(0.5) within group (order by first_token_latency_ms))::integer
            from scoped_answers where first_token_latency_ms is not null
          ) as "medianFirstTokenLatencyMs",
          (
            select round(percentile_cont(0.5) within group (order by total_latency_ms))::integer
            from scoped_answers where total_latency_ms is not null
          ) as "medianTotalLatencyMs",
          (select sum(total_tokens)::integer from scoped_usage) as "totalTokens",
          (select sum(estimated_cost_usd)::double precision from scoped_usage) as "estimatedCostUsd"
      `,
      this.database<GapRow[]>`
        select retrieval.query_text_redacted as query,
          count(*)::integer as "occurrenceCount", max(retrieval.created_at) as "lastSeenAt"
        from public.retrieval_logs retrieval
        join public.conversations conversation on conversation.id = retrieval.conversation_id
        where retrieval.workspace_id = ${workspaceId}
          and conversation.source <> 'evaluation'
          and retrieval.created_at >= ${since}
          and (retrieval.was_empty or retrieval.conflict_detected or cardinality(retrieval.final_chunk_ids) = 0)
        group by retrieval.query_text_redacted
        order by count(*) desc, max(retrieval.created_at) desc
        limit 5
      `,
    ])

    const metrics = metricRows[0]
    if (!metrics) throw new Error('Overview query returned no metrics.')
    return overviewMetricsSchema.parse({
      ...metrics,
      periodDays,
      estimatedCostUsd:
        metrics.estimatedCostUsd === null ? null : Number(metrics.estimatedCostUsd.toFixed(6)),
      knowledgeGaps: gapRows.map((gap) => ({
        ...gap,
        lastSeenAt: gap.lastSeenAt.toISOString(),
      })),
    })
  }

  async close(): Promise<void> {
    await closeRepositoryDatabase(this.database)
  }
}

export const createPostgresAnalyticsRepository = (source: DatabaseSource): AnalyticsRepository =>
  new PostgresAnalyticsRepository(
    createRepositoryDatabase(source, {
      max: 3,
      applicationName: 'grounddesk-analytics',
    }),
  )
