import {
  webhookDeliveryListResponseSchema,
  webhookEndpointCreateResponseSchema,
  webhookEndpointListResponseSchema,
  webhookEndpointResponseSchema,
  webhookTestResponseSchema,
  type WebhookDelivery,
  type WebhookEndpoint,
  type WebhookEvent,
} from '@grounddesk/shared'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import { authenticatedApi, workspaceId } from '../lib/api'

export const useWebhookStore = defineStore('webhooks', () => {
  const endpoints = ref<WebhookEndpoint[]>([])
  const deliveries = ref<WebhookDelivery[]>([])
  const revealedSecret = ref<string | null>(null)
  const isLoading = ref(false)
  const isMutating = ref(false)
  const error = ref<string | null>(null)

  const load = async (): Promise<void> => {
    isLoading.value = true
    error.value = null
    try {
      const [endpointResponse, deliveryResponse] = await Promise.all([
        authenticatedApi(`/v1/workspaces/${workspaceId()}/webhooks`),
        authenticatedApi(`/v1/workspaces/${workspaceId()}/webhook-deliveries`),
      ])
      endpoints.value = webhookEndpointListResponseSchema.parse(
        await endpointResponse.json(),
      ).endpoints
      deliveries.value = webhookDeliveryListResponseSchema.parse(
        await deliveryResponse.json(),
      ).deliveries
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Webhook loading failed.'
    } finally {
      isLoading.value = false
    }
  }

  const create = async (url: string, subscribedEvents: WebhookEvent[]): Promise<boolean> => {
    isMutating.value = true
    error.value = null
    revealedSecret.value = null
    try {
      const response = await authenticatedApi(`/v1/workspaces/${workspaceId()}/webhooks`, {
        method: 'POST',
        body: JSON.stringify({ url, subscribedEvents }),
      })
      const payload = webhookEndpointCreateResponseSchema.parse(await response.json())
      revealedSecret.value = payload.signingSecret
      await load()
      return true
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Webhook creation failed.'
      return false
    } finally {
      isMutating.value = false
    }
  }

  const setEnabled = async (endpointId: string, enabled: boolean): Promise<void> => {
    isMutating.value = true
    error.value = null
    try {
      const response = await authenticatedApi(
        `/v1/workspaces/${workspaceId()}/webhooks/${endpointId}`,
        { method: 'PATCH', body: JSON.stringify({ enabled }) },
      )
      const endpoint = webhookEndpointResponseSchema.parse(await response.json()).endpoint
      endpoints.value = endpoints.value.map((current) =>
        current.id === endpoint.id ? endpoint : current,
      )
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Webhook update failed.'
    } finally {
      isMutating.value = false
    }
  }

  const test = async (endpointId: string): Promise<void> => {
    isMutating.value = true
    error.value = null
    try {
      const response = await authenticatedApi(
        `/v1/workspaces/${workspaceId()}/webhooks/${endpointId}/test`,
        { method: 'POST' },
      )
      webhookTestResponseSchema.parse(await response.json())
      await load()
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Webhook test failed.'
    } finally {
      isMutating.value = false
    }
  }

  const dismissSecret = (): void => {
    revealedSecret.value = null
  }

  return {
    create,
    deliveries,
    dismissSecret,
    endpoints,
    error,
    isLoading,
    isMutating,
    load,
    revealedSecret,
    setEnabled,
    test,
  }
})
