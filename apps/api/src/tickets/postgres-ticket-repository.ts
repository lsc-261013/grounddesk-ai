import postgres, { type Sql } from 'postgres'

import {
  agentIntentSchema,
  chatCitationSchema,
  localeSchema,
  ticketConversationMessageSchema,
  ticketDetailSchema,
  ticketPrioritySchema,
  ticketReplySchema,
  ticketStatusSchema,
  ticketSummarySchema,
  ticketToolTraceSchema,
  type ChatCitation,
  type TicketAssignee,
  type TicketDetail,
  type TicketSummary,
} from '@grounddesk/shared'

import type { TicketAccess, TicketAssignmentUpdate, TicketRepository } from './repository.js'

interface TicketRow {
  id: string
  conversationId: string
  summary: string
  handoffReason: string
  priority: string
  status: string
  locale: string
  assignedToId: string | null
  assignedToName: string | null
  messageCount: number
  createdAt: Date
  firstResponseAt: Date | null
  resolvedAt: Date | null
  updatedAt: Date
}

interface ConversationMessageRow {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  intent: string | null
  refused: boolean
  handedOff: boolean
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

interface ReplyRow {
  id: string
  authorType: 'customer' | 'agent' | 'system'
  authorId: string | null
  authorName: string | null
  body: string
  createdAt: Date
}

type EvidenceRow = Omit<CitationRow, 'messageId' | 'ordinal'>

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

const mapCitation = (row: Omit<CitationRow, 'messageId'>): ChatCitation =>
  chatCitationSchema.parse(row)

const mapSummary = (row: TicketRow): TicketSummary =>
  ticketSummarySchema.parse({
    id: row.id,
    conversationId: row.conversationId,
    summary: row.summary,
    handoffReason: row.handoffReason,
    priority: ticketPrioritySchema.parse(row.priority),
    status: ticketStatusSchema.parse(row.status),
    locale: localeSchema.parse(row.locale),
    assignedTo:
      row.assignedToId && row.assignedToName
        ? { id: row.assignedToId, displayName: row.assignedToName }
        : null,
    messageCount: row.messageCount,
    createdAt: row.createdAt.toISOString(),
    firstResponseAt: row.firstResponseAt?.toISOString() ?? null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  })

export class PostgresTicketRepository implements TicketRepository {
  constructor(private readonly database: Sql) {}

  private async ticketRows(
    workspaceId: string,
    access: TicketAccess,
    ticketId?: string,
  ): Promise<TicketRow[]> {
    const ticketFilter = ticketId ? this.database`and ticket.id = ${ticketId}` : this.database``
    return this.database<TicketRow[]>`
      select
        ticket.id,
        ticket.conversation_id as "conversationId",
        ticket.summary,
        ticket.handoff_reason as "handoffReason",
        ticket.priority::text as priority,
        ticket.status::text as status,
        conversation.locale,
        assignee.id as "assignedToId",
        assignee.display_name as "assignedToName",
        (
          select count(*)::integer
          from public.messages message
          where message.conversation_id = ticket.conversation_id
        ) as "messageCount",
        ticket.created_at as "createdAt",
        ticket.first_response_at as "firstResponseAt",
        ticket.resolved_at as "resolvedAt",
        ticket.updated_at as "updatedAt"
      from public.tickets ticket
      join public.conversations conversation on conversation.id = ticket.conversation_id
      left join public.profiles assignee on assignee.id = ticket.assigned_to
      where ticket.workspace_id = ${workspaceId}
        ${ticketFilter}
        and conversation.source <> 'evaluation'
        and (${access.role} <> 'agent' or ticket.assigned_to = ${access.userId})
      order by
        case ticket.priority when 'urgent' then 1 when 'high' then 2 when 'normal' then 3 else 4 end,
        ticket.updated_at desc
    `
  }

  async listTickets(workspaceId: string, access: TicketAccess): Promise<TicketSummary[]> {
    return (await this.ticketRows(workspaceId, access)).map(mapSummary)
  }

