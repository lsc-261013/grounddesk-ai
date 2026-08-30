import type { JSONValue, Sql } from 'postgres'

import {
  webhookDeliverySchema,
  webhookDeliveryStatusSchema,
  webhookEndpointSchema,
  webhookEventSchema,
  type WebhookDelivery,
  type WebhookEndpoint,
} from '@grounddesk/shared'

import {
  closeRepositoryDatabase,
  createRepositoryDatabase,
  type DatabaseSource,
} from '../db/client.js'
import type {
  ClaimedWebhookDelivery,
  CreateWebhookEndpointInput,
  UpdateWebhookEndpointInput,
  WebhookRepository,
} from './repository.js'

interface EndpointRow {
  id: string
  url: string
  subscribedEvents: string[]
  enabled: boolean
  secretHint: string | null
  createdAt: Date
  updatedAt: Date
}

interface DeliveryRow {
  id: string
  endpointId: string
  endpointUrl: string
  eventName: string
  status: string
  attemptCount: number
  responseStatus: number | null
  responseExcerpt: string | null
  nextAttemptAt: Date | null
  deliveredAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface ClaimedRow {
  id: string
  endpointId: string
  workspaceId: string
  endpointUrl: string
  encryptedSigningSecret: string
  eventName: string
  payload: unknown
  attemptCount: number
}

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

const mapEndpoint = (row: EndpointRow): WebhookEndpoint =>
  webhookEndpointSchema.parse({
    ...row,
    subscribedEvents: row.subscribedEvents.map((value) => webhookEventSchema.parse(value)),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  })

const mapDelivery = (row: DeliveryRow): WebhookDelivery =>
  webhookDeliverySchema.parse({
    ...row,
    eventName: webhookEventSchema.parse(row.eventName),
    status: webhookDeliveryStatusSchema.parse(row.status),
    nextAttemptAt: row.nextAttemptAt?.toISOString() ?? null,
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  })

const endpointSelection = `
  endpoint.id,
  endpoint.url,
  endpoint.subscribed_events as "subscribedEvents",
  endpoint.enabled,
  endpoint.secret_hint as "secretHint",
  endpoint.created_at as "createdAt",
  endpoint.updated_at as "updatedAt"
`

const deliverySelection = `
  delivery.id,
  delivery.endpoint_id as "endpointId",
  endpoint.url as "endpointUrl",
  delivery.event_name as "eventName",
  delivery.status::text as status,
  delivery.attempt_count::integer as "attemptCount",
  delivery.response_status as "responseStatus",
  delivery.response_excerpt as "responseExcerpt",
  delivery.next_attempt_at as "nextAttemptAt",
  delivery.delivered_at as "deliveredAt",
  delivery.created_at as "createdAt",
  delivery.updated_at as "updatedAt"
`

export class PostgresWebhookRepository implements WebhookRepository {
  constructor(private readonly database: Sql) {}

  async listEndpoints(workspaceId: string): Promise<WebhookEndpoint[]> {
    const rows = await this.database<EndpointRow[]>`
      select ${this.database.unsafe(endpointSelection)}
      from public.webhook_endpoints endpoint
      where endpoint.workspace_id = ${workspaceId}
      order by endpoint.created_at desc
    `
    return rows.map(mapEndpoint)
  }

  async getEndpoint(workspaceId: string, endpointId: string): Promise<WebhookEndpoint | null> {
    const rows = await this.database<EndpointRow[]>`
      select ${this.database.unsafe(endpointSelection)}
      from public.webhook_endpoints endpoint
      where endpoint.workspace_id = ${workspaceId} and endpoint.id = ${endpointId}
      limit 1
    `
    return rows[0] ? mapEndpoint(rows[0]) : null
  }

  async createEndpoint(input: CreateWebhookEndpointInput): Promise<WebhookEndpoint> {
    const rows = await this.database<EndpointRow[]>`
      insert into public.webhook_endpoints as endpoint (
        workspace_id, url, encrypted_signing_secret, secret_hint, subscribed_events, created_by
      ) values (
        ${input.workspaceId}, ${input.url}, ${input.encryptedSigningSecret}, ${input.secretHint},
        ${input.subscribedEvents}, ${input.createdBy}
      )
      returning ${this.database.unsafe(endpointSelection)}
    `
    const row = rows[0]
    if (!row) throw new Error('Webhook endpoint creation returned no result.')
    return mapEndpoint(row)
  }

  async updateEndpoint(
    workspaceId: string,
    endpointId: string,
    input: UpdateWebhookEndpointInput,
  ): Promise<WebhookEndpoint | null> {
    const rows = await this.database<EndpointRow[]>`
      update public.webhook_endpoints as endpoint
      set url = coalesce(${input.url ?? null}, endpoint.url),
        subscribed_events = coalesce(${input.subscribedEvents ?? null}, endpoint.subscribed_events),
        enabled = coalesce(${input.enabled ?? null}, endpoint.enabled),
        updated_at = now()
      where endpoint.workspace_id = ${workspaceId} and endpoint.id = ${endpointId}
      returning ${this.database.unsafe(endpointSelection)}
    `
    return rows[0] ? mapEndpoint(rows[0]) : null
  }

