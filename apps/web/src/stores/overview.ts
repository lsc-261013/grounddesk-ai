import { overviewMetricsResponseSchema, type OverviewMetrics } from '@grounddesk/shared'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import { authenticatedApi, workspaceId } from '../lib/api'

export const useOverviewStore = defineStore('overview', () => {
  const metrics = ref<OverviewMetrics | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const load = async (): Promise<void> => {
    isLoading.value = true
    error.value = null
    try {
      const response = await authenticatedApi(`/v1/workspaces/${workspaceId()}/overview`)
      metrics.value = overviewMetricsResponseSchema.parse(await response.json()).metrics
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Overview loading failed.'
    } finally {
      isLoading.value = false
    }
  }

  return { error, isLoading, load, metrics }
})
