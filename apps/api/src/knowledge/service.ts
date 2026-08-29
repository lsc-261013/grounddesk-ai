import { createHash, randomUUID } from 'node:crypto'
import { extname } from 'node:path'

import {
  MAX_UPLOAD_BYTES,
  MAX_WORKSPACE_DOCUMENTS,
  type KnowledgeChunkPreview,
  type KnowledgeDocument,
  type Locale,
  type RetrievalEvidence,
} from '@grounddesk/shared'

import { chunkDocument } from './chunker.js'
import { detectDocumentKind, parseKnowledgeDocument, sanitizeFilename } from './document-parser.js'
import type { EmbeddingProvider } from './embedding-provider.js'
import { KnowledgeConflictError, KnowledgeInputError, KnowledgeLimitError } from './errors.js'
import { buildKeywordQuery } from './keyword-query.js'
import type { KnowledgeDocumentRecord, KnowledgeRepository } from './repository.js'
import type { KnowledgeStorage } from './storage.js'
import type { StoredDocumentResult, UploadedKnowledgeFile } from './types.js'

export interface RegisterDocumentInput {
  workspaceId: string
  createdBy: string
  title?: string
  language: Locale | 'bilingual'
  file: UploadedKnowledgeFile
}

export interface SearchInput {
  workspaceId: string
  query: string
  language: Locale
  productModel: string | null
  limit: number
}

export interface KnowledgeService {
  registerDocument(input: RegisterDocumentInput): Promise<StoredDocumentResult>
  retryDocument(workspaceId: string, documentId: string): Promise<KnowledgeDocument>
  listDocuments(workspaceId: string): Promise<KnowledgeDocument[]>
  listChunks(workspaceId: string, documentId: string): Promise<KnowledgeChunkPreview[]>
  search(input: SearchInput): Promise<RetrievalEvidence[]>
  processNow(workspaceId: string, documentId: string): Promise<void>
  waitForIdle(): Promise<void>
  close(): Promise<void>
}

interface KnowledgeServiceOptions {
  maxUploadBytes: number
  maxWorkspaceDocuments: number
  chunkTargetChars: number
  chunkOverlapChars: number
}

const DEFAULT_OPTIONS: KnowledgeServiceOptions = {
  maxUploadBytes: MAX_UPLOAD_BYTES,
  maxWorkspaceDocuments: MAX_WORKSPACE_DOCUMENTS,
  chunkTargetChars: 1_200,
  chunkOverlapChars: 180,
}

const mimeTypeFor = (kind: KnowledgeDocumentRecord['kind']): string =>
  kind === 'pdf' ? 'application/pdf' : kind === 'markdown' ? 'text/markdown' : 'text/plain'

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'

const safeFailure = (error: unknown): { code: string; message: string } => {
  if (error instanceof KnowledgeInputError) {
    return { code: 'parse_failed', message: error.message }
  }

  const message = error instanceof Error ? error.message : ''
  if (message.includes('Embedding')) {
    return {
      code: 'embedding_failed',
      message: 'The embedding provider could not process this document. Retry in a moment.',
    }
  }

  return {
    code: 'processing_failed',
    message: 'The document could not be processed. Check the file and retry.',
  }
}

export class DefaultKnowledgeService implements KnowledgeService {
  private readonly jobs = new Map<string, Promise<void>>()

  constructor(
    private readonly repository: KnowledgeRepository,
    private readonly storage: KnowledgeStorage,
    private readonly embeddings: EmbeddingProvider,
    private readonly options: KnowledgeServiceOptions = DEFAULT_OPTIONS,
  ) {}

  async registerDocument(input: RegisterDocumentInput): Promise<StoredDocumentResult> {
    if (input.file.bytes.length === 0) {
      throw new KnowledgeInputError('The uploaded document is empty.')
    }
    if (input.file.bytes.length > this.options.maxUploadBytes) {
      throw new KnowledgeInputError('The document exceeds the 10 MB upload limit.')
    }

    const originalFilename = sanitizeFilename(input.file.filename)
    const kind = detectDocumentKind({ ...input.file, filename: originalFilename })
    const contentHash = createHash('sha256').update(input.file.bytes).digest('hex')
    const existingDocument = await this.repository.getDocumentByHash(input.workspaceId, contentHash)

    if (existingDocument) {
      return { document: existingDocument, duplicate: true }
    }

    if (
      (await this.repository.countDocuments(input.workspaceId)) >=
      this.options.maxWorkspaceDocuments
    ) {
      throw new KnowledgeLimitError('This Demo Workspace has reached its 20-document limit.')
    }

    const documentId = randomUUID()
    const storagePath = `${input.workspaceId}/${documentId}/${originalFilename}`
    const fallbackTitle = originalFilename.slice(
      0,
      Math.max(1, originalFilename.length - extname(originalFilename).length),
    )
    const title = input.title?.trim() || fallbackTitle

    if (title.length > 180) {
      throw new KnowledgeInputError('The document title must be 180 characters or fewer.')
    }

    await this.storage.upload(storagePath, input.file.bytes, input.file.mimeType)

    try {
      const document = await this.repository.createDocument({
        id: documentId,
        workspaceId: input.workspaceId,
        title,
        originalFilename,
        storagePath,
        kind,
        language: input.language,
        contentHash,
        byteSize: input.file.bytes.length,
        createdBy: input.createdBy,
      })

      this.enqueue(input.workspaceId, document.id)
      return { document, duplicate: false }
    } catch (error) {
      await this.storage.remove(storagePath).catch(() => undefined)
      if (isUniqueViolation(error)) {
        const duplicate = await this.repository.getDocumentByHash(input.workspaceId, contentHash)
        if (duplicate) return { document: duplicate, duplicate: true }
      }
      throw error
    }
  }

