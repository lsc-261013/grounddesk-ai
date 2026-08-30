import postgres, { type Sql } from 'postgres'

import {
  conversationSourceSchema,
  localeSchema,
  type ChatCitation,
  type ConversationSource,
} from '@grounddesk/shared'

import type {
  AgentRepository,
  ConversationRecord,
  HandoffInput,
  PublicWorkspaceConfig,
  RetrievalLogInput,
  SaveAssistantMessageInput,
  ToolCallLogInput,
  UsageEventInput,
} from './repository.js'

interface WorkspaceRow {
  id: string
  slug: string
  confidenceThreshold: number
  isDemo: boolean
}

interface ConversationRow {
  id: string
  workspaceId: string
  locale: string
  status: 'active' | 'handed_off' | 'closed'
  source: string
}

const databaseToolStatus = (
  status: ToolCallLogInput['status'],
): 'succeeded' | 'not_found' | 'forbidden' | 'failed' =>
  status === 'email_mismatch' ? 'forbidden' : status

const toJsonValue = (value: Record<string, unknown>): postgres.JSONValue =>
  JSON.parse(JSON.stringify(value)) as postgres.JSONValue

class PostgresAgentRepository implements AgentRepository {
  constructor(private readonly database: Sql) {}

  async getPublicWorkspace(slug: string): Promise<PublicWorkspaceConfig | null> {
    const rows = await this.database<WorkspaceRow[]>`
      select
        id,
        slug,
        confidence_threshold::double precision as "confidenceThreshold",
        is_demo as "isDemo"
      from public.workspaces
      where slug = ${slug} and is_demo
      limit 1
    `
    return rows[0] ?? null
  }

  async getWorkspace(workspaceId: string): Promise<PublicWorkspaceConfig | null> {
    const rows = await this.database<WorkspaceRow[]>`
      select id, slug, confidence_threshold::double precision as "confidenceThreshold",
        is_demo as "isDemo"
      from public.workspaces
      where id = ${workspaceId}
      limit 1
    `
    return rows[0] ?? null
  }

  async reserveDemoRequest(
    workspaceId: string,
    requestLimit: number,
    tokenLimit: number,
  ): Promise<boolean> {
    const rows = await this.database<{ requestCount: number }[]>`
      insert into public.daily_demo_usage (workspace_id, request_count, token_count)
      values (${workspaceId}, 1, 0)
      on conflict (workspace_id, usage_date) do update
      set request_count = public.daily_demo_usage.request_count + 1,
          updated_at = now()
      where public.daily_demo_usage.request_count < ${requestLimit}
        and public.daily_demo_usage.token_count < ${tokenLimit}
      returning request_count::integer as "requestCount"
    `
    return rows.length === 1
  }

  async addDemoTokens(workspaceId: string, tokens: number): Promise<void> {
    await this.database`
      update public.daily_demo_usage
      set token_count = token_count + ${Math.max(0, tokens)}, updated_at = now()
      where workspace_id = ${workspaceId} and usage_date = current_date
    `
  }

  async getOrCreateConversation(input: {
    workspaceId: string
    sessionHash: string
    requestedConversationId: string | null
    locale: 'zh-CN' | 'en-US'
    source: ConversationSource
  }): Promise<ConversationRecord | null> {
    if (input.requestedConversationId) {
      const rows = await this.database<ConversationRow[]>`
        select id, workspace_id as "workspaceId", locale, status, source
        from public.conversations
        where id = ${input.requestedConversationId}
          and workspace_id = ${input.workspaceId}
          and anonymous_session_hash = ${input.sessionHash}
          and source = ${input.source}
        limit 1
      `
      const row = rows[0]
      return row
        ? {
            ...row,
            locale: localeSchema.parse(row.locale),
            source: conversationSourceSchema.parse(row.source),
          }
        : null
    }

    const rows = await this.database<ConversationRow[]>`
      insert into public.conversations (workspace_id, anonymous_session_hash, locale, source)
      values (${input.workspaceId}, ${input.sessionHash}, ${input.locale}, ${input.source})
      on conflict (workspace_id, anonymous_session_hash, source)
        where anonymous_session_hash is not null
      do update set locale = excluded.locale, updated_at = now()
      returning id, workspace_id as "workspaceId", locale, status, source
    `
    const row = rows[0]
    return row
      ? {
          ...row,
          locale: localeSchema.parse(row.locale),
          source: conversationSourceSchema.parse(row.source),
        }
      : null
  }

  async saveUserMessage(
    workspaceId: string,
    conversationId: string,
    content: string,
  ): Promise<string> {
    const rows = await this.database<{ id: string }[]>`
      insert into public.messages (workspace_id, conversation_id, role, content)
      values (${workspaceId}, ${conversationId}, 'user', ${content})
      returning id
    `
    const id = rows[0]?.id
    if (!id) throw new Error('The user message could not be persisted.')
    return id
  }

  async saveAssistantMessage(input: SaveAssistantMessageInput): Promise<string> {
    const rows = await this.database<{ id: string }[]>`
      insert into public.messages (
        workspace_id, conversation_id, role, content, intent, refused, handed_off,
        first_token_latency_ms, total_latency_ms, input_tokens, output_tokens,
        estimated_cost_usd, provider_request_id, error_type
      ) values (
        ${input.workspaceId}, ${input.conversationId}, 'assistant', ${input.content},
        ${input.intent}, ${input.refused}, ${input.handedOff}, ${input.firstTokenLatencyMs},
        ${input.totalLatencyMs}, ${input.usage.inputTokens}, ${input.usage.outputTokens},
        ${input.estimatedCostUsd}, ${input.providerRequestId}, ${input.errorType}
      )
      returning id
    `
    const id = rows[0]?.id
    if (!id) throw new Error('The assistant message could not be persisted.')
    return id
  }

