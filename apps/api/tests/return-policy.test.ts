import { describe, expect, it } from 'vitest'

import { evaluateReturnEligibility } from '../src/tools/return-policy.js'
import type { ReturnPolicyRecord, VerifiedOrder, VerifiedOrderItem } from '../src/tools/types.js'

const item: VerifiedOrderItem = {
  id: '60000000-0000-4000-8000-000000000001',
  productId: '30000000-0000-4000-8000-000000000001',
  sku: 'AVL-AW-S1-BLK',
  model: 'Airwave S1',
  category: 'wireless_earbuds',
  nameZh: 'Airwave S1 真无线耳机',
  nameEn: 'Airwave S1 True Wireless Earbuds',
  quantity: 1,
  opened: false,
  isReturnable: true,
  openedReturnPolicy: 'sealed_audio',
}

const order: VerifiedOrder = {
  id: '50000000-0000-4000-8000-000000000001',
  workspaceId: '11111111-1111-4111-8111-111111111111',
  orderNumber: 'GD-2026D001',
  customerName: 'Demo Customer',
  customerEmail: 'demo@example.com',
  status: 'delivered',
  orderedAt: new Date('2026-08-01T09:00:00.000Z'),
  shippedAt: new Date('2026-08-02T09:00:00.000Z'),
  deliveredAt: new Date('2026-08-05T09:00:00.000Z'),
  carrier: 'ParcelNorth',
  trackingNumberMasked: 'PN••••0001',
  totalCents: 8_900,
  currency: 'USD',
  items: [item],
}

const policy: ReturnPolicyRecord = {
  id: '40000000-0000-4000-8000-000000000001',
  workspaceId: order.workspaceId,
  version: 1,
  name: 'Avenlo Demo Return Policy v1',
  rules: {
    standardWindowDays: 30,
    sealedAudioWindowDays: 14,
    shippingDamageReportDays: 7,
    openedAudioRequiresManualReview: true,
    batteryProductsRequireGroundReturnLabel: true,
    finalSaleCategories: [],
  },
  policyTextZh: '模拟政策',
  policyTextEn: 'Simulated policy',
}

const evaluate = (overrides: Partial<Parameters<typeof evaluateReturnEligibility>[0]> = {}) =>
  evaluateReturnEligibility({
    order,
    item,
    policy,
    reason: 'changed_mind',
    declaredOpened: false,
    locale: 'en-US',
    now: new Date('2026-08-10T09:00:00.000Z'),
    ...overrides,
  })

describe('deterministic return eligibility policy', () => {
  it('marks an unopened item inside its window eligible without issuing a refund', () => {
    const result = evaluate()

    expect(result.status).toBe('eligible')
    expect(result.requiresApproval).toBe(true)
    expect(result.reasonCodes).toContain('within_return_window')
  })

  it('marks an expired sealed-audio return ineligible', () => {
    const result = evaluate({ now: new Date('2026-08-25T09:00:00.000Z') })

    expect(result.status).toBe('ineligible')
    expect(result.reasonCodes).toEqual(['return_window_expired'])
  })

  it('sends an opened audio product to manual review', () => {
    const result = evaluate({ declaredOpened: true })

    expect(result.status).toBe('manual_review')
    expect(result.reasonCodes).toEqual(['opened_audio_requires_review'])
  })

  it('uses the shorter shipping-damage reporting deadline', () => {
    const withinDeadline = evaluate({ reason: 'shipping_damage' })
    const outsideDeadline = evaluate({
      reason: 'shipping_damage',
      now: new Date('2026-08-14T09:00:00.000Z'),
    })

    expect(withinDeadline.status).toBe('manual_review')
    expect(outsideDeadline.status).toBe('ineligible')
  })

  it('adds the ground-return requirement for an eligible power bank', () => {
    const powerBank = {
      ...item,
      category: 'power_bank',
      openedReturnPolicy: 'battery_product',
    }
    const result = evaluate({ item: powerBank })

    expect(result.status).toBe('eligible')
    expect(result.reasonCodes).toContain('ground_return_label_required')
  })
})
