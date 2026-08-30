export class TicketNotFoundError extends Error {
  readonly statusCode = 404
  readonly code = 'ticket_not_found'

  constructor() {
    super('The ticket does not exist or is not visible to this account.')
  }
}

export class TicketConflictError extends Error {
  readonly statusCode = 409
  readonly code = 'ticket_conflict'

  constructor(message: string) {
    super(message)
  }
}
