import type { ProviderUsage } from './types.js'

export interface GenerationPricing {
  inputCostPerMillionUsd: number
  outputCostPerMillionUsd: number
}

export const estimateGenerationCostUsd = (
  usage: ProviderUsage,
  pricing: GenerationPricing,
): number | null => {
  if (usage.inputTokens === null && usage.outputTokens === null) return null
  const inputCost = ((usage.inputTokens ?? 0) * pricing.inputCostPerMillionUsd) / 1_000_000
  const outputCost = ((usage.outputTokens ?? 0) * pricing.outputCostPerMillionUsd) / 1_000_000
  return Number((inputCost + outputCost).toFixed(8))
}
