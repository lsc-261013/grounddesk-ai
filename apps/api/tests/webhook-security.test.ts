import { createHmac } from 'node:crypto'
import { createServer } from 'node:http'

import type { WebhookDelivery, WebhookEndpoint, WebhookEvent } from '@grounddesk/shared'
import { describe, expect, it, vi } from 'vitest'

import {
  createWebhookSignature,
  decryptWebhookSecret,
  encryptWebhookSecret,
} from '../src/webhooks/crypto.js'
import type {
  ClaimedWebhookDelivery,
  CreateWebhookEndpointInput,
  UpdateWebhookEndpointInput,
  WebhookRepository,
} from '../src/webhooks/repository.js'
import { DefaultWebhookService } from '../src/webhooks/service.js'
import { assertSafeWebhookUrl } from '../src/webhooks/url-safety.js'

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111'
const ENDPOINT_ID = '22222222-2222-4222-8222-222222222222'
const DELIVERY_ID = '33333333-3333-4333-8333-333333333333'

class MemoryWebhookRepository implements WebhookRepository {
  endpoint: WebhookEndpoint | null = null
  encryptedSecret = ''
  due: ClaimedWebhookDelivery[] = []
  delivery: WebhookDelivery | null = null

  listEndpoints(): Promise<WebhookEndpoint[]> {
    return Promise.resolve(this.endpoint ? [this.endpoint] : [])
  }
  getEndpoint(): Promise<WebhookEndpoint | null> {
    return Promise.resolve(this.endpoint)
  }
  createEndpoint(input: CreateWebhookEndpointInput): Promise<WebhookEndpoint> {
    this.encryptedSecret = input.encryptedSigningSecret
    this.endpoint = {
      id: ENDPOINT_ID,
      url: input.url,
      subscribedEvents: input.subscribedEvents,
      enabled: true,
      secretHint: input.secretHint,
      createdAt: '2026-08-30T00:00:00.000Z',
      updatedAt: '2026-08-30T00:00:00.000Z',
    }
    return Promise.resolve(this.endpoint)
  }
  updateEndpoint(
    _workspaceId: string,
    _endpointId: string,
    input: UpdateWebhookEndpointInput,
  ): Promise<WebhookEndpoint | null> {
    if (!this.endpoint) return Promise.resolve(null)
    this.endpoint = { ...this.endpoint, ...input, updatedAt: '2026-08-30T00:01:00.000Z' }
    return Promise.resolve(this.endpoint)
  }
  listDeliveries(): Promise<WebhookDelivery[]> {
    return Promise.resolve(this.delivery ? [this.delivery] : [])
  }
  enqueueTest(): Promise<string | null> {
    if (!this.endpoint?.enabled) return Promise.resolve(null)
    this.due.push({
      id: DELIVERY_ID,
      endpointId: ENDPOINT_ID,
      workspaceId: WORKSPACE_ID,
      endpointUrl: this.endpoint.url,
      encryptedSigningSecret: this.encryptedSecret,
      eventName: 'webhook.test',
      payload: { type: 'webhook.test' },
      attemptCount: 1,
    })
    this.delivery = this.deliveryValue('pending', 1, null, null)
    return Promise.resolve(DELIVERY_ID)
  }
  claimDue(): Promise<ClaimedWebhookDelivery[]> {
    return Promise.resolve(this.due.splice(0))
  }
  markDelivered(_id: string, status: number, excerpt: string): Promise<void> {
    this.delivery = this.deliveryValue('delivered', 1, status, excerpt)
    return Promise.resolve()
  }
  markFailed(
    _id: string,
    attempts: number,
    _max: number,
    status: number | null,
    excerpt: string,
  ): Promise<void> {
    this.delivery = this.deliveryValue('failed', attempts, status, excerpt)
    return Promise.resolve()
  }
  getDelivery(): Promise<WebhookDelivery | null> {
    return Promise.resolve(this.delivery)
  }
  close(): Promise<void> {
    return Promise.resolve()
  }

  private deliveryValue(
    status: 'pending' | 'delivered' | 'failed',
    attemptCount: number,
    responseStatus: number | null,
    responseExcerpt: string | null,
  ): WebhookDelivery {
    return {
      id: DELIVERY_ID,
      endpointId: ENDPOINT_ID,
      endpointUrl: this.endpoint?.url ?? 'https://hooks.example.com/grounddesk',
      eventName: 'webhook.test',
      status,
      attemptCount,
      responseStatus,
      responseExcerpt,
      nextAttemptAt: null,
      deliveredAt: status === 'delivered' ? '2026-08-30T00:00:01.000Z' : null,
      createdAt: '2026-08-30T00:00:00.000Z',
      updatedAt: '2026-08-30T00:00:01.000Z',
    }
  }
}