  async getTicket(
    workspaceId: string,
    ticketId: string,
    access: TicketAccess,
  ): Promise<TicketDetail | null> {
    const row = (await this.ticketRows(workspaceId, access, ticketId))[0]
    if (!row) return null

    const [messageRows, citationRows, toolRows, replyRows, evidenceRows] = await Promise.all([
      this.database<ConversationMessageRow[]>`
        select id, role::text, content, intent::text, refused, handed_off as "handedOff",
          created_at as "createdAt"
        from public.messages
        where workspace_id = ${workspaceId} and conversation_id = ${row.conversationId}
        order by created_at, id
      `,
      this.database<CitationRow[]>`
        select citation.message_id as "messageId", citation.ordinal::integer, chunk.id as "chunkId",
          document.id as "documentId", document.title as "documentTitle", chunk.section_path as "sectionPath",
          chunk.page_start as "pageStart", chunk.page_end as "pageEnd", citation.quote
        from public.message_citations citation
        join public.knowledge_chunks chunk on chunk.id = citation.chunk_id
        join public.knowledge_documents document on document.id = chunk.document_id
        join public.messages message on message.id = citation.message_id
        where citation.workspace_id = ${workspaceId} and message.conversation_id = ${row.conversationId}
        order by message.created_at, citation.ordinal
      `,
      this.database<ToolRow[]>`
        select id, tool_name as "toolName", status::text, arguments_redacted as "argumentsRedacted",
          result_summary as "resultSummary", duration_ms as "durationMs", error_type as "errorType",
          created_at as "createdAt"
        from public.tool_calls
        where workspace_id = ${workspaceId} and conversation_id = ${row.conversationId}
        order by created_at, id
      `,
      this.database<ReplyRow[]>`
        select reply.id, reply.author_type as "authorType", author.id as "authorId",
          author.display_name as "authorName", reply.body, reply.created_at as "createdAt"
        from public.ticket_messages reply
        left join public.profiles author on author.id = reply.author_user_id
        where reply.workspace_id = ${workspaceId} and reply.ticket_id = ${ticketId}
        order by reply.created_at, reply.id
      `,
      this.database<EvidenceRow[]>`
        select chunk.id as "chunkId", document.id as "documentId", document.title as "documentTitle",
          chunk.section_path as "sectionPath", chunk.page_start as "pageStart",
          chunk.page_end as "pageEnd", left(chunk.content, 700) as quote
        from public.tickets ticket
        cross join unnest(ticket.evidence_chunk_ids) with ordinality evidence(chunk_id, ordinal)
        join public.knowledge_chunks chunk on chunk.id = evidence.chunk_id
        join public.knowledge_documents document on document.id = chunk.document_id
        where ticket.workspace_id = ${workspaceId} and ticket.id = ${ticketId}
        order by evidence.ordinal
      `,
    ])

    const citationsByMessage = new Map<string, ChatCitation[]>()
    for (const citation of citationRows) {
      const values = citationsByMessage.get(citation.messageId) ?? []
      values.push(mapCitation(citation))
      citationsByMessage.set(citation.messageId, values)
    }

    return ticketDetailSchema.parse({
      ...mapSummary(row),
      evidence: evidenceRows.map((evidence, index) =>
        mapCitation({ ...evidence, ordinal: index + 1 }),
      ),
      tools: toolRows.map((tool) =>
        ticketToolTraceSchema.parse({
          ...tool,
          argumentsRedacted: asRecord(tool.argumentsRedacted),
          resultSummary: tool.resultSummary === null ? null : asRecord(tool.resultSummary),
          createdAt: tool.createdAt.toISOString(),
        }),
      ),
      conversationMessages: messageRows.map((message) =>
        ticketConversationMessageSchema.parse({
          ...message,
          intent: message.intent ? agentIntentSchema.parse(message.intent) : null,
          citations: citationsByMessage.get(message.id) ?? [],
          createdAt: message.createdAt.toISOString(),
        }),
      ),
      replies: replyRows.map((reply) =>
        ticketReplySchema.parse({
          id: reply.id,
          authorType: reply.authorType,
          author:
            reply.authorId && reply.authorName
              ? { id: reply.authorId, displayName: reply.authorName }
              : null,
          body: reply.body,
          createdAt: reply.createdAt.toISOString(),
        }),
      ),
    })
  }

