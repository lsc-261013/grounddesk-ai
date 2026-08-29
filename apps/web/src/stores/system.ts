import { healthResponseSchema, type HealthResponse } from '@grounddesk/shared'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787'

export const useSystemStore = defineStore('system', () => {
  const health = ref<HealthResponse | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const apiStatus = computed(() => {
    if (isLoading.value) return 'checking'
    if (health.value?.status === 'ok') return 'ready'
    return 'unavailable'
  })

  const checkHealth = async (): Promise<void> => {
    isLoading.value = true
    error.value = null

    try {
      const response = await fetch(`${API_BASE_URL}/health`)
      if (!response.ok) {
        throw new Error(`Health request failed with status ${response.status}`)
      }
      health.value = healthResponseSchema.parse(await response.json())
    } catch (cause) {
      health.value = null
      error.value = cause instanceof Error ? cause.message : 'Unknown health check error'
    } finally {
      isLoading.value = false
    }
  }

  return { apiStatus, checkHealth, error, health, isLoading }
})