describe('webhook security', () => {
  it('encrypts stored signing secrets and produces deterministic HMAC signatures', () => {
    const encrypted = encryptWebhookSecret('whsec-test', 'master-a')
    expect(encrypted).not.toContain('whsec-test')
    expect(decryptWebhookSecret(encrypted, 'master-a')).toBe('whsec-test')
    expect(() => decryptWebhookSecret(encrypted, 'master-b')).toThrow()
    expect(createWebhookSignature('secret', '123', '{}')).toBe(
      `sha256=${createHmac('sha256', 'secret').update('123.{}').digest('hex')}`,
    )
  })

  it('blocks credentials, local hosts, private DNS results, and non-HTTPS production URLs', async () => {
    const publicResolver = () => Promise.resolve(['93.184.216.34'])
    await expect(
      assertSafeWebhookUrl('https://hooks.example.com/events', true, publicResolver),
    ).resolves.toBeInstanceOf(URL)
    await expect(
      assertSafeWebhookUrl('http://hooks.example.com/events', true, publicResolver),
    ).rejects.toThrow('HTTPS')
    await expect(
      assertSafeWebhookUrl('https://user:pass@hooks.example.com/events', true, publicResolver),
    ).rejects.toThrow('credentials')
    await expect(
      assertSafeWebhookUrl('https://hooks.example.com/events', true, () =>
        Promise.resolve(['10.0.0.8']),
      ),
    ).rejects.toThrow('private')
    await expect(assertSafeWebhookUrl('http://localhost:8787/hook', false)).rejects.toThrow('local')
  })

  it('sends a signed test event and records the real response status', async () => {
    const repository = new MemoryWebhookRepository()
    let capturedSecret = ''
    const sender = vi.fn((_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      if (typeof init?.body !== 'string') throw new Error('Expected a JSON string body.')
      const body = init.body
      const timestamp = headers.get('x-grounddesk-timestamp') ?? ''
      expect(headers.get('x-grounddesk-event')).toBe('webhook.test')
      expect(headers.get('x-grounddesk-signature')).toBe(
        createWebhookSignature(capturedSecret, timestamp, body),
      )
      return Promise.resolve(new Response('accepted', { status: 202 }))
    }) as typeof fetch
    const service = new DefaultWebhookService(
      repository,
      'server-master-secret',
      { timeoutMs: 2_000, maxAttempts: 3, production: true },
      sender,
      () => Promise.resolve(['93.184.216.34']),
    )
    const created = await service.createEndpoint(
      WORKSPACE_ID,
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'https://hooks.example.com/grounddesk',
      ['ticket.created'] satisfies WebhookEvent[],
    )
    capturedSecret = created.signingSecret
    const delivery = await service.testEndpoint(WORKSPACE_ID, ENDPOINT_ID)

    expect(sender).toHaveBeenCalledOnce()
    expect(delivery).toMatchObject({ status: 'delivered', responseStatus: 202 })
  })

  it('preserves signatures across a real HTTP failure and retry', async () => {
    const received: Array<{
      body: string
      signature: string
      timestamp: string
    }> = []
    const receiver = createServer((request, response) => {
      const chunks: Buffer[] = []
      request.on('data', (chunk: Buffer) => chunks.push(chunk))
      request.on('end', () => {
        received.push({
          body: Buffer.concat(chunks).toString('utf8'),
          signature: String(request.headers['x-grounddesk-signature'] ?? ''),
          timestamp: String(request.headers['x-grounddesk-timestamp'] ?? ''),
        })
        response.statusCode = received.length === 1 ? 503 : 202
        response.end(received.length === 1 ? 'retry later' : 'accepted')
      })
    })
    await new Promise<void>((resolve, reject) => {
      receiver.once('error', reject)
      receiver.listen(0, '127.0.0.1', resolve)
    })
    const address = receiver.address()
    if (!address || typeof address === 'string') throw new Error('Expected a TCP receiver address.')

    const repository = new MemoryWebhookRepository()
    const sender: typeof fetch = (_input, init) =>
      fetch(`http://127.0.0.1:${address.port}/events`, init)
    const service = new DefaultWebhookService(
      repository,
      'server-master-secret',
      { timeoutMs: 2_000, maxAttempts: 3, production: true },
      sender,
      () => Promise.resolve(['93.184.216.34']),
    )

    try {
      const created = await service.createEndpoint(
        WORKSPACE_ID,
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'https://hooks.example.com/grounddesk',
        ['webhook.test'],
      )
      const firstAttempt = await service.testEndpoint(WORKSPACE_ID, ENDPOINT_ID)
      expect(firstAttempt).toMatchObject({ status: 'failed', responseStatus: 503 })

      repository.due.push({
        id: DELIVERY_ID,
        endpointId: ENDPOINT_ID,
        workspaceId: WORKSPACE_ID,
        endpointUrl: 'https://hooks.example.com/grounddesk',
        encryptedSigningSecret: repository.encryptedSecret,
        eventName: 'webhook.test',
        payload: { type: 'webhook.test' },
        attemptCount: 2,
      })
      await service.drainOnce()

      expect(repository.delivery).toMatchObject({ status: 'delivered', responseStatus: 202 })
      expect(received).toHaveLength(2)
      for (const request of received) {
        expect(request.signature).toBe(
          createWebhookSignature(created.signingSecret, request.timestamp, request.body),
        )
      }
    } finally {
      await service.close()
      await new Promise<void>((resolve, reject) => {
        receiver.close((error) => (error ? reject(error) : resolve()))
      })
    }
  })
})
