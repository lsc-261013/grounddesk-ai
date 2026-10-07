export type AnswerInline =
  | { kind: 'text' | 'strong'; text: string }
  | { kind: 'link'; text: string; href: string }
  | { kind: 'citation'; text: string; ordinal: number }

export interface AnswerBlock {
  kind: 'paragraph' | 'unordered' | 'ordered'
  lines: string[]
}

const safeLink = (href: string): boolean => {
  try {
    return ['https:', 'http:'].includes(new URL(href).protocol)
  } catch {
    return false
  }
}

export const answerInlines = (text: string, ordinals: number[]): AnswerInline[] => {
  const result: AnswerInline[] = []
  // Masked customer names contain asterisks too; formatting must not consume them.
  const pattern =
    /(?<![\p{L}\p{N}*])\*\*[^*\n]+\*\*(?![\p{L}\p{N}*])|\[[^\]\n]+\]\([^\s)]+\)|\[\d+\]/gu
  let offset = 0
  for (const match of text.matchAll(pattern)) {
    const index = match.index
    if (index > offset) result.push({ kind: 'text', text: text.slice(offset, index) })
    const value = match[0]
    const link = /^\[([^\]]+)\]\((.+)\)$/.exec(value)
    const ordinal = /^\[(\d+)\]$/.exec(value)
    if (value.startsWith('**')) result.push({ kind: 'strong', text: value.slice(2, -2) })
    else if (link && safeLink(link[2] ?? '')) {
      result.push({ kind: 'link', text: link[1] ?? '', href: link[2] ?? '' })
    } else if (ordinal && ordinals.includes(Number(ordinal[1]))) {
      result.push({ kind: 'citation', text: value, ordinal: Number(ordinal[1]) })
    } else result.push({ kind: 'text', text: value })
    offset = index + value.length
  }
  if (offset < text.length) result.push({ kind: 'text', text: text.slice(offset) })
  return result
}

export const answerBlocks = (content: string): AnswerBlock[] => {
  const blocks: AnswerBlock[] = []
  let current: AnswerBlock | undefined
  for (const line of content.split('\n')) {
    if (!line.trim()) {
      current = undefined
      continue
    }
    const bullet = /^\s*[-*]\s+(.+)$/.exec(line)
    const ordered = /^\s*\d+[.)]\s+(.+)$/.exec(line)
    const kind = bullet ? 'unordered' : ordered ? 'ordered' : 'paragraph'
    if (!current || current.kind !== kind) {
      current = { kind, lines: [] }
      blocks.push(current)
    }
    current.lines.push(bullet?.[1] ?? ordered?.[1] ?? line)
  }
  return blocks
}
