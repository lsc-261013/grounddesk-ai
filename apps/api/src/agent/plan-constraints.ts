import type { AgentPlan } from '../generation/types.js'

export const shouldUseModelPlanner = (message: string): boolean =>
  /GD-[A-Z0-9]{8}|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(message) ||
  /(my order|track (?:my|an) order|order status|where is my order|return my order|start a return|我的订单|查询订单|订单状态|物流状态|我要退货|我想退货|退货资格)/i.test(
    message,
  )

const orderNumberFrom = (message: string): string | null =>
  /GD-[A-Z0-9]{8}/i.exec(message)?.[0]?.toUpperCase() ?? null

const emailFrom = (message: string): string | null =>
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.exec(message)?.[0]?.toLowerCase() ?? null

const openedFrom = (message: string): boolean | null => {
  if (/unopened|still sealed|not opened|未拆封|没有拆封|尚未开封/i.test(message)) return false
  if (/\bopened\b|unsealed|已拆封|拆开了|已开封/i.test(message)) return true
  return null
}

const reasonFrom = (
  message: string,
): 'changed_mind' | 'defective' | 'shipping_damage' | 'wrong_item' | 'other' | null => {
  if (/shipping damage|damaged in shipping|transit damage|运输损坏|物流破损/i.test(message)) {
    return 'shipping_damage'
  }
  if (/wrong item|incorrect item|发错货|商品错了/i.test(message)) return 'wrong_item'
  if (/defective|faulty|does not work|质量问题|故障|无法工作/i.test(message)) return 'defective'
  if (/changed my mind|do not want|don't want|改变主意|不想要|不需要/i.test(message)) {
    return 'changed_mind'
  }
  if (/other reason|其他原因/i.test(message)) return 'other'
  return null
}

export const constrainAgentPlan = (plan: AgentPlan, message: string): AgentPlan => {
  if (plan.intent === 'human_handoff') {
    return {
      intent: 'knowledge_answer',
      normalizedQuestion: plan.normalizedQuestion || message,
      missingFields: [],
      toolCall: null,
    }
  }
  if (plan.intent === 'knowledge_answer') return plan

  const orderNumber = orderNumberFrom(message)
  const email = emailFrom(message)
  if (plan.intent === 'order_lookup') {
    const missingFields = [...(orderNumber ? [] : ['orderNumber']), ...(email ? [] : ['email'])]
    if (!plan.toolCall || !orderNumber || !email) {
      return {
        ...plan,
        missingFields: [...new Set([...plan.missingFields, ...missingFields])],
        toolCall: null,
      }
    }
    return {
      ...plan,
      missingFields: [],
      toolCall: { ...plan.toolCall, input: { orderNumber, email } },
    }
  }

  const opened = openedFrom(message)
  const reason = reasonFrom(message)
  const missingFields = [
    ...(orderNumber ? [] : ['orderNumber']),
    ...(email ? [] : ['email']),
    ...(reason ? [] : ['reason']),
    ...(opened === null ? ['opened'] : []),
  ]
  if (!plan.toolCall || !orderNumber || !email || !reason || opened === null) {
    return {
      ...plan,
      missingFields: [...new Set([...plan.missingFields, ...missingFields])],
      toolCall: null,
    }
  }
  return {
    ...plan,
    missingFields: [],
    toolCall: {
      ...plan.toolCall,
      input: {
        ...plan.toolCall.input,
        orderNumber,
        email,
        productSku: /AVL-[A-Z0-9-]+/i.exec(message)?.[0]?.toUpperCase() ?? null,
        reason,
        opened,
      },
    },
  }
}
