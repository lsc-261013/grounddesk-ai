import type { EvaluationCase, EvaluationMetrics, EvaluationResult } from '@grounddesk/shared'

const stringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

const equalExpected = (actual: unknown, expected: unknown): boolean => actual === expected

export const scoreOutcome = (
  evaluationCase: EvaluationCase,
  actual: Record<string, unknown>,
): Omit<EvaluationResult, 'id'> => {
  const failures: string[] = []
  for (const [key, expected] of Object.entries(evaluationCase.expected)) {
    if (key === 'citationTitles') {
      const citations = new Set(stringArray(actual.citationTitles))
      const missing = stringArray(expected).filter((title) => !citations.has(title))
      if (missing.length > 0) failures.push(`missing_citations:${missing.join('|')}`)
      continue
    }
    if (!equalExpected(actual[key], expected)) {
      failures.push(`${key}:expected=${String(expected)}:actual=${String(actual[key])}`)
    }
  }
  return {
    caseId: evaluationCase.id,
    caseKey: evaluationCase.caseKey,
    category: evaluationCase.category,
    locale: evaluationCase.locale,
    passed: failures.length === 0,
    actual,
    failures,
    latencyMs:
      typeof actual.latencyMs === 'number' ? Math.max(0, Math.round(actual.latencyMs)) : null,
  }
}

const ratio = (passed: number, total: number): number | null =>
  total === 0 ? null : passed / total

export const calculateEvaluationMetrics = (
  cases: EvaluationCase[],
  results: Array<Omit<EvaluationResult, 'id'>>,
): EvaluationMetrics => {
  const caseById = new Map(cases.map((evaluationCase) => [evaluationCase.id, evaluationCase]))
  const inCategory = (categories: string[]) =>
    results.filter((result) => categories.includes(caseById.get(result.caseId)?.category ?? ''))
  const knowledge = inCategory(['knowledge'])
  const refusal = inCategory(['unknown', 'security'])
  const tools = inCategory(['order', 'return'])
  const returns = inCategory(['return'])
  const isolation = inCategory(['isolation'])
  const hasCitations = (result: Omit<EvaluationResult, 'id'>): boolean =>
    stringArray(result.actual.citationTitles).length > 0
  const expectedCitationFound = (result: Omit<EvaluationResult, 'id'>): boolean => {
    const expected = stringArray(caseById.get(result.caseId)?.expected.citationTitles)
    const actual = new Set(stringArray(result.actual.citationTitles))
    return expected.length > 0 && expected.some((title) => actual.has(title))
  }

  return {
    total: results.length,
    passed: results.filter((result) => result.passed).length,
    failed: results.filter((result) => !result.passed).length,
    citationCoverage: ratio(knowledge.filter(hasCitations).length, knowledge.length),
    retrievalAt5: ratio(knowledge.filter(expectedCitationFound).length, knowledge.length),
    refusalHandoffRate: ratio(
      refusal.filter((result) => result.actual.refused === true && result.actual.handedOff === true)
        .length,
      refusal.length,
    ),
    toolSelectionAccuracy: ratio(
      tools.filter((result) => !result.failures.some((failure) => failure.startsWith('toolName:')))
        .length,
      tools.length,
    ),
    returnRuleAccuracy: ratio(
      returns.filter(
        (result) => !result.failures.some((failure) => failure.startsWith('eligibility:')),
      ).length,
      returns.length,
    ),
    isolationPassRate: ratio(isolation.filter((result) => result.passed).length, isolation.length),
  }
}
