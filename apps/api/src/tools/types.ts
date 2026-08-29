import type {
  Locale,
  OrderLookupToolResult,
  OrderStatus,
  PublicOrder,
  ReturnEligibilityResult,
  ReturnEligibilityToolInput,
} from '@grounddesk/shared'

export interface VerifiedOrderItem {
  id: string
  productId: string
  sku: string
  model: string
  category: string
  nameZh: string
  nameEn: string
  quantity: number
  opened: boolean
  isReturnable: boolean
  openedReturnPolicy: string
}

export interface VerifiedOrder {
  id: string
  workspaceId: string
  orderNumber: string
  customerName: string
  customerEmail: string
  status: OrderStatus
  orderedAt: Date
  shippedAt: Date | null
  deliveredAt: Date | null
  carrier: string | null
  trackingNumberMasked: string | null
  totalCents: number
  currency: string
  items: VerifiedOrderItem[]
}

export interface ReturnPolicyRules {
  standardWindowDays: number
  sealedAudioWindowDays: number
  shippingDamageReportDays: number
  openedAudioRequiresManualReview: boolean
  batteryProductsRequireGroundReturnLabel: boolean
  finalSaleCategories: string[]
}

export interface ReturnPolicyRecord {
  id: string
  workspaceId: string
  version: number
  name: string
  rules: ReturnPolicyRules
  policyTextZh: string
  policyTextEn: string
}

export interface OrderToolRepository {
  getOrderByNumber(workspaceId: string, orderNumber: string): Promise<VerifiedOrder | null>
  getReturnPolicy(workspaceId: string, effectiveAt: Date): Promise<ReturnPolicyRecord | null>
  close(): Promise<void>
}

export type ReturnToolOutcome =
  | { status: 'succeeded'; result: ReturnEligibilityResult; order: PublicOrder }
  | { status: 'not_found' | 'email_mismatch' | 'failed'; result: null; order: null }

export interface ToolExecutionService {
  lookupOrder(
    workspaceId: string,
    input: { orderNumber: string; email: string },
    locale: Locale,
  ): Promise<OrderLookupToolResult>
  evaluateReturn(
    workspaceId: string,
    input: ReturnEligibilityToolInput,
    locale: Locale,
  ): Promise<ReturnToolOutcome>
  close(): Promise<void>
}
