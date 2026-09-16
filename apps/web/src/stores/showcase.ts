import {
  publicEvaluationSummaryResponseSchema,
  publicProductListResponseSchema,
  type PublicEvaluationSummary,
  type PublicProduct,
} from '@grounddesk/shared'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787'

export const useShowcaseStore = defineStore('showcase', () => {
  const products = ref<PublicProduct[]>([])
  const evaluation = ref<PublicEvaluationSummary | null>(null)
  const isProductsLoading = ref(false)
  const isEvaluationLoading = ref(false)
  const productError = ref<string | null>(null)
  const evaluationError = ref<string | null>(null)
  const isLoading = computed(() => isProductsLoading.value || isEvaluationLoading.value)
  const error = computed(() => productError.value ?? evaluationError.value)

  const loadProducts = async (force = false): Promise<void> => {
    if (!force && products.value.length > 0) return
    isProductsLoading.value = true
    productError.value = null
    try {
      const productsResponse = await fetch(
        `${API_BASE_URL}/v1/public/workspaces/avenlo-demo/products`,
      )
      if (!productsResponse.ok) throw new Error('Public product data is temporarily unavailable.')
      products.value = publicProductListResponseSchema.parse(await productsResponse.json()).products
    } catch (cause) {
      productError.value = cause instanceof Error ? cause.message : 'Public product loading failed.'
    } finally {
      isProductsLoading.value = false
    }
  }

  const loadEvaluation = async (force = false): Promise<void> => {
    if (!force && evaluation.value) return
    isEvaluationLoading.value = true
    evaluationError.value = null
    try {
      const evaluationResponse = await fetch(
        `${API_BASE_URL}/v1/public/workspaces/avenlo-demo/evaluations/latest`,
      )
      if (!evaluationResponse.ok) {
        throw new Error('Public evaluation data is temporarily unavailable.')
      }
      evaluation.value = publicEvaluationSummaryResponseSchema.parse(
        await evaluationResponse.json(),
      ).evaluation
    } catch (cause) {
      evaluationError.value =
        cause instanceof Error ? cause.message : 'Public evaluation loading failed.'
    } finally {
      isEvaluationLoading.value = false
    }
  }

  const load = async (force = false): Promise<void> => {
    await Promise.all([loadProducts(force), loadEvaluation(force)])
  }

  return {
    error,
    evaluation,
    evaluationError,
    isEvaluationLoading,
    isLoading,
    isProductsLoading,
    load,
    loadEvaluation,
    loadProducts,
    productError,
    products,
  }
})
