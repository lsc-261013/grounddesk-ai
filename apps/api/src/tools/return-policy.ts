import type { Locale, ReturnEligibilityResult, ReturnReason } from '@grounddesk/shared'

import type { ReturnPolicyRecord, VerifiedOrder, VerifiedOrderItem } from './types.js'

interface ReturnEvaluationInput {
  order: VerifiedOrder
  item: VerifiedOrderItem
  policy: ReturnPolicyRecord
  reason: ReturnReason
  declaredOpened: boolean
  locale: Locale
  now: Date
}

const DAY_MS = 86_400_000

const copy = {
  'zh-CN': {
    notDelivered: '订单尚未签收，当前不能按签收后的退货窗口判断。',
    notReturnable: '该商品类别被标记为不可退。',
    finalSale: '该商品类别属于此政策版本的最终销售商品。',
    invalidDate: '签收时间异常，需要人工核对。',
    damageLate: (days: number) => `运输损坏已超过签收后 ${days} 天的报告期限。`,
    damageReview: (days: number) => `运输损坏在 ${days} 天报告期限内，需要人工审核损坏材料。`,
    windowExpired: (days: number) => `已超过签收后 ${days} 天的退货窗口。`,
    openedReview: '已拆封音频商品需要人工检查卫生与商品状态。',
    eligible: (days: number) => `订单仍在签收后 ${days} 天的退货窗口内。`,
    groundLabel: '移动电源退回必须使用商家提供的指定陆运标签。',
    approval: '资格结果只允许创建待人工审批的申请，不会自动退款。',
  },
  'en-US': {
    notDelivered:
      'The order has not been delivered, so a post-delivery return window cannot apply yet.',
    notReturnable: 'This product category is marked as non-returnable.',
    finalSale: 'This product category is final sale under this policy version.',
    invalidDate: 'The delivery timestamp needs manual verification.',
    damageLate: (days: number) =>
      `The shipping-damage report is outside the ${days}-day reporting period.`,
    damageReview: (days: number) =>
      `The report is within the ${days}-day shipping-damage period and requires evidence review.`,
    windowExpired: (days: number) =>
      `The order is outside the ${days}-day post-delivery return window.`,
    openedReview: 'Opened audio products require a manual hygiene and condition review.',
    eligible: (days: number) => `The order is within the ${days}-day post-delivery return window.`,
    groundLabel: 'A power bank must use the merchant-provided ground-return label.',
    approval: 'Eligibility only creates a request for human approval; it never issues a refund.',
  },
} as const

export const evaluateReturnEligibility = (
  input: ReturnEvaluationInput,
): ReturnEligibilityResult => {
  const text = copy[input.locale]
  const base = {
    policyVersion: input.policy.version,
    requiresApproval: true as const,
  }
  const result = (
    status: ReturnEligibilityResult['status'],
    reasonCodes: string[],
    explanation: string,
    matchedClauses: string[],
  ): ReturnEligibilityResult => ({ ...base, status, reasonCodes, explanation, matchedClauses })

  if (input.order.status !== 'delivered' || !input.order.deliveredAt) {
    return result('ineligible', ['order_not_delivered'], text.notDelivered, [text.notDelivered])
  }

  if (!input.item.isReturnable) {
    return result('ineligible', ['product_not_returnable'], text.notReturnable, [
      text.notReturnable,
    ])
  }

  if (input.policy.rules.finalSaleCategories.includes(input.item.category)) {
    return result('ineligible', ['final_sale_category'], text.finalSale, [text.finalSale])
  }

  const elapsedDays = Math.floor((input.now.getTime() - input.order.deliveredAt.getTime()) / DAY_MS)
  if (elapsedDays < 0) {
    return result('manual_review', ['invalid_delivery_time'], text.invalidDate, [text.invalidDate])
  }

  if (input.reason === 'shipping_damage') {
    const reportDays = input.policy.rules.shippingDamageReportDays
    if (elapsedDays > reportDays) {
      return result('ineligible', ['shipping_damage_report_late'], text.damageLate(reportDays), [
        text.damageLate(reportDays),
      ])
    }
    return result(
      'manual_review',
      ['shipping_damage_evidence_required'],
      `${text.damageReview(reportDays)} ${text.approval}`,
      [text.damageReview(reportDays), text.approval],
    )
  }

  const isSealedAudio = input.item.openedReturnPolicy === 'sealed_audio'
  const windowDays = isSealedAudio
    ? input.policy.rules.sealedAudioWindowDays
    : input.policy.rules.standardWindowDays
  if (elapsedDays > windowDays) {
    return result('ineligible', ['return_window_expired'], text.windowExpired(windowDays), [
      text.windowExpired(windowDays),
    ])
  }

  const opened = input.declaredOpened || input.item.opened
  const openedAudioPolicy = ['sealed_audio', 'opened_audio_review'].includes(
    input.item.openedReturnPolicy,
  )
  if (opened && openedAudioPolicy && input.policy.rules.openedAudioRequiresManualReview) {
    return result(
      'manual_review',
      ['opened_audio_requires_review'],
      `${text.openedReview} ${text.approval}`,
      [text.openedReview, text.approval],
    )
  }

  const clauses = [text.eligible(windowDays), text.approval]
  const reasonCodes = ['within_return_window']
  if (
    input.item.category === 'power_bank' &&
    input.policy.rules.batteryProductsRequireGroundReturnLabel
  ) {
    reasonCodes.push('ground_return_label_required')
    clauses.splice(1, 0, text.groundLabel)
  }

  return result('eligible', reasonCodes, clauses.join(' '), clauses)
}