  async addReply(
    workspaceId: string,
    ticketId: string,
    access: TicketAccess,
    body: string,
  ): Promise<boolean> {
    return this.database.begin(async (transaction) => {
      const rows = await transaction<{ id: string }[]>`
        select ticket.id
        from public.tickets ticket
        where ticket.workspace_id = ${workspaceId} and ticket.id = ${ticketId}
          and ticket.status <> 'resolved'
          and (${access.role} <> 'agent' or ticket.assigned_to = ${access.userId})
        for update
      `
      if (!rows[0]) return false
      await transaction`
        insert into public.ticket_messages (workspace_id, ticket_id, author_user_id, author_type, body)
        values (${workspaceId}, ${ticketId}, ${access.userId}, 'agent', ${body})
      `
      await transaction`
        update public.tickets
        set first_response_at = coalesce(first_response_at, now()),
          status = case when status in ('open', 'waiting_customer') then 'in_progress' else status end,
          updated_at = now()
        where workspace_id = ${workspaceId} and id = ${ticketId}
      `
      return true
    })
  }

  async updateStatus(
    workspaceId: string,
    ticketId: string,
    access: TicketAccess,
    status: 'open' | 'in_progress' | 'waiting_customer' | 'resolved',
  ): Promise<boolean> {
    return this.database.begin(async (transaction) => {
      const rows = await transaction<{ conversationId: string }[]>`
        update public.tickets ticket
        set status = ${status}, resolved_at = case when ${status} = 'resolved' then now() else null end,
          updated_at = now()
        where ticket.workspace_id = ${workspaceId} and ticket.id = ${ticketId}
          and (${access.role} <> 'agent' or ticket.assigned_to = ${access.userId})
        returning conversation_id as "conversationId"
      `
      const conversationId = rows[0]?.conversationId
      if (!conversationId) return false
      await transaction`
        update public.conversations
        set status = ${status === 'resolved' ? 'closed' : 'handed_off'},
          closed_at = ${status === 'resolved' ? transaction`now()` : null}, updated_at = now()
        where workspace_id = ${workspaceId} and id = ${conversationId}
      `
      return true
    })
  }

  async updateAssignment(
    workspaceId: string,
    ticketId: string,
    update: TicketAssignmentUpdate,
  ): Promise<boolean> {
    if (update.assignedTo) {
      const members = await this.database<{ id: string }[]>`
        select profile.id
        from public.workspace_members member
        join public.profiles profile on profile.id = member.user_id
        where member.workspace_id = ${workspaceId} and member.user_id = ${update.assignedTo}
          and member.role = 'agent'
        limit 1
      `
      if (!members[0]) return false
    }
    const rows = await this.database<{ id: string }[]>`
      update public.tickets
      set assigned_to = ${update.assignedTo},
        priority = coalesce(${update.priority ?? null}::public.ticket_priority, priority),
        updated_at = now()
      where workspace_id = ${workspaceId} and id = ${ticketId}
      returning id
    `
    return rows.length === 1
  }

  async listAssignableAgents(workspaceId: string): Promise<TicketAssignee[]> {
    return this.database<TicketAssignee[]>`
      select profile.id, profile.display_name as "displayName"
      from public.workspace_members member
      join public.profiles profile on profile.id = member.user_id
      where member.workspace_id = ${workspaceId} and member.role = 'agent'
      order by profile.display_name, profile.id
    `
  }

  async close(): Promise<void> {
    await this.database.end({ timeout: 5 })
  }
}

export const createPostgresTicketRepository = (databaseUrl: string): TicketRepository =>
  new PostgresTicketRepository(
    postgres(databaseUrl, {
      max: 5,
      ssl: 'require',
      connection: { application_name: 'grounddesk-tickets' },
    }),
  )
