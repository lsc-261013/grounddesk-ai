import { createHash } from 'node:crypto'

import type { Locale } from '@grounddesk/shared'

import type { ChunkCandidate, ParsedPage } from './types.js'

interface ChunkOptions {
  targetChars: number
  overlapChars: number
  language: Locale | 'bilingual'
  productModels: readonly string[]
}

interface TextUnit {
  text: string
  pageNumber: number | null
  sectionPath: string[]
}

const normalizeForHash = (text: string): string => text.toLowerCase().replace(/\s+/g, ' ').trim()

const splitLongText = (text: string, targetChars: number): string[] => {
  if (text.length <= targetChars) return [text]

  const sentences = text.split(/(?<=[。！？.!?])\s*/u).filter(Boolean)
  if (sentences.length <= 1) {
    return Array.from({ length: Math.ceil(text.length / targetChars) }, (_, index) =>
      text.slice(index * targetChars, (index + 1) * targetChars).trim(),
    ).filter(Boolean)
  }

  const pieces: string[] = []
  let current = ''

  for (const sentence of sentences) {
    if (current && current.length + sentence.length + 1 > targetChars) {
      pieces.push(current)
      current = sentence
    } else {
      current = current ? `${current} ${sentence}` : sentence
    }
  }

  if (current) pieces.push(current)
  return pieces.flatMap((piece) =>
    piece.length <= targetChars
      ? [piece]
      : Array.from({ length: Math.ceil(piece.length / targetChars) }, (_, index) =>
          piece.slice(index * targetChars, (index + 1) * targetChars).trim(),
        ).filter(Boolean),
  )
}

const toTextUnits = (pages: ParsedPage[], targetChars: number): TextUnit[] => {
  const units: TextUnit[] = []
  const headingPath: string[] = []

  for (const page of pages) {
    const paragraphs = page.text.split(/\n\s*\n/u)

    for (const paragraph of paragraphs) {
      const lines = paragraph
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
      let bodyLines: string[] = []

      const flushBody = (): void => {
        const body = bodyLines.join(' ').replace(/\s+/g, ' ').trim()
        for (const piece of splitLongText(body, targetChars)) {
          units.push({ text: piece, pageNumber: page.pageNumber, sectionPath: [...headingPath] })
        }
        bodyLines = []
      }

      for (const line of lines) {
        const heading = /^(#{1,6})\s+(.+)$/.exec(line)
        if (heading) {
          flushBody()
          const level = heading[1]?.length ?? 1
          const title = heading[2]?.trim()
          if (title) {
            headingPath.splice(level - 1)
            headingPath[level - 1] = title
          }
        } else {
          bodyLines.push(line)
        }
      }

      flushBody()
    }
  }

  return units
}

const detectProductModels = (content: string, productModels: readonly string[]): string[] => {
  const normalizedContent = content.toLocaleLowerCase('en-US')
  return productModels.filter((model) =>
    normalizedContent.includes(model.toLocaleLowerCase('en-US')),
  )
}

const estimateTokenCount = (text: string): number => {
  const cjkCharacters =
    text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu)?.length ?? 0
  const nonCjkWords = text
    .replace(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu, ' ')
    .match(/[\p{L}\p{N}]+/gu)?.length

  return Math.max(1, cjkCharacters + (nonCjkWords ?? 0))
}

export const chunkDocument = (pages: ParsedPage[], options: ChunkOptions): ChunkCandidate[] => {
  const units = toTextUnits(pages, options.targetChars)
  const chunks: ChunkCandidate[] = []
  const seenHashes = new Set<string>()
  let buffer: TextUnit[] = []

  const flush = (preserveOverlap = true): void => {
    if (buffer.length === 0) return

    const content = buffer
      .map((unit) => unit.text)
      .join('\n\n')
      .trim()
    const contentHash = createHash('sha256').update(normalizeForHash(content)).digest('hex')

    if (content && !seenHashes.has(contentHash)) {
      const pageNumbers = buffer
        .map((unit) => unit.pageNumber)
        .filter((value): value is number => value !== null)
      const sectionPath = buffer.at(-1)?.sectionPath ?? []

      chunks.push({
        chunkIndex: chunks.length,
        content,
        contentHash,
        tokenCount: estimateTokenCount(content),
        pageStart: pageNumbers.length > 0 ? Math.min(...pageNumbers) : null,
        pageEnd: pageNumbers.length > 0 ? Math.max(...pageNumbers) : null,
        sectionPath,
        productModels: detectProductModels(content, options.productModels),
        language: options.language,
      })
      seenHashes.add(contentHash)
    }

    if (!preserveOverlap || options.overlapChars === 0) {
      buffer = []
      return
    }

    const overlap: TextUnit[] = []
    let overlapLength = 0
    for (const unit of [...buffer].reverse()) {
      if (overlapLength > 0 && overlapLength + unit.text.length > options.overlapChars) break
      overlap.unshift(unit)
      overlapLength += unit.text.length
    }
    buffer = overlap.length === buffer.length ? [] : overlap
  }

  for (const unit of units) {
    const currentLength = buffer.reduce((total, item) => total + item.text.length + 2, 0)
    const sectionChanged =
      buffer.length > 0 && buffer.at(-1)?.sectionPath.join(' > ') !== unit.sectionPath.join(' > ')

    if (sectionChanged) {
      flush(false)
    } else if (buffer.length > 0 && currentLength + unit.text.length > options.targetChars) {
      flush(true)
    }
    buffer.push(unit)
  }

  flush(false)
  return chunks
}
