import type {
  KnowledgeChunkPreview,
  KnowledgeDocument,
  RetrievalEvidence,
} from '@grounddesk/shared'
import { describe, expect, it } from 'vitest'

import type { EmbeddingProvider } from '../src/knowledge/embedding-provider.js'
import type {
  CreateDocumentInput,
  EmbeddingConfigRecord,
  KnowledgeDocumentRecord,
  KnowledgeRepository,
  SearchKnowledgeInput,
} from '../src/knowledge/repository.js'
import { DefaultKnowledgeService } from '../src/knowledge/service.js'
import type { KnowledgeStorage } from '../src/knowledge/storage.js'
import type { ChunkCandidate } from '../src/knowledge/types.js'

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const EMBEDDING_CONFIG: EmbeddingConfigRecord = {
  id: '22222222-2222-4222-8222-222222222222',
  provider: 'siliconflow',
  model: 'BAAI/bge-m3',
  dimensions: 1024,
}

class MemoryStorage implements KnowledgeStorage {
  readonly files = new Map<string, Buffer>()

  upload(path: string, bytes: Buffer): Promise<void> {
    this.files.set(path, Buffer.from(bytes))
    return Promise.resolve()
  }

  download(path: string): Promise<Buffer> {
    const bytes = this.files.get(path)
    return bytes
      ? Promise.resolve(Buffer.from(bytes))
      : Promise.reject(new Error('Stored file not found.'))
  }

  remove(path: string): Promise<void> {
    this.files.delete(path)
    return Promise.resolve()
  }
}

class MemoryRepository implements KnowledgeRepository {
  readonly documents = new Map<string, KnowledgeDocumentRecord>()
  readonly chunks = new Map<string, KnowledgeChunkPreview[]>()
  readonly hashes = new Map<string, string>()

  countDocuments(): Promise<number> {
    return Promise.resolve(this.documents.size)
  }

  createDocument(input: CreateDocumentInput): Promise<KnowledgeDocumentRecord> {
    const now = new Date().toISOString()
    const document: KnowledgeDocumentRecord = {
      id: input.id,
      workspaceId: input.workspaceId,
      title: input.title,
      originalFilename: input.originalFilename,
      storagePath: input.storagePath,
      kind: input.kind,
      language: input.language,
      byteSize: input.byteSize,
      status: 'queued',
      failureCode: null,
      failureMessage: null,
      processedAt: null,
      createdAt: now,
      updatedAt: now,
      chunkCount: 0,
    }
    this.documents.set(document.id, document)
    this.hashes.set(`${input.workspaceId}:${input.contentHash}`, document.id)
    return Promise.resolve(document)
  }

  getDocument(workspaceId: string, documentId: string): Promise<KnowledgeDocumentRecord | null> {
    const document = this.documents.get(documentId)
    return Promise.resolve(document?.workspaceId === workspaceId ? document : null)
  }

  getDocumentByHash(
    workspaceId: string,
    contentHash: string,
  ): Promise<KnowledgeDocumentRecord | null> {
    const documentId = this.hashes.get(`${workspaceId}:${contentHash}`)
    return Promise.resolve(documentId ? (this.documents.get(documentId) ?? null) : null)
  }

  listDocuments(workspaceId: string): Promise<KnowledgeDocument[]> {
    return Promise.resolve(
      [...this.documents.values()].filter((document) => document.workspaceId === workspaceId),
    )
  }

  listChunks(_workspaceId: string, documentId: string): Promise<KnowledgeChunkPreview[]> {
    return Promise.resolve(this.chunks.get(documentId) ?? [])
  }

  listProductModels(): Promise<string[]> {
    return Promise.resolve(['Airwave S1', 'Airwave S1 Pro'])
  }

  getActiveEmbeddingConfig(): Promise<EmbeddingConfigRecord> {
    return Promise.resolve(EMBEDDING_CONFIG)
  }

