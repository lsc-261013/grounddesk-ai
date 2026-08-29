import postgres, { type Sql } from 'postgres'

import {
  documentKindSchema,
  documentStatusSchema,
  knowledgeChunkPreviewSchema,
  knowledgeDocumentSchema,
  retrievalEvidenceSchema,
  type KnowledgeChunkPreview,
  type KnowledgeDocument,
  type RetrievalEvidence,
} from '@grounddesk/shared'

import type {
  CreateDocumentInput,
  EmbeddingConfigRecord,
  KnowledgeDocumentRecord,
  KnowledgeRepository,
  SearchKnowledgeInput,
} from './repository.js'
import type { ChunkCandidate } from './types.js'

interface DocumentRow {
  id: string
  workspaceId: string
  title: string
  originalFilename: string
  storagePath: string
  kind: string
  language: string
  byteSize: number
  status: string
  failureCode: string | null
  failureMessage: string | null
  processedAt: Date | null
  createdAt: Date
  updatedAt: Date
  chunkCount: number
}

interface ChunkRow {
  id: string
  chunkIndex: number
  content: string
  pageStart: number | null
  pageEnd: number | null
  sectionPath: string[]
  productModels: string[]
  language: string
  tokenCount: number
}

interface EmbeddingConfigRow {
  id: string
  provider: string
  model: string
  dimensions: number
}

interface EvidenceRow {
  chunkId: string
  documentId: string
  documentTitle: string
  content: string
  sectionPath: string[]
  pageStart: number | null
  pageEnd: number | null
  fusedScore: number
  vectorSimilarity: number | null
  keywordScore: number | null
  vectorRank: number | null
  keywordRank: number | null
}

const documentSelection = `
  document.id,
  document.workspace_id as "workspaceId",
  document.title,
  document.original_filename as "originalFilename",
  document.storage_path as "storagePath",
  document.kind::text as kind,
  document.language,
  document.byte_size::integer as "byteSize",
  document.status::text as status,
  document.failure_code as "failureCode",
  document.failure_message as "failureMessage",
  document.processed_at as "processedAt",
  document.created_at as "createdAt",
  document.updated_at as "updatedAt",
  (select count(*)::integer from public.knowledge_chunks chunk where chunk.document_id = document.id) as "chunkCount"
`

const toIso = (value: Date | null): string | null => (value ? value.toISOString() : null)

