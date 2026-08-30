import { describe, expect, it } from 'vitest'

import { estimateGenerationCostUsd } from '../src/generation/cost.js'

describe('generation cost estimation', () => {
  it('calculates a conservative token cost from configurable rates', () => {
    expect(
      estimateGenerationCostUsd(
        { inputTokens: 1_000_000, outputTokens: 500_000, totalTokens: 1_500_000, available: true },
        { inputCostPerMillionUsd: 0.44, outputCostPerMillionUsd: 1.32 },
      ),
    ).toBe(1.1)
  })

  it('returns unavailable when the provider reports no token fields', () => {
    expect(
      estimateGenerationCostUsd(
        { inputTokens: null, outputTokens: null, totalTokens: null, available: false },
        { inputCostPerMillionUsd: 0.44, outputCostPerMillionUsd: 1.32 },
      ),
    ).toBeNull()
  })
})
