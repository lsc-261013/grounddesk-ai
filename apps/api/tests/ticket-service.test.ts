import type { TicketAssignee, TicketDetail, TicketStatus, TicketSummary } from '@grounddesk/shared'
import { describe, expect, it } from 'vitest'

import type {
  TicketAccess,
  TicketAssignmentUpdate,
  TicketRepository,
} from '../src/tickets/repository.js'
import { DefaultTicketService } from '../src/tickets/service.js'

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111'
const TICKET_ID = '22222222-2222-4222-8222-222222222222'
const AGENT_ID = '33333333-3333-4333-8333-333333333333'
const access: TicketAccess = { userId: AGENT_ID, role: 'agent' }

const summary: TicketSummary = {
  id: TICKET_ID,
  conversationId: '44444444-4444-4444-8444-444444444444',
  summary: 'Customer requested human support.',
  handoffReason: 'user_requested_human',
  priority: 'normal',
  status: 'open',
  locale: 'en-US',
  assignedTo: { id: AGENT_ID, displayName: 'Demo Agent' },
  messageCount: 2,
  createdAt: '2026-08-30T00:00:00.000Z',
  firstResponseAt: null,
  resolvedAt: null,
  updatedAt: '2026-08-30T00:00:00.000Z',
}

class MemoryTicketRepository implements TicketRepository {
  ticket: TicketDetail = {
    ...summary,
    evidence: [],
    tools: [],
    conversationMessages: [],
    replies: [],
  }
  replyAllowed = true
  assignmentAllowed = true

  listTickets(): Promise<TicketSummary[]> {
    return Promise.resolve([this.ticket])
  }
  getTicket(): Promise<TicketDetail | null> {
    return Promise.resolve(this.ticket)
  }
  addReply(
    _workspace: string,
    _ticket: string,
    _access: TicketAccess,
    body: string,
  ): Promise<boolean> {
    if (!this.replyAllowed) return Promise.resolve(false)
    this.ticket.replies.push({
      id: '55555555-5555-4555-8555-555555555555',
      authorType: 'agent',
      author: summary.assignedTo,
      body,
      createdAt: '2026-08-30T00:01:00.000Z',
    })
    return Promise.resolve(true)
  }
  updateStatus(
    _workspace: string,
    _ticket: string,
    _access: TicketAccess,
    status: TicketStatus,
  ): Promise<boolean> {
    this.ticket.status = status
    return Promise.resolve(true)
  }
  updateAssignment(
    _workspace: string,
    _ticket: string,
    update: TicketAssignmentUpdate,
  ): Promise<boolean> {
    if (!this.assignmentAllowed) return Promise.resolve(false)
    this.ticket.assignedTo = update.assignedTo
      ? { id: update.assignedTo, displayName: 'Demo Agent' }
      : null
    if (update.priority) this.ticket.priority = update.priority
    return Promise.resolve(true)
  }
  listAssignableAgents(): Promise<TicketAssignee[]> {
    return Promise.resolve([{ id: AGENT_ID, displayName: 'Demo Agent' }])
  }
  close(): Promise<void> {
    return Promise.resolve()
  }
}

describe('ticket workflow', () => {
  it('persists an agent reply and returns the refreshed ticket', async () => {
    const service = new DefaultTicketService(new MemoryTicketRepository())
    const ticket = await service.reply(WORKSPACE_ID, TICKET_ID, access, 'I am checking this now.')
    expect(ticket.replies[0]?.body).toBe('I am checking this now.')
  })

  it('rejects replies when repository ownership or status checks fail', async () => {
    const repository = new MemoryTicketRepository()
    repository.replyAllowed = false
    const service = new DefaultTicketService(repository)
    await expect(service.reply(WORKSPACE_ID, TICKET_ID, access, 'Reply')).rejects.toMatchObject({
      code: 'ticket_conflict',
      statusCode: 409,
    })
  })

  it('updates deterministic status and assignment fields', async () => {
    const service = new DefaultTicketService(new MemoryTicketRepository())
    expect((await service.setStatus(WORKSPACE_ID, TICKET_ID, access, 'resolved')).status).toBe(
      'resolved',
    )
    expect((await service.assign(WORKSPACE_ID, TICKET_ID, access, AGENT_ID, 'high')).priority).toBe(
      'high',
    )
  })
})
