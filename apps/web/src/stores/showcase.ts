import {
  publicEvaluationSummaryResponseSchema,
  publicProductListResponseSchema,
  type PublicEvaluationSummary,
  type PublicProduct,
} from '@grounddesk/shared'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { PUBLIC_REQUEST_SLOW_MS, readPublicJson } from '../lib/public-request'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787'

export const useShowcaseStore = defineStore('showcase', () => {
  const products = ref<PublicProduct[]>([])
  const evaluation = ref<PublicEvaluationSummary | null>(null)
  const isProductsLoading = ref(false)
  const isEvaluationLoading = ref(false)
  const isProductsSlow = ref(false)
  const isEvaluationSlow = ref(false)
  const productError = ref<string | null>(null)
  const evaluationError = ref<string | null>(null)
  const isLoading = computed(() => isProductsLoading.value || isEvaluationLoading.value)
  const error = computed(() => productError.value ?? evaluationError.value)
  let productsLoaded = false
  let evaluationLoaded = false
  let productsRequest: Promise<void> | null = null
  let evaluationRequest: Promise<void> | null = null

  const loadProducts = (force = false): Promise<void> => {
    if (productsRequest) return productsRequest
    if (!force && productsLoaded) return Promise.resolve()
    isProductsLoading.value = true
    isProductsSlow.value = false
    productError.value = null
    const slowTimer = setTimeout(() => {
      isProductsSlow.value = true
    }, PUBLIC_REQUEST_SLOW_MS)
    productsRequest = (async () => {
      try {
        const payload = await readPublicJson(
          `${API_BASE_URL}/v1/public/workspaces/avenlo-demo/products`,
        )
        products.value = publicProductListResponseSchema.parse(payload).products
        productsLoaded = true
      } catch {
        productError.value = 'Public product data is temporarily unavailable.'
      } finally {
        clearTimeout(slowTimer)
        isProductsSlow.value = false
        isProductsLoading.value = false
        productsRequest = null
      }
    })()
    return productsRequest
  }

  const loadEvaluation = (force = false): Promise<void> => {
    if (evaluationRequest) return evaluationRequest
    if (!force && evaluationLoaded) return Promise.resolve()
    isEvaluationLoading.value = true
    isEvaluationSlow.value = false
    evaluationError.value = null
    const slowTimer = setTimeout(() => {
      isEvaluationSlow.value = true
    }, PUBLIC_REQUEST_SLOW_MS)
    evaluationRequest = (async () => {
      try {
        const payload = await readPublicJson(
          `${API_BASE_URL}/v1/public/workspaces/avenlo-demo/evaluations/latest`,
        )
        evaluation.value = publicEvaluationSummaryResponseSchema.parse(payload).evaluation
        evaluationLoaded = true
      } catch {
        evaluationError.value = 'Public evaluation data is temporarily unavailable.'
      } finally {
        clearTimeout(slowTimer)
        isEvaluationSlow.value = false
        isEvaluationLoading.value = false
        evaluationRequest = null
      }
    })()
    return evaluationRequest
  }

  const load = async (force = false): Promise<void> => {
    await Promise.all([loadProducts(force), loadEvaluation(force)])
  }

  return {
    error,
    evaluation,
    evaluationError,
    isEvaluationLoading,
    isEvaluationSlow,
    isLoading,
    isProductsLoading,
    isProductsSlow,
    load,
    loadEvaluation,
    loadProducts,
    productError,
    products,
  }
})
