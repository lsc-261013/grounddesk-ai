import { extname } from 'node:path'

import { extractText } from 'unpdf'

import { documentKindSchema, type DocumentKind } from '@grounddesk/shared'

import { KnowledgeInputError } from './errors.js'
import type { ParsedDocument, ParsedPage, UploadedKnowledgeFile } from './types.js'

const MIME_TYPES: Readonly<Record<DocumentKind, readonly string[]>> = {
  pdf: ['application/pdf'],
  markdown: ['text/markdown', 'text/plain', 'application/octet-stream'],
  txt: ['text/plain', 'application/octet-stream'],
}

const normalizeText = (text: string): string =>
  text
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[\t ]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

export const sanitizeFilename = (filename: string): string => {
  const normalized = filename.normalize('NFKC').replace(/\\/g, '/')
  const basename = normalized.split('/').at(-1)?.trim() ?? ''
  const sanitized = Array.from(basename)
    .map((character) =>
      character.charCodeAt(0) < 32 || '<>:"|?*'.includes(character) ? '_' : character,
    )
    .join('')
    .replace(/\s+/g, ' ')

  if (!sanitized || sanitized === '.' || sanitized === '..') {
    throw new KnowledgeInputError('The document filename is invalid.')
  }

  return sanitized.slice(0, 180)
}

export const detectDocumentKind = (file: UploadedKnowledgeFile): DocumentKind => {
  const extension = extname(file.filename).toLowerCase()
  const kind =
    extension === '.pdf' ? 'pdf' : ['.md', '.markdown'].includes(extension) ? 'markdown' : 'txt'

  if (!['.pdf', '.md', '.markdown', '.txt'].includes(extension)) {
    throw new KnowledgeInputError('Only PDF, Markdown, and TXT documents are supported.')
  }

  const parsedKind = documentKindSchema.parse(kind)
  if (!MIME_TYPES[parsedKind].includes(file.mimeType.toLowerCase())) {
    throw new KnowledgeInputError('The file content type does not match an allowed document type.')
  }

  if (parsedKind === 'pdf' && file.bytes.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new KnowledgeInputError('The uploaded file is not a valid PDF document.')
  }

  return parsedKind
}

const decodeText = (bytes: Buffer): string => {
  if (bytes.includes(0)) {
    throw new KnowledgeInputError('The text document contains binary data.')
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new KnowledgeInputError('Text documents must use UTF-8 encoding.')
  }
}

const parsePdf = async (bytes: Buffer): Promise<ParsedPage[]> => {
  try {
    const result = await extractText(new Uint8Array(bytes), { mergePages: false })
    return result.text.map((text, index) => ({ pageNumber: index + 1, text: normalizeText(text) }))
  } catch (cause) {
    const message = cause instanceof Error ? cause.message.toLowerCase() : ''
    if (message.includes('password')) {
      throw new KnowledgeInputError('Password-protected PDF documents are not supported.')
    }
    throw new KnowledgeInputError('The PDF document could not be parsed.')
  }
}

export const parseKnowledgeDocument = async (
  file: UploadedKnowledgeFile,
): Promise<ParsedDocument> => {
  if (file.bytes.length === 0) {
    throw new KnowledgeInputError('The uploaded document is empty.')
  }

  const filename = sanitizeFilename(file.filename)
  const kind = detectDocumentKind({ ...file, filename })
  const pages =
    kind === 'pdf'
      ? await parsePdf(file.bytes)
      : [{ pageNumber: null, text: normalizeText(decodeText(file.bytes)) }]

  if (!pages.some((page) => page.text.length > 0)) {
    throw new KnowledgeInputError(
      kind === 'pdf'
        ? 'No readable text was found. Scanned PDFs require OCR before upload.'
        : 'The uploaded document contains no readable text.',
    )
  }

  return { kind, pages }
}
