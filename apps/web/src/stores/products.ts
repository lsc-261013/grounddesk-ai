import {
  consoleProductListResponseSchema,
  consoleProductResponseSchema,
  type ConsoleProduct,
  type ProductMutationInput,
} from '@grounddesk/shared'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import { authenticatedApi, workspaceId } from '../lib/api'

export const useProductStore = defineStore('products', () => {
  const products = ref<ConsoleProduct[]>([])
  const isLoading = ref(false)
  const isMutating = ref(false)
  const error = ref<string | null>(null)

  const load = async (): Promise<void> => {
    isLoading.value = true
    error.value = null
    try {
      const response = await authenticatedApi(`/v1/workspaces/${workspaceId()}/products`)
      products.value = consoleProductListResponseSchema.parse(await response.json()).products
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Products could not be loaded.'
    } finally {
      isLoading.value = false
    }
  }

  const save = async (
    productId: string | null,
    input: ProductMutationInput,
  ): Promise<ConsoleProduct | null> => {
    isMutating.value = true
    error.value = null
    try {
      const response = await authenticatedApi(
        productId
          ? `/v1/workspaces/${workspaceId()}/products/${productId}`
          : `/v1/workspaces/${workspaceId()}/products`,
        { method: productId ? 'PATCH' : 'POST', body: JSON.stringify(input) },
      )
      const product = consoleProductResponseSchema.parse(await response.json()).product
      const index = products.value.findIndex((candidate) => candidate.id === product.id)
      if (index >= 0) products.value[index] = product
      else products.value.unshift(product)
      return product
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Product could not be saved.'
      return null
    } finally {
      isMutating.value = false
    }
  }

  return { error, isLoading, isMutating, load, products, save }
})
