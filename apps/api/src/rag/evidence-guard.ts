import type { ChatCitation, RetrievalEvidence } from '@grounddesk/shared'

export type EvidenceRejectionReason = 'no_evidence' | 'low_confidence' | 'conflict'

export interface EvidenceAssessment {
  accepted: RetrievalEvidence[]
  checked: RetrievalEvidence[]
  rejectionReason: EvidenceRejectionReason | null
}

const normalizeFactText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[，。；：、,.!?;:()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const factSubject = (evidence: RetrievalEvidence): string =>
  normalizeFactText(evidence.sectionPath.at(-1) ?? evidence.documentTitle)

const extractComparableFacts = (evidence: RetrievalEvidence): Map<string, string> => {
  const facts = new Map<string, string>()
  const text = normalizeFactText(evidence.content)
  const subject = factSubject(evidence)
  const durationPatterns = [
    { key: 'return_window', context: /退货|return/, pattern: /(\d+)\s*(天|days?)/ },
    { key: 'damage_report', context: /损坏|damage/, pattern: /(\d+)\s*(天|days?)/ },
    { key: 'warranty', context: /保修|warranty/, pattern: /(\d+)\s*(年|years?|个月|months?)/ },
  ]
  for (const candidate of durationPatterns) {
    if (!candidate.context.test(text)) continue
    const match = text.match(candidate.pattern)
    if (match?.[1]) facts.set(`${candidate.key}:${subject}`, match[0])
  }

  if (/多设备|multipoint/.test(text)) {
    const negative = /不支持多设备|does not support multipoint|multipoint is not supported/.test(
      text,
    )
    const positive = /支持.{0,12}(双设备|两台)|supports?.{0,16}(two.device|multipoint)/.test(text)
    if (negative || positive) facts.set(`multipoint:${subject}`, negative ? 'false' : 'true')
  }
  return facts
}

export const detectEvidenceConflict = (evidence: readonly RetrievalEvidence[]): boolean => {
  const observed = new Map<string, string>()
  for (const candidate of evidence) {
    for (const [key, value] of extractComparableFacts(candidate)) {
      const previous = observed.get(key)
      if (previous !== undefined && previous !== value) return true
      observed.set(key, value)
    }
  }
  return false
}

export const assessEvidence = (
  evidence: readonly RetrievalEvidence[],
  threshold: number,
): EvidenceAssessment => {
  const checked = [...evidence].slice(0, 8)
  if (checked.length === 0) return { accepted: [], checked, rejectionReason: 'no_evidence' }

  const topSimilarity = checked[0]?.vectorSimilarity ?? -1
  const topHasKeyword = checked[0]?.keywordRank !== null
  if (topSimilarity < threshold && !topHasKeyword) {
    return { accepted: [], checked, rejectionReason: 'low_confidence' }
  }

  const accepted = checked
    .filter((candidate) => {
      const similarity = candidate.vectorSimilarity ?? -1
      return (
        similarity >= threshold - 0.08 &&
        (candidate.keywordRank !== null || similarity >= topSimilarity - 0.06)
      )
    })
    .slice(0, 5)
  if (accepted.length === 0) return { accepted, checked, rejectionReason: 'low_confidence' }
  if (detectEvidenceConflict(accepted)) {
    return { accepted: [], checked, rejectionReason: 'conflict' }
  }
  return { accepted, checked, rejectionReason: null }
}

export const isPromptInjectionAttempt = (message: string): boolean => {
  const normalized = message.toLowerCase()
  return [
    /ignore.{0,30}(previous|system|instruction|rule)/,
    /reveal.{0,30}(system prompt|hidden prompt|instruction)/,
    /bypass.{0,30}(rule|policy|authorization)/,
    /忽略.{0,20}(之前|系统|规则|指令)/,
    /(泄露|显示|告诉我).{0,20}(系统提示|隐藏提示|系统指令)/,
    /(绕过|越过).{0,20}(规则|权限|验证)/,
  ].some((pattern) => pattern.test(normalized))
}

export const requestsHumanSupport = (message: string): boolean =>
  /(人工|真人|客服人员|转接客服|human agent|real person|human support|representative)/i.test(
    message,
  )

export const validateAnswerCitations = (
  answer: string,
  evidenceCount: number,
): { valid: boolean; ordinals: number[] } => {
  const ordinals = [
    ...new Set(
      [...answer.matchAll(/\[(\d+)\]/g)]
        .map((match) => Number(match[1]))
        .filter((ordinal) => Number.isInteger(ordinal)),
    ),
  ]
  if (ordinals.length === 0 || ordinals.some((ordinal) => ordinal < 1 || ordinal > evidenceCount)) {
    return { valid: false, ordinals }
  }

  const factualSignal =
    /\d|support|compatible|warranty|return window|battery|支持|不支持|兼容|保修|退货|电池|连接|续航/i
  const paragraphs = answer
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length >= 12)
  const uncitedFacts = paragraphs.filter((paragraph) => {
    const withoutMarker = paragraph.replace(/\[\d+\]/g, '').trim()
    if (!factualSignal.test(withoutMarker)) return false
    return !/\[\d+\]/.test(paragraph)
  })
  return { valid: uncitedFacts.length === 0, ordinals }
}

export const createCitations = (
  ordinals: readonly number[],
  evidence: readonly RetrievalEvidence[],
): ChatCitation[] =>
  ordinals.flatMap((ordinal) => {
    const source = evidence[ordinal - 1]
    if (!source) return []
    return [
      {
        ordinal,
        chunkId: source.chunkId,
        documentId: source.documentId,
        documentTitle: source.documentTitle,
        sectionPath: source.sectionPath,
        pageStart: source.pageStart,
        pageEnd: source.pageEnd,
        quote: source.content.slice(0, 420),
      },
    ]
  })
