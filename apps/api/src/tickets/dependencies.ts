import type { Sql } from 'postgres'

import { ServiceUnavailableError } from '../auth/errors.js'
import type { ApiEnv } from '../config/env.js'
import { createPostgresTicketRepository } from './postgres-ticket-repository.js'
import { DefaultTicketService, type TicketService } from './service.js'

export interface TicketDependencies {
  ticketService: TicketService
}

class UnavailableTicketService implements TicketService {
  private unavailable(): ServiceUnavailableError {
    return new ServiceUnavailableError('Ticket storage is unavailable in offline mode.')
  }

  list(): ReturnType<TicketService['list']> {
    return Promise.reject(this.unavailable())
  }
  detail(): ReturnType<TicketService['detail']> {
    return Promise.reject(this.unavailable())
  }
  reply(): ReturnType<TicketService['reply']> {
    return Promise.reject(this.unavailable())
  }
  setStatus(): ReturnType<TicketService['setStatus']> {
    return Promise.reject(this.unavailable())
  }
  assign(): ReturnType<TicketService['assign']> {
    return Promise.reject(this.unavailable())
  }
  agents(): ReturnType<TicketService['agents']> {
    return Promise.reject(this.unavailable())
  }
  close(): Promise<void> {
    return Promise.resolve()
  }
}

export const createTicketDependencies = (
  environment: ApiEnv,
  database?: Sql,
): TicketDependencies => {
  if (environment.RUNTIME_MODE !== 'connected' || !environment.SUPABASE_DB_URL) {
    return { ticketService: new UnavailableTicketService() }
  }
  return {
    ticketService: new DefaultTicketService(
      createPostgresTicketRepository(database ?? environment.SUPABASE_DB_URL),
    ),
  }
}
