import postgres, { type Sql } from 'postgres'
import { z } from 'zod'

import { orderStatusSchema } from '@grounddesk/shared'

import type {
  OrderToolRepository,
  ReturnPolicyRecord,
  ReturnPolicyRules,
  VerifiedOrder,
} from './types.js'

interface OrderRow {
  id: string
  workspaceId: string
  orderNumber: string
  customerName: string
  customerEmail: string
  status: string
  orderedAt: Date
  shippedAt: Date | null
  deliveredAt: Date | null
  carrier: string | null
  trackingNumberMasked: string | null
  totalCents: number
  currency: string
  items: unknown
}

interface PolicyRow {
  id: string
  workspaceId: string
  version: number
  name: string
  rules: unknown
  policyTextZh: string
  policyTextEn: string
}

const itemSchema = z.object({
  id: z.uuid(),
  productId: z.uuid(),
  sku: z.string(),
  model: z.string(),
  category: z.string(),
  nameZh: z.string(),
  nameEn: z.string(),
  quantity: z.number().int().positive(),
  opened: z.boolean(),
  isReturnable: z.boolean(),
  openedReturnPolicy: z.string(),
})

const policyRulesSchema = z.object({
  standard_window_days: z.number().int().positive(),
  sealed_audio_window_days: z.number().int().positive(),
  shipping_damage_report_days: z.number().int().positive(),
  opened_audio_requires_manual_review: z.boolean(),
  battery_products_require_ground_return_label: z.boolean(),
  final_sale_categories: z.array(z.string()),
})

const mapRules = (value: unknown): ReturnPolicyRules => {
  const rules = policyRulesSchema.parse(value)
  return {
    standardWindowDays: rules.standard_window_days,
    sealedAudioWindowDays: rules.sealed_audio_window_days,
    shippingDamageReportDays: rules.shipping_damage_report_days,
    openedAudioRequiresManualReview: rules.opened_audio_requires_manual_review,
    batteryProductsRequireGroundReturnLabel: rules.battery_products_require_ground_return_label,
    finalSaleCategories: rules.final_sale_categories,
  }
}

class PostgresToolRepository implements OrderToolRepository {
  constructor(private readonly database: Sql) {}

  async getOrderByNumber(workspaceId: string, orderNumber: string): Promise<VerifiedOrder | null> {
    const rows = await this.database<OrderRow[]>`
      select
        orders.id,
        orders.workspace_id as "workspaceId",
        orders.order_number as "orderNumber",
        orders.customer_name as "customerName",
        orders.customer_email as "customerEmail",
        orders.status::text as status,
        orders.ordered_at as "orderedAt",
        orders.shipped_at as "shippedAt",
        orders.delivered_at as "deliveredAt",
        orders.carrier,
        orders.tracking_number_masked as "trackingNumberMasked",
        orders.total_cents::integer as "totalCents",
        orders.currency,
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', item.id,
              'productId', product.id,
              'sku', product.sku,
              'model', product.model,
              'category', product.category,
              'nameZh', product.name_zh,
              'nameEn', product.name_en,
              'quantity', item.quantity,
              'opened', item.opened,
              'isReturnable', product.is_returnable,
              'openedReturnPolicy', product.opened_return_policy
            ) order by item.created_at
          ) filter (where item.id is not null),
          '[]'::jsonb
        ) as items
      from public.orders orders
      left join public.order_items item on item.order_id = orders.id
      left join public.products product
        on product.id = item.product_id and product.workspace_id = orders.workspace_id
      where orders.workspace_id = ${workspaceId}
        and orders.order_number = ${orderNumber}
      group by orders.id
      limit 1
    `
    const row = rows[0]
    if (!row) return null
    return {
      ...row,
      status: orderStatusSchema.parse(row.status),
      items: z.array(itemSchema).parse(row.items),
    }
  }

  async getReturnPolicy(
    workspaceId: string,
    effectiveAt: Date,
  ): Promise<ReturnPolicyRecord | null> {
    const rows = await this.database<PolicyRow[]>`
      select
        id,
        workspace_id as "workspaceId",
        version::integer,
        name,
        rules,
        policy_text_zh as "policyTextZh",
        policy_text_en as "policyTextEn"
      from public.return_policies
      where workspace_id = ${workspaceId}
        and effective_from <= ${effectiveAt}
        and (effective_to is null or effective_to >= ${effectiveAt})
      order by version desc
      limit 1
    `
    const row = rows[0]
    return row ? { ...row, rules: mapRules(row.rules) } : null
  }

  async close(): Promise<void> {
    await this.database.end({ timeout: 5 })
  }
}

export const createPostgresToolRepository = (databaseUrl: string): OrderToolRepository =>
  new PostgresToolRepository(
    postgres(databaseUrl, {
      max: 5,
      ssl: 'require',
      connection: { application_name: 'grounddesk-tools' },
    }),
  )
