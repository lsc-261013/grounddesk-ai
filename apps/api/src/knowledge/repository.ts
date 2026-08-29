import type {
  DocumentKind,
  KnowledgeChunkPreview,
  KnowledgeDocument,
  Locale,
  RetrievalEvidence,
} from '@grounddesk/shared'

import type { ChunkCandidate } from './types.js'

export interface KnowledgeDocumentRecord extends KnowledgeDocument {
  storagePath: string
}

export interface EmbeddingConfigRecord {
  id: string
  provider: string
  model: string
  dimensions: number
}

export interface CreateDocumentInput {
  id: string
  workspaceId: string
  title: string
  originalFilename: string
  storagePath: string
  kind: DocumentKind
  language: Locale | 'bilingual'
  contentHash: string
  byteSize: number
  createdBy: string
}

export interface SearchKnowledgeInput {
  workspaceId: string
  embeddingConfigId: string
  queryEmbedding: readonly number[]
  queryText: string
  queryLanguage: Locale
  productModel: string | null
  resultLimit: number
}

export interface KnowledgeRepository {
  countDocuments(workspaceId: string): Promise<number>
  createDocument(input: CreateDocumentInput): Promise<KnowledgeDocumentRecord>
  getDocument(workspaceId: string, documentId: string): Promise<KnowledgeDocumentRecord | null>
  getDocumentByHash(
    workspaceId: string,
    contentHash: string,
  ): Promise<KnowledgeDocumentRecord | null>
  listDocuments(workspaceId: string): Promise<KnowledgeDocument[]>
  listChunks(workspaceId: string, documentId: string): Promise<KnowledgeChunkPreview[]>
  listProductModels(workspaceId: string): Promise<string[]>
  getActiveEmbeddingConfig(workspaceId: string): Promise<EmbeddingConfigRecord | null>
  markProcessing(workspaceId: string, documentId: string): Promise<void>
  markFailed(
    workspaceId: string,
    documentId: string,
    failureCode: string,
    failureMessage: string,
  ): Promise<void>
  replaceChunksAndMarkReady(
    workspaceId: string,
    documentId: string,
    embeddingConfigId: string,
    chunks: readonly ChunkCandidate[],
    embeddings: readonly (readonly number[])[],
  ): Promise<void>
  searchHybrid(input: SearchKnowledgeInput): Promise<RetrievalEvidence[]>
  close(): Promise<void>
}
