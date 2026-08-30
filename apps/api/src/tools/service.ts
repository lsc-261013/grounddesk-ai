import {
  orderLookupToolInputSchema,
  orderLookupToolResultSchema,
  publicOrderSchema,
  returnEligibilityResultSchema,
  returnEligibilityToolInputSchema,
  type Locale,
  type OrderLookupToolResult,
  type PublicOrder,
  type ReturnEligibilityToolInput,
} from '@grounddesk/shared'

import { evaluateReturnEligibility } from './return-policy.js'
import type {
  OrderToolRepository,
  ReturnToolOutcome,
  ToolExecutionService,
  VerifiedOrder,
} from './types.js'

const maskName = (value: string): string => {
  const trimmed = value.trim()
  if (trimmed.length <= 1) return '*'
  const words = trimmed.split(/\s+/)
  return words.map((word) => `${word[0]}${'*'.repeat(Math.min(3, word.length - 1))}`).join(' ')
}

const maskEmail = (value: string): string => {
  const [local = '', domain = ''] = value.toLowerCase().split('@')
  const visible = local.slice(0, 1)
  return `${visible}${'*'.repeat(Math.max(3, Math.min(8, local.length - 1)))}@${domain}`
}

const toPublicOrder = (order: VerifiedOrder, locale: Locale): PublicOrder =>
  publicOrderSchema.parse({
    orderNumber: order.orderNumber,
    customerNameMasked: maskName(order.customerName),
    customerEmailMasked: maskEmail(order.customerEmail),
    status: order.status,
    orderedAt: order.orderedAt.toISOString(),
    shippedAt: order.shippedAt?.toISOString() ?? null,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
    carrier: order.carrier,
    trackingNumberMasked: order.trackingNumberMasked,
    totalCents: order.totalCents,
    currency: order.currency,
    items: order.items.map((item) => ({
      productId: item.productId,
      sku: item.sku,
      model: item.model,
      name: locale === 'zh-CN' ? item.nameZh : item.nameEn,
      quantity: item.quantity,
      opened: item.opened,
    })),
  })

const retryDatabaseRead = async <T>(operation: () => Promise<T>): Promise<T> => {
  let lastError: unknown
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

export class DefaultToolExecutionService implements ToolExecutionService {
  constructor(private readonly repository: OrderToolRepository) {}

  async lookupOrder(
    workspaceId: string,
    rawInput: { orderNumber: string; email: string },
    locale: Locale,
  ): Promise<OrderLookupToolResult> {
    const input = orderLookupToolInputSchema.parse(rawInput)
    try {
      const order = await retryDatabaseRead(() =>
        this.repository.getOrderByNumber(workspaceId, input.orderNumber),
      )
      if (!order) return orderLookupToolResultSchema.parse({ status: 'not_found', order: null })
      if (order.customerEmail.toLowerCase() !== input.email) {
        return orderLookupToolResultSchema.parse({ status: 'email_mismatch', order: null })
      }
      return orderLookupToolResultSchema.parse({
        status: 'succeeded',
        order: toPublicOrder(order, locale),
      })
    } catch {
      return orderLookupToolResultSchema.parse({ status: 'failed', order: null })
    }
  }

  async evaluateReturn(
    workspaceId: string,
    rawInput: ReturnEligibilityToolInput,
    locale: Locale,
  ): Promise<ReturnToolOutcome> {
    const input = returnEligibilityToolInputSchema.parse(rawInput)
    try {
      const order = await retryDatabaseRead(() =>
        this.repository.getOrderByNumber(workspaceId, input.orderNumber),
      )
      if (!order) return { status: 'not_found', result: null, order: null }
      if (order.customerEmail.toLowerCase() !== input.email) {
        return { status: 'email_mismatch', result: null, order: null }
      }

      const item = input.productSku
        ? order.items.find(
            (candidate) =>
              candidate.sku.toLowerCase() === input.productSku?.toLowerCase() ||
              candidate.model.toLowerCase() === input.productSku?.toLowerCase(),
          )
        : order.items.length === 1
          ? order.items[0]
          : undefined
      if (!item) return { status: 'not_found', result: null, order: null }

      const policy = await retryDatabaseRead(() =>
        this.repository.getReturnPolicy(workspaceId, order.orderedAt),
      )
      if (!policy) return { status: 'failed', result: null, order: null }

      const result = returnEligibilityResultSchema.parse(
        evaluateReturnEligibility({
          order,
          item,
          policy,
          reason: input.reason,
          declaredOpened: input.opened,
          locale,
          now: new Date(),
        }),
      )
      return { status: 'succeeded', result, order: toPublicOrder(order, locale) }
    } catch {
      return { status: 'failed', result: null, order: null }
    }
  }

  close(): Promise<void> {
    return this.repository.close()
  }
}
