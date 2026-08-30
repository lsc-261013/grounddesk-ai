import type { EvaluationCase } from '@grounddesk/shared'
import { describe, expect, it } from 'vitest'

import { calculateEvaluationMetrics, scoreOutcome } from '../src/evaluations/scoring.js'

const caseValue = (
  id: string,
  category: EvaluationCase['category'],
  expected: Record<string, unknown>,
): EvaluationCase => ({
  id,
  caseKey: `${category}_${id.slice(0, 2)}`,
  category,
  locale: 'en-US',
  input: { kind: 'chat', message: 'test' },
  expected,
  enabled: true,
})

describe('evaluation scoring', () => {
  it('requires expected citations and deterministic outcome fields', () => {
    const evaluationCase = caseValue('11111111-1111-4111-8111-111111111111', 'knowledge', {
      citationTitles: ['Expected Policy'],
      refused: false,
    })
    expect(
      scoreOutcome(evaluationCase, {
        citationTitles: ['Expected Policy', 'Other Source'],
        refused: false,
      }).passed,
    ).toBe(true)
    expect(
      scoreOutcome(evaluationCase, { citationTitles: ['Other Source'], refused: false }).failures,
    ).toContain('missing_citations:Expected Policy')
  })

  it('computes category metrics from recorded outcomes instead of constants', () => {
    const knowledge = caseValue('11111111-1111-4111-8111-111111111111', 'knowledge', {
      citationTitles: ['Policy'],
    })
    const refusal = caseValue('22222222-2222-4222-8222-222222222222', 'unknown', {
      refused: true,
      handedOff: true,
    })
    const tool = caseValue('33333333-3333-4333-8333-333333333333', 'return', {
      toolName: 'return_eligibility',
      eligibility: 'eligible',
    })
    const isolation = caseValue('44444444-4444-4444-8444-444444444444', 'isolation', {
      leaked: false,
    })
    const results = [
      scoreOutcome(knowledge, { citationTitles: ['Policy'] }),
      scoreOutcome(refusal, { refused: true, handedOff: true }),
      scoreOutcome(tool, { toolName: 'return_eligibility', eligibility: 'eligible' }),
      scoreOutcome(isolation, { leaked: false }),
    ]

    expect(calculateEvaluationMetrics([knowledge, refusal, tool, isolation], results)).toEqual({
      total: 4,
      passed: 4,
      failed: 0,
      citationCoverage: 1,
      retrievalAt5: 1,
      refusalHandoffRate: 1,
      toolSelectionAccuracy: 1,
      returnRuleAccuracy: 1,
      isolationPassRate: 1,
    })
  })
})
