import type {
  TicketAssignee,
  TicketDetail,
  TicketPriority,
  TicketStatus,
  TicketSummary,
  WorkspaceRole,
} from '@grounddesk/shared'

export interface TicketAccess {
  userId: string
  role: WorkspaceRole
}

export interface TicketAssignmentUpdate {
  assignedTo: string | null
  priority?: TicketPriority
}

export interface TicketRepository {
  listTickets(workspaceId: string, access: TicketAccess): Promise<TicketSummary[]>
  getTicket(
    workspaceId: string,
    ticketId: string,
    access: TicketAccess,
  ): Promise<TicketDetail | null>
  addReply(
    workspaceId: string,
    ticketId: string,
    access: TicketAccess,
    body: string,
  ): Promise<boolean>
  updateStatus(
    workspaceId: string,
    ticketId: string,
    access: TicketAccess,
    status: TicketStatus,
  ): Promise<boolean>
  updateAssignment(
    workspaceId: string,
    ticketId: string,
    update: TicketAssignmentUpdate,
  ): Promise<boolean>
  listAssignableAgents(workspaceId: string): Promise<TicketAssignee[]>
  close(): Promise<void>
}
