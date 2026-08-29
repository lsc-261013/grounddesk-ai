import type { DocumentKind, KnowledgeChunkPreview, KnowledgeDocument } from '@grounddesk/shared'

export interface ParsedPage {
  pageNumber: number | null
  text: string
}

export interface ParsedDocument {
  kind: DocumentKind
  pages: ParsedPage[]
}

export interface ChunkCandidate extends Omit<KnowledgeChunkPreview, 'id'> {
  contentHash: string
}

export interface UploadedKnowledgeFile {
  filename: string
  mimeType: string
  bytes: Buffer
}

export interface StoredDocumentResult {
  document: KnowledgeDocument
  duplicate: boolean
}
