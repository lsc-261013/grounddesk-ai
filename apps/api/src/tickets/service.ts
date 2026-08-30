import type {
  TicketAssignee,
  TicketDetail,
  TicketPriority,
  TicketStatus,
  TicketSummary,
} from '@grounddesk/shared'

import { TicketConflictError, TicketNotFoundError } from './errors.js'
import type { TicketAccess, TicketRepository } from './repository.js'

export interface TicketService {
  list(workspaceId: string, access: TicketAccess): Promise<TicketSummary[]>
  detail(workspaceId: string, ticketId: string, access: TicketAccess): Promise<TicketDetail>
  reply(
    workspaceId: string,
    ticketId: string,
    access: TicketAccess,
    body: string,
  ): Promise<TicketDetail>
  setStatus(
    workspaceId: string,
    ticketId: string,
    access: TicketAccess,
    status: TicketStatus,
  ): Promise<TicketDetail>
  assign(
    workspaceId: string,
    ticketId: string,
    access: TicketAccess,
    assignedTo: string | null,
    priority?: TicketPriority,
  ): Promise<TicketDetail>
  agents(workspaceId: string): Promise<TicketAssignee[]>
  close(): Promise<void>
}

export class DefaultTicketService implements TicketService {
  constructor(private readonly repository: TicketRepository) {}

  list(workspaceId: string, access: TicketAccess): Promise<TicketSummary[]> {
    return this.repository.listTickets(workspaceId, access)
  }

  async detail(workspaceId: string, ticketId: string, access: TicketAccess): Promise<TicketDetail> {
    const ticket = await this.repository.getTicket(workspaceId, ticketId, access)
    if (!ticket) throw new TicketNotFoundError()
    return ticket
  }

  async reply(
    workspaceId: string,
    ticketId: string,
    access: TicketAccess,
    body: string,
  ): Promise<TicketDetail> {
    if (!(await this.repository.addReply(workspaceId, ticketId, access, body))) {
      throw new TicketConflictError('Only an assigned, unresolved ticket can receive a reply.')
    }
    return this.detail(workspaceId, ticketId, access)
  }

  async setStatus(
    workspaceId: string,
    ticketId: string,
    access: TicketAccess,
    status: TicketStatus,
  ): Promise<TicketDetail> {
    if (!(await this.repository.updateStatus(workspaceId, ticketId, access, status))) {
      throw new TicketNotFoundError()
    }
    return this.detail(workspaceId, ticketId, access)
  }

  async assign(
    workspaceId: string,
    ticketId: string,
    access: TicketAccess,
    assignedTo: string | null,
    priority?: TicketPriority,
  ): Promise<TicketDetail> {
    if (
      !(await this.repository.updateAssignment(workspaceId, ticketId, {
        assignedTo,
        ...(priority ? { priority } : {}),
      }))
    ) {
      throw new TicketConflictError('The assignee must be an agent in this workspace.')
    }
    return this.detail(workspaceId, ticketId, access)
  }

  agents(workspaceId: string): Promise<TicketAssignee[]> {
    return this.repository.listAssignableAgents(workspaceId)
  }

  close(): Promise<void> {
    return this.repository.close()
  }
}