  async saveCitations(
    workspaceId: string,
    messageId: string,
    citations: ChatCitation[],
  ): Promise<void> {
    for (const citation of citations) {
      await this.database`
        insert into public.message_citations (workspace_id, message_id, chunk_id, ordinal, quote)
        values (${workspaceId}, ${messageId}, ${citation.chunkId}, ${citation.ordinal}, ${citation.quote})
      `
    }
  }

  async saveRetrievalLog(input: RetrievalLogInput): Promise<void> {
    await this.database`
      insert into public.retrieval_logs (
        workspace_id, conversation_id, message_id, embedding_config_id,
        query_text_redacted, candidate_chunk_ids, final_chunk_ids, filters,
        was_empty, conflict_detected, duration_ms
      ) values (
        ${input.workspaceId}, ${input.conversationId}, ${input.messageId},
        ${input.embeddingConfigId}, ${input.queryTextRedacted}, ${input.candidateChunkIds},
        ${input.finalChunkIds}, ${this.database.json(toJsonValue(input.filters))}, ${input.wasEmpty},
        ${input.conflictDetected}, ${input.durationMs}
      )
    `
  }

  async saveToolCall(input: ToolCallLogInput): Promise<string> {
    const rows = await this.database<{ id: string }[]>`
      insert into public.tool_calls (
        workspace_id, conversation_id, message_id, tool_name, arguments_redacted,
        status, result_summary, duration_ms, error_type
      ) values (
        ${input.workspaceId}, ${input.conversationId}, ${input.messageId}, ${input.toolName},
        ${this.database.json(toJsonValue(input.argumentsRedacted))}, ${databaseToolStatus(input.status)},
        ${input.resultSummary ? this.database.json(toJsonValue(input.resultSummary)) : null},
        ${input.durationMs}, ${input.errorType}
      )
      returning id
    `
    const id = rows[0]?.id
    if (!id) throw new Error('The tool call could not be persisted.')
    return id
  }

  async createHandoff(input: HandoffInput): Promise<string> {
    return this.database.begin(async (transaction) => {
      const existing = await transaction<{ id: string }[]>`
        select id
        from public.tickets
        where workspace_id = ${input.workspaceId}
          and conversation_id = ${input.conversationId}
          and status <> 'resolved'
        order by created_at desc
        limit 1
      `
      let ticketId = existing[0]?.id
      if (!ticketId) {
        const inserted = await transaction<{ id: string }[]>`
          insert into public.tickets (
            workspace_id, conversation_id, summary, handoff_reason,
            evidence_chunk_ids, tool_call_ids, priority
          ) values (
            ${input.workspaceId}, ${input.conversationId}, ${input.summary}, ${input.reason},
            ${input.evidenceChunkIds}, ${input.toolCallIds}, ${input.priority}
          )
          returning id
        `
        ticketId = inserted[0]?.id
      }
      if (!ticketId) throw new Error('The handoff ticket could not be persisted.')
      await transaction`
        update public.conversations
        set status = 'handed_off', updated_at = now()
        where workspace_id = ${input.workspaceId} and id = ${input.conversationId}
      `
      return ticketId
    })
  }

  async saveUsageEvent(input: UsageEventInput): Promise<void> {
    await this.database`
      insert into public.ai_usage_events (
        workspace_id, conversation_id, provider, model, operation,
        input_tokens, output_tokens, total_tokens, estimated_cost_usd,
        first_token_latency_ms, total_latency_ms, provider_usage_available
      ) values (
        ${input.workspaceId}, ${input.conversationId}, ${input.provider}, ${input.model},
        'generation', ${input.usage.inputTokens}, ${input.usage.outputTokens},
        ${input.usage.totalTokens}, ${input.estimatedCostUsd}, ${input.firstTokenLatencyMs},
        ${input.totalLatencyMs}, ${input.usage.available}
      )
    `
  }

  async saveFeedback(input: {
    workspaceId: string
    sessionHash: string
    conversationId: string
    messageId: string
    rating: 'helpful' | 'unhelpful'
    comment: string | null
  }): Promise<boolean> {
    const rows = await this.database<{ id: string }[]>`
      insert into public.message_feedback (
        workspace_id, conversation_id, message_id, anonymous_session_hash, rating, comment
      )
      select conversation.workspace_id, conversation.id, message.id,
        conversation.anonymous_session_hash, ${input.rating}, ${input.comment}
      from public.conversations conversation
      join public.messages message on message.conversation_id = conversation.id
      where conversation.workspace_id = ${input.workspaceId}
        and conversation.id = ${input.conversationId}
        and conversation.anonymous_session_hash = ${input.sessionHash}
        and conversation.source <> 'evaluation'
        and message.id = ${input.messageId}
        and message.role = 'assistant'
      on conflict (message_id, anonymous_session_hash) do update set
        rating = excluded.rating, comment = excluded.comment, updated_at = now()
      returning id
    `
    return rows.length === 1
  }

  async close(): Promise<void> {
    await this.database.end({ timeout: 5 })
  }
}

export const createPostgresAgentRepository = (databaseUrl: string): AgentRepository =>
  new PostgresAgentRepository(
    postgres(databaseUrl, {
      max: 5,
      ssl: 'require',
      connection: { application_name: 'grounddesk-agent' },
    }),
  )
