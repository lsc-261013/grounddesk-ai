import {
  consoleOrderListResponseSchema,
  consoleOrderResponseSchema,
  type ConsoleOrder,
  type OrderStatus,
} from '@grounddesk/shared'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import { authenticatedApi, workspaceId } from '../lib/api'

export const useOrderStore = defineStore('orders', () => {
  const orders = ref<ConsoleOrder[]>([])
  const total = ref(0)
  const isLoading = ref(false)
  const isMutating = ref(false)
  const error = ref<string | null>(null)

  const load = async (query = '', status: OrderStatus | '' = ''): Promise<void> => {
    isLoading.value = true
    error.value = null
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (query.trim()) params.set('query', query.trim())
      if (status) params.set('status', status)
      const response = await authenticatedApi(
        `/v1/workspaces/${workspaceId()}/orders?${params.toString()}`,
      )
      const payload = consoleOrderListResponseSchema.parse(await response.json())
      orders.value = payload.orders
      total.value = payload.total
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Orders could not be loaded.'
    } finally {
      isLoading.value = false
    }
  }

  const updateStatus = async (orderId: string, status: OrderStatus): Promise<boolean> => {
    isMutating.value = true
    error.value = null
    try {
      const response = await authenticatedApi(
        `/v1/workspaces/${workspaceId()}/orders/${orderId}/status`,
        { method: 'PATCH', body: JSON.stringify({ status }) },
      )
      const { order } = consoleOrderResponseSchema.parse(await response.json())
      const index = orders.value.findIndex((candidate) => candidate.id === order.id)
      if (index >= 0) orders.value[index] = order
      return true
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Order status could not be updated.'
      return false
    } finally {
      isMutating.value = false
    }
  }

  return { error, isLoading, isMutating, load, orders, total, updateStatus }
})
