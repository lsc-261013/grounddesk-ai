import type { Sql } from 'postgres'

import {
  chatCitationSchema,
  conversationDetailSchema,
  conversationSummarySchema,
  ticketToolTraceSchema,
  type ChatCitation,
  type ConversationDetail,
  type ConversationSummary,
  type TicketToolTrace,
} from '@grounddesk/shared'

import {
  closeRepositoryDatabase,
  createRepositoryDatabase,
  type DatabaseSource,
} from '../db/client.js'
import type {
  ConversationAccess,
  ConversationListResult,
  ConversationRepository,
} from './repository.js'

interface SummaryRow {
  id: string
  locale: string
  status: string
  source: string
  messageCount: number
  latestMessage: string | null
  lastIntent: string | null
  refused: boolean
  handedOff: boolean
  ticketId: string | null
  startedAt: Date
  updatedAt: Date
}

interface MessageRow {
  id: string
  role: 'user' | 'assistant' | 'tool' | 'system'
  content: string
  intent: string | null
  refused: boolean
  handedOff: boolean
  firstTokenLatencyMs: number | null
  totalLatencyMs: number | null
  inputTokens: number | null
  outputTokens: number | null
  estimatedCostUsd: string | null
  createdAt: Date
}

interface CitationRow {
  messageId: string
  ordinal: number
  chunkId: string
  documentId: string
  documentTitle: string
  sectionPath: string[]
  pageStart: number | null
  pageEnd: number | null
  quote: string
}

interface ToolRow {
  id: string
  toolName: 'order_lookup' | 'return_eligibility'
  status: 'started' | 'succeeded' | 'not_found' | 'forbidden' | 'failed'
  argumentsRedacted: unknown
  resultSummary: unknown
  durationMs: number | null
  errorType: string | null
  createdAt: Date
}

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

const mapSummary = (row: SummaryRow): ConversationSummary =>
  conversationSummarySchema.parse({
    ...row,
    startedAt: row.startedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  })

export class PostgresConversationRepository implements ConversationRepository {
  constructor(private readonly database: Sql) {}

  private async summaries(
    workspaceId: string,
    access: ConversationAccess,
    conversationId?: string,
  ): Promise<SummaryRow[]> {
    const idFilter = conversationId
      ? this.database`and conversation.id = ${conversationId}`
      : this.database``
    return this.database<SummaryRow[]>`
      select conversation.id, conversation.locale, conversation.status,
        conversation.source, conversation.started_at as "startedAt",
        conversation.updated_at as "updatedAt",
        (select count(*)::integer from public.messages message
          where message.conversation_id = conversation.id) as "messageCount",
        (select message.content from public.messages message
          where message.conversation_id = conversation.id
          order by message.created_at desc, message.id desc limit 1) as "latestMessage",
        (select message.intent::text from public.messages message
          where message.conversation_id = conversation.id and message.intent is not null
          order by message.created_at desc, message.id desc limit 1) as "lastIntent",
        coalesce((select bool_or(message.refused) from public.messages message
          where message.conversation_id = conversation.id), false) as refused,
        coalesce((select bool_or(message.handed_off) from public.messages message
          where message.conversation_id = conversation.id), false) as "handedOff",
        (select ticket.id from public.tickets ticket
          where ticket.conversation_id = conversation.id limit 1) as "ticketId"
      from public.conversations conversation
      where conversation.workspace_id = ${workspaceId}
        and conversation.source <> 'evaluation'
        ${idFilter}
        and (
          ${access.role} <> 'agent'
          or exists (
            select 1 from public.tickets ticket
            where ticket.conversation_id = conversation.id and ticket.assigned_to = ${access.userId}
          )
        )
      order by conversation.updated_at desc, conversation.id
    `
  }

  async list(workspaceId: string, access: ConversationAccess): Promise<ConversationListResult> {
    const rows = await this.summaries(workspaceId, access)
    return { conversations: rows.map(mapSummary), total: rows.length }
  }

  async get(
    workspaceId: string,
    conversationId: string,
    access: ConversationAccess,
  ): Promise<ConversationDetail | null> {
    const summaryRow = (await this.summaries(workspaceId, access, conversationId))[0]
    if (!summaryRow) return null
    const [messageRows, citationRows, toolRows] = await Promise.all([
      this.database<MessageRow[]>`
        select id, role::text, content, intent::text, refused, handed_off as "handedOff",
          first_token_latency_ms as "firstTokenLatencyMs", total_latency_ms as "totalLatencyMs",
          input_tokens::integer as "inputTokens", output_tokens::integer as "outputTokens",
          estimated_cost_usd::text as "estimatedCostUsd", created_at as "createdAt"
        from public.messages
        where workspace_id = ${workspaceId} and conversation_id = ${conversationId}
        order by created_at, id
      `,
      this.database<CitationRow[]>`
        select citation.message_id as "messageId", citation.ordinal::integer,
          chunk.id as "chunkId", document.id as "documentId", document.title as "documentTitle",
          chunk.section_path as "sectionPath", chunk.page_start as "pageStart",
          chunk.page_end as "pageEnd", citation.quote
        from public.message_citations citation
        join public.messages message on message.id = citation.message_id
        join public.knowledge_chunks chunk on chunk.id = citation.chunk_id
        join public.knowledge_documents document on document.id = chunk.document_id
        where citation.workspace_id = ${workspaceId} and message.conversation_id = ${conversationId}
        order by message.created_at, citation.ordinal
      `,
      this.database<ToolRow[]>`
        select id, tool_name as "toolName", status, arguments_redacted as "argumentsRedacted",
          result_summary as "resultSummary", duration_ms as "durationMs", error_type as "errorType",
          created_at as "createdAt"
        from public.tool_calls
        where workspace_id = ${workspaceId} and conversation_id = ${conversationId}
        order by created_at, id
      `,
    ])
    const citations = new Map<string, ChatCitation[]>()
    for (const row of citationRows) {
      const citation = chatCitationSchema.parse(row)
      citations.set(row.messageId, [...(citations.get(row.messageId) ?? []), citation])
    }
    const tools: TicketToolTrace[] = toolRows.map((row) =>
      ticketToolTraceSchema.parse({
        ...row,
        argumentsRedacted: asRecord(row.argumentsRedacted),
        resultSummary: row.resultSummary === null ? null : asRecord(row.resultSummary),
        createdAt: row.createdAt.toISOString(),
      }),
    )
    return conversationDetailSchema.parse({
      ...mapSummary(summaryRow),
      messages: messageRows.map((row) => ({
        ...row,
        estimatedCostUsd: row.estimatedCostUsd === null ? null : Number(row.estimatedCostUsd),
        citations: citations.get(row.id) ?? [],
        createdAt: row.createdAt.toISOString(),
      })),
      tools,
    })
  }

  async close(): Promise<void> {
    await closeRepositoryDatabase(this.database)
  }
}

export const createPostgresConversationRepository = (
  source: DatabaseSource,
): ConversationRepository =>
  new PostgresConversationRepository(
    createRepositoryDatabase(source, {
      max: 4,
      applicationName: 'grounddesk-conversations',
    }),
  )
