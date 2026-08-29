import { describe, expect, it } from 'vitest'

import { chunkDocument } from '../src/knowledge/chunker.js'
import {
  detectDocumentKind,
  parseKnowledgeDocument,
  sanitizeFilename,
} from '../src/knowledge/document-parser.js'
import { buildKeywordQuery } from '../src/knowledge/keyword-query.js'

const createSinglePagePdf = (text: string): Buffer => {
  const escapedText = text.replace(/[\\()]/g, '\\$&')
  const stream = `BT /F1 12 Tf 72 720 Td (${escapedText}) Tj ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ]
  let source = '%PDF-1.4\n'
  const offsets = objects.map((object, index) => {
    const offset = Buffer.byteLength(source)
    source += `${index + 1} 0 obj\n${object}\nendobj\n`
    return offset
  })
  const xrefOffset = Buffer.byteLength(source)
  source += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  source += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
  source += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  return Buffer.from(source, 'ascii')
}

describe('knowledge document input', () => {
  it('sanitizes path-like filenames without trusting client paths', () => {
    expect(sanitizeFilename('..\\policy:2026?.md')).toBe('policy_2026_.md')
  })

  it('rejects a PDF extension whose content has no PDF signature', () => {
    expect(() =>
      detectDocumentKind({
        filename: 'policy.pdf',
        mimeType: 'application/pdf',
        bytes: Buffer.from('not a pdf'),
      }),
    ).toThrow('not a valid PDF')
  })

  it('rejects empty text after normalization', async () => {
    await expect(
      parseKnowledgeDocument({
        filename: 'empty.txt',
        mimeType: 'text/plain',
        bytes: Buffer.from('\n\n  '),
      }),
    ).rejects.toThrow('no readable text')
  })

  it('extracts text and page metadata from a real PDF byte stream', async () => {
    const parsed = await parseKnowledgeDocument({
      filename: 'policy.pdf',
      mimeType: 'application/pdf',
      bytes: createSinglePagePdf('GroundDesk warranty policy'),
    })

    expect(parsed.kind).toBe('pdf')
    expect(parsed.pages).toHaveLength(1)
    expect(parsed.pages[0]).toMatchObject({ pageNumber: 1 })
    expect(parsed.pages[0]?.text).toContain('GroundDesk warranty policy')
  })
})

describe('structured chunking', () => {
  it('preserves headings, pages, language, and product model metadata', () => {
    const chunks = chunkDocument(
      [
        {
          pageNumber: 2,
          text: '# Compatibility\n\nAirwave S1 does not support multipoint.\n\nAirwave S1 Pro supports two devices.',
        },
      ],
      {
        targetChars: 400,
        overlapChars: 80,
        language: 'en-US',
        productModels: ['Airwave S1', 'Airwave S1 Pro', 'Flux 67'],
      },
    )

    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toMatchObject({
      chunkIndex: 0,
      pageStart: 2,
      pageEnd: 2,
      sectionPath: ['Compatibility'],
      language: 'en-US',
      productModels: ['Airwave S1', 'Airwave S1 Pro'],
    })
    expect(chunks[0]?.contentHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('starts a new chunk when the Markdown section changes', () => {
    const chunks = chunkDocument(
      [
        {
          pageNumber: null,
          text: '# Guide\n\n## Airwave S1\n\nNo multipoint.\n\n## Airwave S1 Pro\n\nTwo-device multipoint.',
        },
      ],
      {
        targetChars: 400,
        overlapChars: 80,
        language: 'en-US',
        productModels: ['Airwave S1', 'Airwave S1 Pro'],
      },
    )

    expect(chunks).toHaveLength(2)
    expect(chunks.map((chunk) => chunk.sectionPath.at(-1))).toEqual([
      'Airwave S1',
      'Airwave S1 Pro',
    ])
    expect(chunks[1]?.content).toBe('Two-device multipoint.')
  })

  it('deduplicates identical chunks and keeps deterministic indexes', () => {
    const repeated = 'Carry power banks in cabin baggage only. '.repeat(13).trim()
    const chunks = chunkDocument(
      [
        { pageNumber: 1, text: repeated },
        { pageNumber: 2, text: repeated },
      ],
      {
        targetChars: 400,
        overlapChars: 0,
        language: 'en-US',
        productModels: [],
      },
    )

    expect(new Set(chunks.map((chunk) => chunk.contentHash)).size).toBe(chunks.length)
    expect(chunks.map((chunk) => chunk.chunkIndex)).toEqual(chunks.map((_chunk, index) => index))
  })
})

describe('keyword query normalization', () => {
  it('removes English stop words and creates an OR recall query', () => {
    expect(buildKeywordQuery('How long is the warranty for a LinkCore C240 cable?')).toBe(
      'long OR warranty OR linkcore OR c240 OR cable',
    )
  })
})
