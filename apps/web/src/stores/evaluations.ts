import {
  evaluationCaseListResponseSchema,
  evaluationRunDetailResponseSchema,
  evaluationRunListResponseSchema,
  evaluationRunResponseSchema,
  type EvaluationCase,
  type EvaluationResult,
  type EvaluationRun,
} from '@grounddesk/shared'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import { authenticatedApi, workspaceId } from '../lib/api'

export const useEvaluationStore = defineStore('evaluations', () => {
  const cases = ref<EvaluationCase[]>([])
  const runs = ref<EvaluationRun[]>([])
  const selectedRun = ref<EvaluationRun | null>(null)
  const results = ref<EvaluationResult[]>([])
  const isLoading = ref(false)
  const isRunning = ref(false)
  const error = ref<string | null>(null)

  const load = async (): Promise<void> => {
    isLoading.value = true
    error.value = null
    try {
      const [caseResponse, runResponse] = await Promise.all([
        authenticatedApi(`/v1/workspaces/${workspaceId()}/evaluations/cases`),
        authenticatedApi(`/v1/workspaces/${workspaceId()}/evaluations/runs`),
      ])
      cases.value = evaluationCaseListResponseSchema.parse(await caseResponse.json()).cases
      runs.value = evaluationRunListResponseSchema.parse(await runResponse.json()).runs
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Evaluation loading failed.'
    } finally {
      isLoading.value = false
    }
  }

  const detail = async (runId: string): Promise<void> => {
    const response = await authenticatedApi(
      `/v1/workspaces/${workspaceId()}/evaluations/runs/${runId}`,
    )
    const payload = evaluationRunDetailResponseSchema.parse(await response.json())
    selectedRun.value = payload.run
    results.value = payload.results
  }

  const run = async (providerMode: 'mock' | 'live'): Promise<void> => {
    isRunning.value = true
    error.value = null
    try {
      const response = await authenticatedApi(`/v1/workspaces/${workspaceId()}/evaluations/runs`, {
        method: 'POST',
        body: JSON.stringify({ providerMode }),
      })
      const created = evaluationRunResponseSchema.parse(await response.json()).run
      selectedRun.value = created
      results.value = []
      for (let attempt = 0; attempt < 90; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 1_000))
        await detail(created.id)
        if (selectedRun.value?.status === 'completed' || selectedRun.value?.status === 'failed')
          break
      }
      await load()
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Evaluation run failed.'
    } finally {
      isRunning.value = false
    }
  }

  const closeDetail = (): void => {
    selectedRun.value = null
    results.value = []
  }

  return {
    cases,
    closeDetail,
    detail,
    error,
    isLoading,
    isRunning,
    load,
    results,
    run,
    runs,
    selectedRun,
  }
})
