import {
  publicEvaluationSummaryResponseSchema,
  publicProductListResponseSchema,
  type PublicEvaluationSummary,
  type PublicProduct,
} from '@grounddesk/shared'
import { defineStore } from 'pinia'
import { ref } from 'vue'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787'

export const useShowcaseStore = defineStore('showcase', () => {
  const products = ref<PublicProduct[]>([])
  const evaluation = ref<PublicEvaluationSummary | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const load = async (): Promise<void> => {
    if (products.value.length > 0 && evaluation.value) return
    isLoading.value = true
    error.value = null
    try {
      const [productsResponse, evaluationResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/v1/public/workspaces/avenlo-demo/products`),
        fetch(`${API_BASE_URL}/v1/public/workspaces/avenlo-demo/evaluations/latest`),
      ])
      if (!productsResponse.ok || !evaluationResponse.ok) {
        throw new Error('The public Demo data is temporarily unavailable.')
      }
      products.value = publicProductListResponseSchema.parse(await productsResponse.json()).products
      evaluation.value = publicEvaluationSummaryResponseSchema.parse(
        await evaluationResponse.json(),
      ).evaluation
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Public Demo loading failed.'
    } finally {
      isLoading.value = false
    }
  }

  return { error, evaluation, isLoading, load, products }
})
