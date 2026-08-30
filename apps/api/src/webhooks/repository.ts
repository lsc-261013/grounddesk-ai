import type { WebhookDelivery, WebhookEndpoint, WebhookEvent } from '@grounddesk/shared'

export interface CreateWebhookEndpointInput {
  workspaceId: string
  url: string
  encryptedSigningSecret: string
  secretHint: string
  subscribedEvents: WebhookEvent[]
  createdBy: string
}

export interface UpdateWebhookEndpointInput {
  url?: string
  subscribedEvents?: WebhookEvent[]
  enabled?: boolean
}

export interface ClaimedWebhookDelivery {
  id: string
  endpointId: string
  workspaceId: string
  endpointUrl: string
  encryptedSigningSecret: string
  eventName: WebhookEvent
  payload: Record<string, unknown>
  attemptCount: number
}

export interface WebhookRepository {
  listEndpoints(workspaceId: string): Promise<WebhookEndpoint[]>
  getEndpoint(workspaceId: string, endpointId: string): Promise<WebhookEndpoint | null>
  createEndpoint(input: CreateWebhookEndpointInput): Promise<WebhookEndpoint>
  updateEndpoint(
    workspaceId: string,
    endpointId: string,
    input: UpdateWebhookEndpointInput,
  ): Promise<WebhookEndpoint | null>
  listDeliveries(workspaceId: string, limit: number): Promise<WebhookDelivery[]>
  enqueueTest(workspaceId: string, endpointId: string): Promise<string | null>
  claimDue(limit: number, maxAttempts: number): Promise<ClaimedWebhookDelivery[]>
  markDelivered(deliveryId: string, responseStatus: number, responseExcerpt: string): Promise<void>
  markFailed(
    deliveryId: string,
    attemptCount: number,
    maxAttempts: number,
    responseStatus: number | null,
    responseExcerpt: string,
  ): Promise<void>
  getDelivery(workspaceId: string, deliveryId: string): Promise<WebhookDelivery | null>
  close(): Promise<void>
}