  async listDeliveries(workspaceId: string, limit: number): Promise<WebhookDelivery[]> {
    const rows = await this.database<DeliveryRow[]>`
      select ${this.database.unsafe(deliverySelection)}
      from public.webhook_deliveries delivery
      join public.webhook_endpoints endpoint on endpoint.id = delivery.endpoint_id
      where delivery.workspace_id = ${workspaceId}
      order by delivery.created_at desc
      limit ${limit}
    `
    return rows.map(mapDelivery)
  }

  async enqueueTest(workspaceId: string, endpointId: string): Promise<string | null> {
    const payload: JSONValue = {
      type: 'webhook.test',
      workspaceId,
      occurredAt: new Date().toISOString(),
    }
    const rows = await this.database<{ id: string }[]>`
      insert into public.webhook_deliveries (
        workspace_id, endpoint_id, event_name, payload, status, next_attempt_at
      )
      select ${workspaceId}, endpoint.id, 'webhook.test', ${this.database.json(payload)}, 'pending', now()
      from public.webhook_endpoints endpoint
      where endpoint.workspace_id = ${workspaceId} and endpoint.id = ${endpointId} and endpoint.enabled
      returning id
    `
    return rows[0]?.id ?? null
  }

  async claimDue(limit: number, maxAttempts: number): Promise<ClaimedWebhookDelivery[]> {
    return this.database.begin(async (transaction) => {
      const rows = await transaction<ClaimedRow[]>`
        select delivery.id, delivery.endpoint_id as "endpointId", delivery.workspace_id as "workspaceId",
          endpoint.url as "endpointUrl", endpoint.encrypted_signing_secret as "encryptedSigningSecret",
          delivery.event_name as "eventName", delivery.payload,
          (delivery.attempt_count + 1)::integer as "attemptCount"
        from public.webhook_deliveries delivery
        join public.webhook_endpoints endpoint on endpoint.id = delivery.endpoint_id
        where delivery.status in ('pending', 'failed')
          and coalesce(delivery.next_attempt_at, delivery.created_at) <= now()
          and delivery.attempt_count < ${maxAttempts}
          and endpoint.enabled
        order by delivery.created_at
        limit ${limit}
        for update of delivery skip locked
      `
      for (const row of rows) {
        await transaction`
          update public.webhook_deliveries
          set status = 'pending', attempt_count = ${row.attemptCount},
            next_attempt_at = now() + interval '1 minute', updated_at = now()
          where id = ${row.id}
        `
      }
      return rows.map((row) => ({
        ...row,
        eventName: webhookEventSchema.parse(row.eventName),
        payload: asRecord(row.payload),
      }))
    })
  }

  async markDelivered(
    deliveryId: string,
    responseStatus: number,
    responseExcerpt: string,
  ): Promise<void> {
    await this.database`
      update public.webhook_deliveries
      set status = 'delivered', response_status = ${responseStatus},
        response_excerpt = ${responseExcerpt}, next_attempt_at = null,
        delivered_at = now(), updated_at = now()
      where id = ${deliveryId}
    `
  }

  async markFailed(
    deliveryId: string,
    attemptCount: number,
    maxAttempts: number,
    responseStatus: number | null,
    responseExcerpt: string,
  ): Promise<void> {
    const backoffSeconds = Math.min(300, 5 * 2 ** Math.max(0, attemptCount - 1))
    await this.database`
      update public.webhook_deliveries
      set status = 'failed', response_status = ${responseStatus},
        response_excerpt = ${responseExcerpt},
        next_attempt_at = case when ${attemptCount} >= ${maxAttempts}
          then null else now() + (${backoffSeconds} * interval '1 second') end,
        updated_at = now()
      where id = ${deliveryId}
    `
  }

  async getDelivery(workspaceId: string, deliveryId: string): Promise<WebhookDelivery | null> {
    const rows = await this.database<DeliveryRow[]>`
      select ${this.database.unsafe(deliverySelection)}
      from public.webhook_deliveries delivery
      join public.webhook_endpoints endpoint on endpoint.id = delivery.endpoint_id
      where delivery.workspace_id = ${workspaceId} and delivery.id = ${deliveryId}
      limit 1
    `
    return rows[0] ? mapDelivery(rows[0]) : null
  }

  async close(): Promise<void> {
    await closeRepositoryDatabase(this.database)
  }
}

export const createPostgresWebhookRepository = (source: DatabaseSource): WebhookRepository =>
  new PostgresWebhookRepository(
    createRepositoryDatabase(source, {
      max: 3,
      applicationName: 'grounddesk-webhooks',
    }),
  )
