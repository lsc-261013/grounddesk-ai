import { randomBytes } from 'node:crypto'

import type { WebhookDelivery, WebhookEndpoint, WebhookEvent } from '@grounddesk/shared'

import { createWebhookSignature, decryptWebhookSecret, encryptWebhookSecret } from './crypto.js'
import { WebhookInputError, WebhookNotFoundError } from './errors.js'
import type { UpdateWebhookEndpointInput, WebhookRepository } from './repository.js'
import { assertSafeWebhookUrl, type HostResolver } from './url-safety.js'

interface WebhookServiceOptions {
  timeoutMs: number
  maxAttempts: number
  production: boolean
  workerIntervalMs?: number
}

export interface WebhookEndpointCreation {
  endpoint: WebhookEndpoint
  signingSecret: string
}

export interface WebhookService {
  start(): void
  listEndpoints(workspaceId: string): Promise<WebhookEndpoint[]>
  createEndpoint(
    workspaceId: string,
    createdBy: string,
    url: string,
    subscribedEvents: WebhookEvent[],
  ): Promise<WebhookEndpointCreation>
  updateEndpoint(
    workspaceId: string,
    endpointId: string,
    input: UpdateWebhookEndpointInput,
  ): Promise<WebhookEndpoint>
  listDeliveries(workspaceId: string): Promise<WebhookDelivery[]>
  testEndpoint(workspaceId: string, endpointId: string): Promise<WebhookDelivery>
  drainOnce(): Promise<number>
  close(): Promise<void>
}

export class DefaultWebhookService implements WebhookService {
  private worker: NodeJS.Timeout | null = null
  private draining: Promise<number> | null = null

  constructor(
    private readonly repository: WebhookRepository,
    private readonly masterSecret: string,
    private readonly options: WebhookServiceOptions,
    private readonly send: typeof fetch = fetch,
    private readonly resolver?: HostResolver,
  ) {}

  start(): void {
    if (this.worker) return
    this.worker = setInterval(() => {
      void this.drainOnce().catch(() => undefined)
    }, this.options.workerIntervalMs ?? 10_000)
    this.worker.unref()
    void this.drainOnce().catch(() => undefined)
  }

  listEndpoints(workspaceId: string): Promise<WebhookEndpoint[]> {
    return this.repository.listEndpoints(workspaceId)
  }

  async createEndpoint(
    workspaceId: string,
    createdBy: string,
    url: string,
    subscribedEvents: WebhookEvent[],
  ): Promise<WebhookEndpointCreation> {
    const safeUrl = await this.safeUrl(url)
    const signingSecret = `gds_whsec_${randomBytes(24).toString('base64url')}`
    const endpoint = await this.repository.createEndpoint({
      workspaceId,
      url: safeUrl.toString(),
      encryptedSigningSecret: encryptWebhookSecret(signingSecret, this.masterSecret),
      secretHint: `••••${signingSecret.slice(-6)}`,
      subscribedEvents: [...new Set(subscribedEvents)],
      createdBy,
    })
    return { endpoint, signingSecret }
  }

  async updateEndpoint(
    workspaceId: string,
    endpointId: string,
    input: UpdateWebhookEndpointInput,
  ): Promise<WebhookEndpoint> {
    const update: UpdateWebhookEndpointInput = {
      ...(input.url ? { url: (await this.safeUrl(input.url)).toString() } : {}),
      ...(input.subscribedEvents ? { subscribedEvents: [...new Set(input.subscribedEvents)] } : {}),
      ...(input.enabled === undefined ? {} : { enabled: input.enabled }),
    }
    const endpoint = await this.repository.updateEndpoint(workspaceId, endpointId, update)
    if (!endpoint) throw new WebhookNotFoundError()
    return endpoint
  }

  listDeliveries(workspaceId: string): Promise<WebhookDelivery[]> {
    return this.repository.listDeliveries(workspaceId, 100)
  }

  async testEndpoint(workspaceId: string, endpointId: string): Promise<WebhookDelivery> {
    if (!(await this.repository.getEndpoint(workspaceId, endpointId))) {
      throw new WebhookNotFoundError()
    }
    const deliveryId = await this.repository.enqueueTest(workspaceId, endpointId)
    if (!deliveryId) throw new WebhookInputError('Enable the endpoint before sending a test.')
    await this.drainOnce()
    const delivery = await this.repository.getDelivery(workspaceId, deliveryId)
    if (!delivery) throw new WebhookNotFoundError()
    return delivery
  }

  drainOnce(): Promise<number> {
    if (this.draining) return this.draining
    this.draining = this.performDrain().finally(() => {
      this.draining = null
    })
    return this.draining
  }

  async close(): Promise<void> {
    if (this.worker) clearInterval(this.worker)
    this.worker = null
    if (this.draining) await this.draining.catch(() => undefined)
    await this.repository.close()
  }

  private async performDrain(): Promise<number> {
    const deliveries = await this.repository.claimDue(10, this.options.maxAttempts)
    await Promise.all(deliveries.map(async (delivery) => this.deliver(delivery)))
    return deliveries.length
  }

  private async deliver(
    delivery: Awaited<ReturnType<WebhookRepository['claimDue']>>[number],
  ): Promise<void> {
    let responseStatus: number | null = null
    try {
      await this.safeUrl(delivery.endpointUrl)
      const body = JSON.stringify({
        id: delivery.id,
        type: delivery.eventName,
        createdAt: new Date().toISOString(),
        workspaceId: delivery.workspaceId,
        data: delivery.payload,
      })
      const timestamp = Math.floor(Date.now() / 1_000).toString()
      const signingSecret = decryptWebhookSecret(delivery.encryptedSigningSecret, this.masterSecret)
      const response = await this.send(delivery.endpointUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'GroundDesk-Webhooks/1.0',
          'x-grounddesk-delivery': delivery.id,
          'x-grounddesk-event': delivery.eventName,
          'x-grounddesk-timestamp': timestamp,
          'x-grounddesk-signature': createWebhookSignature(signingSecret, timestamp, body),
        },
        body,
        redirect: 'error',
        signal: AbortSignal.timeout(this.options.timeoutMs),
      })
      responseStatus = response.status
      const excerpt = (await response.text()).replace(/[\r\n\t]+/g, ' ').slice(0, 400)
      if (!response.ok) throw new Error(excerpt || `HTTP ${response.status}`)
      await this.repository.markDelivered(delivery.id, response.status, excerpt)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Webhook request failed.'
      await this.repository.markFailed(
        delivery.id,
        delivery.attemptCount,
        this.options.maxAttempts,
        responseStatus,
        message.slice(0, 400),
      )
    }
  }

  private async safeUrl(url: string): Promise<URL> {
    try {
      return await assertSafeWebhookUrl(url, this.options.production, this.resolver)
    } catch (cause) {
      throw new WebhookInputError(
        cause instanceof Error ? cause.message : 'The webhook URL is not allowed.',
      )
    }
  }
}
