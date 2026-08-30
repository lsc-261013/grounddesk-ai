import type { Sql } from 'postgres'

import type { ApiEnv } from '../config/env.js'
import { ServiceUnavailableError } from '../auth/errors.js'
import { SiliconFlowEmbeddingProvider } from './embedding-provider.js'
import { createPostgresKnowledgeRepository } from './postgres-knowledge-repository.js'
import type { KnowledgeRepository } from './repository.js'
import { DefaultKnowledgeService, type KnowledgeService } from './service.js'
import { createSupabaseKnowledgeStorage } from './storage.js'

export interface KnowledgeDependencies {
  knowledgeService: KnowledgeService
}

class UnavailableKnowledgeService implements KnowledgeService {
  private unavailable(): ServiceUnavailableError {
    return new ServiceUnavailableError('Knowledge processing is unavailable in offline mode.')
  }

  registerDocument(): ReturnType<KnowledgeService['registerDocument']> {
    return Promise.reject(this.unavailable())
  }

  retryDocument(): ReturnType<KnowledgeService['retryDocument']> {
    return Promise.reject(this.unavailable())
  }

  listDocuments(): ReturnType<KnowledgeService['listDocuments']> {
    return Promise.reject(this.unavailable())
  }

  listChunks(): ReturnType<KnowledgeService['listChunks']> {
    return Promise.reject(this.unavailable())
  }

  search(): ReturnType<KnowledgeService['search']> {
    return Promise.reject(this.unavailable())
  }

  searchWithTrace(): ReturnType<KnowledgeService['searchWithTrace']> {
    return Promise.reject(this.unavailable())
  }

  processNow(): ReturnType<KnowledgeService['processNow']> {
    return Promise.reject(this.unavailable())
  }

  waitForIdle(): Promise<void> {
    return Promise.resolve()
  }

  close(): Promise<void> {
    return Promise.resolve()
  }
}

export const createKnowledgeDependencies = (
  environment: ApiEnv,
  database?: Sql,
): KnowledgeDependencies => {
  if (
    environment.RUNTIME_MODE !== 'connected' ||
    !environment.SUPABASE_URL ||
    !environment.SUPABASE_SECRET_KEY ||
    !environment.SUPABASE_DB_URL ||
    !environment.SILICONFLOW_API_KEY
  ) {
    return { knowledgeService: new UnavailableKnowledgeService() }
  }

  const repository: KnowledgeRepository = createPostgresKnowledgeRepository(
    database ?? environment.SUPABASE_DB_URL,
  )
  const storage = createSupabaseKnowledgeStorage(
    environment.SUPABASE_URL,
    environment.SUPABASE_SECRET_KEY,
  )
  const embeddings = new SiliconFlowEmbeddingProvider(
    environment.EMBEDDING_MODEL,
    environment.EMBEDDING_DIMENSION,
    environment.EMBEDDING_BASE_URL,
    environment.SILICONFLOW_API_KEY,
    environment.EMBEDDING_TIMEOUT_MS,
  )

  return {
    knowledgeService: new DefaultKnowledgeService(repository, storage, embeddings, {
      maxUploadBytes: environment.MAX_UPLOAD_BYTES,
      maxWorkspaceDocuments: environment.MAX_WORKSPACE_DOCUMENTS,
      chunkTargetChars: environment.CHUNK_TARGET_CHARS,
      chunkOverlapChars: environment.CHUNK_OVERLAP_CHARS,
    }),
  }
}
