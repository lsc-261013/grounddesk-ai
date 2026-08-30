import type { Sql } from 'postgres'

import type { ApiEnv } from '../config/env.js'
import { createPostgresConversationRepository } from './postgres-conversation-repository.js'
import type { ConversationListResult, ConversationRepository } from './repository.js'

class UnavailableConversationRepository implements ConversationRepository {
  list(): Promise<ConversationListResult> {
    return Promise.resolve({ conversations: [], total: 0 })
  }
  get(): Promise<null> {
    return Promise.resolve(null)
  }
  close(): Promise<void> {
    return Promise.resolve()
  }
}

export interface ConversationDependencies {
  conversationRepository: ConversationRepository
}

export const createConversationDependencies = (
  environment: ApiEnv,
  database?: Sql,
): ConversationDependencies => ({
  conversationRepository:
    environment.RUNTIME_MODE === 'connected' && environment.SUPABASE_DB_URL
      ? createPostgresConversationRepository(database ?? environment.SUPABASE_DB_URL)
      : new UnavailableConversationRepository(),
})
