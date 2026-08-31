import { describe, expect, it } from 'vitest'

import { DefaultToolExecutionService } from '../src/tools/service.js'
import type { OrderToolRepository, ReturnPolicyRecord, VerifiedOrder } from '../src/tools/types.js'

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111'

const createOrder = (): VerifiedOrder => {
  const deliveredAt = new Date()
  deliveredAt.setUTCDate(deliveredAt.getUTCDate() - 2)
  const orderedAt = new Date(deliveredAt)
  orderedAt.setUTCDate(orderedAt.getUTCDate() - 5)

  return {
    id: '50000000-0000-4000-8000-000000000019',
    workspaceId: WORKSPACE_ID,
    orderNumber: 'GD-2026D019',
    customerName: 'Demo Customer',
    customerEmail: 'demo.customer19@example.com',
    status: 'delivered',
    orderedAt,
    shippedAt: new Date(orderedAt.getTime() + 24 * 60 * 60 * 1_000),
    deliveredAt,
    carrier: 'ParcelNorth',
    trackingNumberMasked: 'PN••••0019',
    totalCents: 4_900,
    currency: 'USD',
    items: [
      {
        id: '60000000-0000-4000-8000-000000000019',
        productId: '30000000-0000-4000-8000-000000000004',
        sku: 'AVL-LC-C240',
        model: 'LinkCore C240',
        category: 'usb_c_cable',
        nameZh: 'LinkCore C240 USB-C 线材',
        nameEn: 'LinkCore C240 USB-C Cable',
        quantity: 1,
        opened: false,
        isReturnable: true,
        openedReturnPolicy: 'standard',
      },
    ],
  }
}

const RETURN_POLICY: ReturnPolicyRecord = {
  id: '40000000-0000-4000-8000-000000000001',
  workspaceId: WORKSPACE_ID,
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
  policyTextZh: '标准商品签收后 30 天内可申请退货。',
  policyTextEn: 'Standard products may be returned within 30 days of delivery.',
}

class MemoryToolRepository implements OrderToolRepository {
  order: VerifiedOrder | null = createOrder()
  policy: ReturnPolicyRecord | null = RETURN_POLICY
  lookupAttempts = 0
  failuresBeforeSuccess = 0

  getOrderByNumber(workspaceId: string, orderNumber: string): Promise<VerifiedOrder | null> {
    this.lookupAttempts += 1
    if (this.lookupAttempts <= this.failuresBeforeSuccess) {
      return Promise.reject(new Error('Temporary database failure.'))
    }
    if (workspaceId !== WORKSPACE_ID || orderNumber !== this.order?.orderNumber) {
      return Promise.resolve(null)
    }
    return Promise.resolve(this.order)
  }

  getReturnPolicy(workspaceId: string): Promise<ReturnPolicyRecord | null> {
    return Promise.resolve(workspaceId === WORKSPACE_ID ? this.policy : null)
  }

  close(): Promise<void> {
    return Promise.resolve()
  }
}

describe('allowlisted order and return tools', () => {
  it('validates credentials and returns only a masked order projection', async () => {
    const repository = new MemoryToolRepository()
    const service = new DefaultToolExecutionService(repository)

    const result = await service.lookupOrder(
      WORKSPACE_ID,
      { orderNumber: 'GD-2026D019', email: 'DEMO.CUSTOMER19@EXAMPLE.COM' },
      'en-US',
    )

    expect(result.status).toBe('succeeded')
    expect(result.order?.customerNameMasked).toBe('D*** C***')
    expect(result.order?.customerEmailMasked).toBe('d********@example.com')
    expect(JSON.stringify(result.order)).not.toContain('demo.customer19@example.com')
  })

  it('distinguishes missing orders from mismatched emails', async () => {
    const repository = new MemoryToolRepository()
    const service = new DefaultToolExecutionService(repository)

    const missing = await service.lookupOrder(
      WORKSPACE_ID,
      { orderNumber: 'GD-2026D020', email: 'demo.customer19@example.com' },
      'zh-CN',
    )
    const mismatch = await service.lookupOrder(
      WORKSPACE_ID,
      { orderNumber: 'GD-2026D019', email: 'other@example.com' },
      'zh-CN',
    )

    expect(missing).toEqual({ status: 'not_found', order: null })
    expect(mismatch).toEqual({ status: 'email_mismatch', order: null })
  })

  it('retries a database read once and returns a safe failure after both attempts fail', async () => {
    const repository = new MemoryToolRepository()
    repository.failuresBeforeSuccess = 2
    const service = new DefaultToolExecutionService(repository)

    const result = await service.lookupOrder(
      WORKSPACE_ID,
      { orderNumber: 'GD-2026D019', email: 'demo.customer19@example.com' },
      'en-US',
    )

    expect(repository.lookupAttempts).toBe(2)
    expect(result).toEqual({ status: 'failed', order: null })
  })

  it('binds return eligibility to a verified order and versioned policy', async () => {
    const repository = new MemoryToolRepository()
    const service = new DefaultToolExecutionService(repository)

    const result = await service.evaluateReturn(
      WORKSPACE_ID,
      {
        orderNumber: 'GD-2026D019',
        email: 'demo.customer19@example.com',
        productSku: 'LinkCore C240',
        reason: 'changed_mind',
        opened: false,
      },
      'en-US',
    )

    expect(result.status).toBe('succeeded')
    expect(result.result?.status).toBe('eligible')
    expect(result.result?.policyVersion).toBe(1)
    expect(result.result?.requiresApproval).toBe(true)
  })

  it('rejects malformed tool arguments before any repository read', async () => {
    const repository = new MemoryToolRepository()
    const service = new DefaultToolExecutionService(repository)

    await expect(
      service.lookupOrder(
        WORKSPACE_ID,
        { orderNumber: 'DROP TABLE orders', email: 'not-an-email' },
        'en-US',
      ),
    ).rejects.toThrow()
    expect(repository.lookupAttempts).toBe(0)
  })
})
