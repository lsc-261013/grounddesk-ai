import postgres, { type Sql } from 'postgres'

import { consoleOrderSchema, type ConsoleOrder, type OrderStatus } from '@grounddesk/shared'

import type { OrderListInput, OrderListResult, OrderRepository } from './repository.js'

interface OrderRow {
  id: string
  orderNumber: string
  customerName: string
  customerEmail: string
  status: string
  orderedAt: Date
  shippedAt: Date | null
  deliveredAt: Date | null
  cancelledAt: Date | null
  carrier: string | null
  trackingNumberMasked: string | null
  shippingCountryCode: string
  totalCents: number
  currency: string
  isDemo: boolean
  updatedAt: Date
}

interface OrderItemRow {
  id: string
  orderId: string
  productId: string
  sku: string
  model: string
  nameZh: string
  nameEn: string
  quantity: number
  unitPriceCents: number
  opened: boolean
}

const mapOrder = (row: OrderRow, items: OrderItemRow[]): ConsoleOrder =>
  consoleOrderSchema.parse({
    ...row,
    orderedAt: row.orderedAt.toISOString(),
    shippedAt: row.shippedAt?.toISOString() ?? null,
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
    items: items.map((item) => ({
      id: item.id,
      productId: item.productId,
      sku: item.sku,
      model: item.model,
      nameZh: item.nameZh,
      nameEn: item.nameEn,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      opened: item.opened,
    })),
  })

export class PostgresOrderRepository implements OrderRepository {
  constructor(private readonly database: Sql) {}

  private async items(orderIds: string[]): Promise<Map<string, OrderItemRow[]>> {
    if (orderIds.length === 0) return new Map()
    const rows = await this.database<OrderItemRow[]>`
      select item.id, item.order_id as "orderId", product.id as "productId", product.sku,
        product.model, product.name_zh as "nameZh", product.name_en as "nameEn",
        item.quantity::integer, item.unit_price_cents::integer as "unitPriceCents", item.opened
      from public.order_items item
      join public.products product on product.id = item.product_id
      where item.order_id in ${this.database(orderIds)}
      order by item.created_at, item.id
    `
    const grouped = new Map<string, OrderItemRow[]>()
    for (const row of rows) grouped.set(row.orderId, [...(grouped.get(row.orderId) ?? []), row])
    return grouped
  }

  private async rows(
    workspaceId: string,
    input: OrderListInput,
    orderId?: string,
  ): Promise<OrderRow[]> {
    const idFilter = orderId ? this.database`and order_record.id = ${orderId}` : this.database``
    const statusFilter = input.status
      ? this.database`and order_record.status = ${input.status}`
      : this.database``
    const queryFilter = input.query
      ? this.database`and (
          order_record.order_number ilike ${`%${input.query}%`}
          or order_record.customer_name ilike ${`%${input.query}%`}
          or order_record.customer_email ilike ${`%${input.query}%`}
        )`
      : this.database``
    return this.database<OrderRow[]>`
      select order_record.id, order_record.order_number as "orderNumber",
        order_record.customer_name as "customerName", order_record.customer_email as "customerEmail",
        order_record.status::text, order_record.ordered_at as "orderedAt",
        order_record.shipped_at as "shippedAt", order_record.delivered_at as "deliveredAt",
        order_record.cancelled_at as "cancelledAt", order_record.carrier,
        order_record.tracking_number_masked as "trackingNumberMasked",
        order_record.shipping_country_code as "shippingCountryCode",
        order_record.total_cents::integer as "totalCents", order_record.currency,
        order_record.is_demo as "isDemo", order_record.updated_at as "updatedAt"
      from public.orders order_record
      where order_record.workspace_id = ${workspaceId}
        ${idFilter}
        ${statusFilter}
        ${queryFilter}
      order by order_record.ordered_at desc, order_record.id
      limit ${input.limit} offset ${input.offset}
    `
  }

  async list(workspaceId: string, input: OrderListInput): Promise<OrderListResult> {
    const queryPattern = input.query ? `%${input.query}%` : null
    const [rows, countRows] = await Promise.all([
      this.rows(workspaceId, input),
      this.database<{ total: number }[]>`
        select count(*)::integer as total
        from public.orders order_record
        where order_record.workspace_id = ${workspaceId}
          and (${input.status}::text is null or order_record.status::text = ${input.status})
          and (${queryPattern}::text is null or order_record.order_number ilike ${queryPattern}
            or order_record.customer_name ilike ${queryPattern}
            or order_record.customer_email ilike ${queryPattern})
      `,
    ])
    const items = await this.items(rows.map((row) => row.id))
    return {
      orders: rows.map((row) => mapOrder(row, items.get(row.id) ?? [])),
      total: countRows[0]?.total ?? 0,
    }
  }

  async get(workspaceId: string, orderId: string): Promise<ConsoleOrder | null> {
    const row = (
      await this.rows(workspaceId, { query: null, status: null, limit: 1, offset: 0 }, orderId)
    )[0]
    if (!row) return null
    return mapOrder(row, (await this.items([row.id])).get(row.id) ?? [])
  }

  async updateStatus(
    workspaceId: string,
    orderId: string,
    status: OrderStatus,
  ): Promise<ConsoleOrder | null> {
    await this.database`
      update public.orders
      set status = ${status},
        shipped_at = case when ${status} = 'shipped' and shipped_at is null then now() else shipped_at end,
        delivered_at = case when ${status} = 'delivered' and delivered_at is null then now() else delivered_at end,
        cancelled_at = case when ${status} = 'cancelled' and cancelled_at is null then now() else cancelled_at end,
        updated_at = now()
      where workspace_id = ${workspaceId} and id = ${orderId}
    `
    return this.get(workspaceId, orderId)
  }

  async close(): Promise<void> {
    await this.database.end({ timeout: 5 })
  }
}

export const createPostgresOrderRepository = (databaseUrl: string): OrderRepository =>
  new PostgresOrderRepository(
    postgres(databaseUrl, {
      max: 4,
      ssl: 'require',
      connection: { application_name: 'grounddesk-orders' },
    }),
  )