  async retryDocument(workspaceId: string, documentId: string): Promise<KnowledgeDocument> {
    const document = await this.repository.getDocument(workspaceId, documentId)
    if (!document) throw new KnowledgeInputError('The document does not exist in this workspace.')
    if (document.status !== 'failed') {
      throw new KnowledgeConflictError('Only failed documents can be retried.')
    }

    this.enqueue(workspaceId, documentId)
    return document
  }

  listDocuments(workspaceId: string): Promise<KnowledgeDocument[]> {
    return this.repository.listDocuments(workspaceId)
  }

  listChunks(workspaceId: string, documentId: string): Promise<KnowledgeChunkPreview[]> {
    return this.repository.listChunks(workspaceId, documentId)
  }

  async search(input: SearchInput): Promise<RetrievalEvidence[]> {
    const query = input.query.trim()
    if (!query) throw new KnowledgeInputError('The retrieval query must not be empty.')

    const embeddingConfig = await this.repository.getActiveEmbeddingConfig(input.workspaceId)
    if (!embeddingConfig) throw new Error('No active embedding configuration exists.')
    if (
      embeddingConfig.model !== this.embeddings.model ||
      embeddingConfig.dimensions !== this.embeddings.dimensions
    ) {
      throw new Error('The active embedding configuration does not match the provider.')
    }

    const [queryEmbedding] = await this.embeddings.embed([query])
    if (!queryEmbedding) throw new Error('The embedding provider returned no query vector.')

    return this.repository.searchHybrid({
      workspaceId: input.workspaceId,
      embeddingConfigId: embeddingConfig.id,
      queryEmbedding,
      queryText: buildKeywordQuery(query),
      queryLanguage: input.language,
      productModel: input.productModel,
      resultLimit: input.limit,
    })
  }

  async processNow(workspaceId: string, documentId: string): Promise<void> {
    await this.repository.markProcessing(workspaceId, documentId)

    try {
      const document = await this.repository.getDocument(workspaceId, documentId)
      if (!document) throw new KnowledgeInputError('The queued document no longer exists.')

      const bytes = await this.storage.download(document.storagePath)
      const parsed = await parseKnowledgeDocument({
        filename: document.originalFilename,
        mimeType: mimeTypeFor(document.kind),
        bytes,
      })
      const [models, embeddingConfig] = await Promise.all([
        this.repository.listProductModels(workspaceId),
        this.repository.getActiveEmbeddingConfig(workspaceId),
      ])

      if (!embeddingConfig) throw new Error('No active embedding configuration exists.')
      if (
        embeddingConfig.model !== this.embeddings.model ||
        embeddingConfig.dimensions !== this.embeddings.dimensions
      ) {
        throw new Error('The active embedding configuration does not match the provider.')
      }

      const chunks = chunkDocument(parsed.pages, {
        targetChars: this.options.chunkTargetChars,
        overlapChars: this.options.chunkOverlapChars,
        language: document.language,
        productModels: models,
      })
      if (chunks.length === 0) throw new KnowledgeInputError('No usable text chunks were produced.')

      const vectors: number[][] = []
      for (let index = 0; index < chunks.length; index += 16) {
        const batch = chunks.slice(index, index + 16)
        const inputs = batch.map((chunk) =>
          chunk.sectionPath.length > 0
            ? `${chunk.sectionPath.join(' > ')}\n${chunk.content}`
            : chunk.content,
        )
        vectors.push(...(await this.embeddings.embed(inputs)))
      }

      await this.repository.replaceChunksAndMarkReady(
        workspaceId,
        documentId,
        embeddingConfig.id,
        chunks,
        vectors,
      )
    } catch (error) {
      const failure = safeFailure(error)
      await this.repository.markFailed(workspaceId, documentId, failure.code, failure.message)
    }
  }

  async waitForIdle(): Promise<void> {
    await Promise.all(this.jobs.values())
  }

  async close(): Promise<void> {
    await this.waitForIdle()
    await this.repository.close()
  }

  private enqueue(workspaceId: string, documentId: string): void {
    if (this.jobs.has(documentId)) return

    const job = this.processNow(workspaceId, documentId).finally(() => {
      this.jobs.delete(documentId)
    })
    this.jobs.set(documentId, job)
  }
}