  markProcessing(_workspaceId: string, documentId: string): Promise<void> {
    const document = this.documents.get(documentId)
    if (document) this.documents.set(documentId, { ...document, status: 'processing' })
    return Promise.resolve()
  }

  markFailed(
    _workspaceId: string,
    documentId: string,
    failureCode: string,
    failureMessage: string,
  ): Promise<void> {
    const document = this.documents.get(documentId)
    if (document) {
      this.documents.set(documentId, {
        ...document,
        status: 'failed',
        failureCode,
        failureMessage,
      })
    }
    return Promise.resolve()
  }

  replaceChunksAndMarkReady(
    _workspaceId: string,
    documentId: string,
    _embeddingConfigId: string,
    chunks: readonly ChunkCandidate[],
  ): Promise<void> {
    this.chunks.set(
      documentId,
      chunks.map((chunk, index) => ({
        id: `30000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        ...chunk,
      })),
    )
    const document = this.documents.get(documentId)
    if (document) {
      this.documents.set(documentId, {
        ...document,
        status: 'ready',
        processedAt: new Date().toISOString(),
        chunkCount: chunks.length,
      })
    }
    return Promise.resolve()
  }

  searchHybrid(input: SearchKnowledgeInput): Promise<RetrievalEvidence[]> {
    void input
    return Promise.resolve([])
  }

  close(): Promise<void> {
    return Promise.resolve()
  }
}

class DeterministicEmbeddingProvider implements EmbeddingProvider {
  readonly model = EMBEDDING_CONFIG.model
  readonly dimensions = EMBEDDING_CONFIG.dimensions

  embed(texts: readonly string[]): Promise<number[][]> {
    return Promise.resolve(texts.map(() => Array.from({ length: this.dimensions }, () => 0.01)))
  }
}

const createService = () => {
  const repository = new MemoryRepository()
  const storage = new MemoryStorage()
  const service = new DefaultKnowledgeService(
    repository,
    storage,
    new DeterministicEmbeddingProvider(),
    {
      maxUploadBytes: 10 * 1024 * 1024,
      maxWorkspaceDocuments: 20,
      chunkTargetChars: 400,
      chunkOverlapChars: 80,
    },
  )
  return { repository, service, storage }
}

describe('knowledge ingestion service', () => {
  it('uploads, chunks, embeds, and marks a document ready', async () => {
    const { repository, service } = createService()
    const result = await service.registerDocument({
      workspaceId: WORKSPACE_ID,
      createdBy: USER_ID,
      title: 'Compatibility',
      language: 'en-US',
      file: {
        filename: 'compatibility.md',
        mimeType: 'text/markdown',
        bytes: Buffer.from(
          '# Compatibility\n\nAirwave S1 does not support multipoint. Airwave S1 Pro supports two devices.',
        ),
      },
    })

    expect(result.duplicate).toBe(false)
    await service.waitForIdle()

    const document = await repository.getDocument(WORKSPACE_ID, result.document.id)
    const chunks = await repository.listChunks(WORKSPACE_ID, result.document.id)
    expect(document?.status).toBe('ready')
    expect(chunks).toHaveLength(1)
    expect(chunks[0]?.productModels).toEqual(['Airwave S1', 'Airwave S1 Pro'])
  })

  it('returns the existing document for identical bytes without uploading twice', async () => {
    const { repository, service, storage } = createService()
    const input = {
      workspaceId: WORKSPACE_ID,
      createdBy: USER_ID,
      language: 'zh-CN' as const,
      file: {
        filename: 'policy.txt',
        mimeType: 'text/plain',
        bytes: Buffer.from('运输损坏需要在签收后七天内报告。'),
      },
    }

    const first = await service.registerDocument(input)
    await service.waitForIdle()
    const second = await service.registerDocument(input)

    expect(second.duplicate).toBe(true)
    expect(second.document.id).toBe(first.document.id)
    expect(repository.documents.size).toBe(1)
    expect(storage.files.size).toBe(1)
  })
})