const mapDocument = (row: DocumentRow): KnowledgeDocumentRecord => {
  const document = knowledgeDocumentSchema.parse({
    ...row,
    kind: documentKindSchema.parse(row.kind),
    status: documentStatusSchema.parse(row.status),
    processedAt: toIso(row.processedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  })

  return { ...document, storagePath: row.storagePath }
}

export class PostgresKnowledgeRepository implements KnowledgeRepository {
  constructor(private readonly database: Sql) {}

  async countDocuments(workspaceId: string): Promise<number> {
    const rows = await this.database<{ count: number }[]>`
      select count(*)::integer as count
      from public.knowledge_documents
      where workspace_id = ${workspaceId}
    `
    return rows[0]?.count ?? 0
  }

  async createDocument(input: CreateDocumentInput): Promise<KnowledgeDocumentRecord> {
    const rows = await this.database<DocumentRow[]>`
      insert into public.knowledge_documents as document (
        id, workspace_id, title, original_filename, storage_path, kind, language,
        content_hash, byte_size, status, created_by
      ) values (
        ${input.id}, ${input.workspaceId}, ${input.title}, ${input.originalFilename},
        ${input.storagePath}, ${input.kind}, ${input.language}, ${input.contentHash},
        ${input.byteSize}, 'queued', ${input.createdBy}
      )
      returning ${this.database.unsafe(documentSelection)}
    `
    const row = rows[0]
    if (!row) throw new Error('Document creation returned no result.')
    return mapDocument(row)
  }

  async getDocument(
    workspaceId: string,
    documentId: string,
  ): Promise<KnowledgeDocumentRecord | null> {
    const rows = await this.database<DocumentRow[]>`
      select ${this.database.unsafe(documentSelection)}
      from public.knowledge_documents document
      where document.workspace_id = ${workspaceId}
        and document.id = ${documentId}
      limit 1
    `
    return rows[0] ? mapDocument(rows[0]) : null
  }

  async getDocumentByHash(
    workspaceId: string,
    contentHash: string,
  ): Promise<KnowledgeDocumentRecord | null> {
    const rows = await this.database<DocumentRow[]>`
      select ${this.database.unsafe(documentSelection)}
      from public.knowledge_documents document
      where document.workspace_id = ${workspaceId}
        and document.content_hash = ${contentHash}
      limit 1
    `
    return rows[0] ? mapDocument(rows[0]) : null
  }

  async listDocuments(workspaceId: string): Promise<KnowledgeDocument[]> {
    const rows = await this.database<DocumentRow[]>`
      select ${this.database.unsafe(documentSelection)}
      from public.knowledge_documents document
      where document.workspace_id = ${workspaceId}
      order by document.created_at desc, document.id
    `
    return rows.map(mapDocument)
  }

  async listChunks(workspaceId: string, documentId: string): Promise<KnowledgeChunkPreview[]> {
    const rows = await this.database<ChunkRow[]>`
      select
        id,
        chunk_index as "chunkIndex",
        content,
        page_start as "pageStart",
        page_end as "pageEnd",
        section_path as "sectionPath",
        product_models as "productModels",
        language,
        token_count as "tokenCount"
      from public.knowledge_chunks
      where workspace_id = ${workspaceId}
        and document_id = ${documentId}
      order by chunk_index
    `
    return rows.map((row) => knowledgeChunkPreviewSchema.parse(row))
  }

  async listProductModels(workspaceId: string): Promise<string[]> {
    const rows = await this.database<{ model: string }[]>`
      select model
      from public.products
      where workspace_id = ${workspaceId}
      order by char_length(model) desc, model
    `
    return rows.map((row) => row.model)
  }

  async getActiveEmbeddingConfig(workspaceId: string): Promise<EmbeddingConfigRecord | null> {
    const rows = await this.database<EmbeddingConfigRow[]>`
      select id, provider, model, dimensions
      from public.embedding_configs
      where workspace_id = ${workspaceId}
        and is_active
      order by created_at desc
      limit 1
    `
    return rows[0] ?? null
  }

  async markProcessing(workspaceId: string, documentId: string): Promise<void> {
    await this.database`
      update public.knowledge_documents
      set status = 'processing', failure_code = null, failure_message = null
      where workspace_id = ${workspaceId} and id = ${documentId}
    `
  }

  async markFailed(
    workspaceId: string,
    documentId: string,
    failureCode: string,
    failureMessage: string,
  ): Promise<void> {
    await this.database`
      update public.knowledge_documents
      set status = 'failed',
          failure_code = ${failureCode},
          failure_message = ${failureMessage},
          processed_at = null
      where workspace_id = ${workspaceId} and id = ${documentId}
    `
  }

  async replaceChunksAndMarkReady(
    workspaceId: string,
    documentId: string,
    embeddingConfigId: string,
    chunks: readonly ChunkCandidate[],
    embeddings: readonly (readonly number[])[],
  ): Promise<void> {
    if (chunks.length !== embeddings.length) {
      throw new Error('Chunk and embedding counts do not match.')
    }

    await this.database.begin(async (transaction) => {
      await transaction`
        delete from public.knowledge_chunks
        where workspace_id = ${workspaceId} and document_id = ${documentId}
      `

      for (const [index, chunk] of chunks.entries()) {
        const embedding = embeddings[index]
        if (!embedding) throw new Error(`Missing embedding for chunk ${index}.`)
        const vectorLiteral = `[${embedding.join(',')}]`

        await transaction`
          insert into public.knowledge_chunks (
            workspace_id, document_id, embedding_config_id, chunk_index, content,
            content_hash, token_count, page_start, page_end, section_path,
            product_models, language, metadata, embedding
          ) values (
            ${workspaceId}, ${documentId}, ${embeddingConfigId}, ${chunk.chunkIndex},
            ${chunk.content}, ${chunk.contentHash}, ${chunk.tokenCount}, ${chunk.pageStart},
            ${chunk.pageEnd}, ${chunk.sectionPath}, ${chunk.productModels}, ${chunk.language},
            ${transaction.json({ chunking: 'structured-v1' })},
            ${vectorLiteral}::extensions.vector(1024)
          )
        `
      }

      await transaction`
        update public.knowledge_documents
        set status = 'ready',
            failure_code = null,
            failure_message = null,
            processed_at = now()
        where workspace_id = ${workspaceId} and id = ${documentId}
      `
    })
  }

  async searchHybrid(input: SearchKnowledgeInput): Promise<RetrievalEvidence[]> {
    const vectorLiteral = `[${input.queryEmbedding.join(',')}]`
    const rows = await this.database<EvidenceRow[]>`
      select
        result.chunk_id as "chunkId",
        result.document_id as "documentId",
        document.title as "documentTitle",
        result.content,
        result.section_path as "sectionPath",
        result.page_start as "pageStart",
        result.page_end as "pageEnd",
        result.fused_score as "fusedScore",
        result.vector_similarity as "vectorSimilarity",
        result.keyword_score as "keywordScore",
        result.vector_rank::integer as "vectorRank",
        result.keyword_rank::integer as "keywordRank"
      from public.match_hybrid_chunks(
        ${input.workspaceId},
        ${input.embeddingConfigId},
        ${vectorLiteral}::extensions.vector(1024),
        ${input.queryText},
        ${input.queryLanguage},
        ${input.productModel},
        ${input.resultLimit}
      ) result
      join public.knowledge_documents document on document.id = result.document_id
      where document.workspace_id = ${input.workspaceId}
      order by result.fused_score desc, result.chunk_id
    `
    return rows.map((row) => retrievalEvidenceSchema.parse(row))
  }

  async close(): Promise<void> {
    await this.database.end({ timeout: 5 })
  }
}

export const createPostgresKnowledgeRepository = (databaseUrl: string): KnowledgeRepository =>
  new PostgresKnowledgeRepository(
    postgres(databaseUrl, {
      max: 5,
      ssl: 'require',
      connection: { application_name: 'grounddesk-knowledge' },
    }),
  )
