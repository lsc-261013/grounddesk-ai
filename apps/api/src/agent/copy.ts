import type { Locale } from '@grounddesk/shared'

const fieldLabels = {
  'zh-CN': {
    orderNumber: '订单号',
    email: '下单邮箱',
    productSku: '商品 SKU（单商品订单可省略）',
    reason: '退货原因',
    opened: '商品是否已拆封',
  },
  'en-US': {
    orderNumber: 'order number',
    email: 'checkout email',
    productSku: 'product SKU (optional for a single-item order)',
    reason: 'return reason',
    opened: 'whether the product was opened',
  },
} as const

export const chatCopy = {
  'zh-CN': {
    missing: (fields: string[]) =>
      `继续前还需要：${fields.map((field) => fieldLabels['zh-CN'][field as keyof (typeof fieldLabels)['zh-CN']] ?? field).join('、')}。我不会猜测这些信息。`,
    noEvidence: '现有资料不足以确认这个问题。我已经记录已检查的来源，并创建人工工单。',
    conflict: '检索到的资料存在冲突，我不能选择性猜测。已创建人工工单核对政策。',
    injection: '我不能忽略安全规则、泄露系统提示或绕过权限。该请求已转人工复核。',
    human: '已按你的要求转接人工客服，客服可以查看本次会话上下文。',
    handoffPending: '这个会话已转入人工处理。你的新消息已保留在同一会话中，AI 不会继续自动回答。',
    providerFailure: 'AI 服务暂时无法完成这次回答。为避免编造，我已创建人工工单。',
    planningFailure:
      '这次工具计划暂时无法执行，不是你缺少订单信息。已转人工处理，请勿重复提供个人资料。',
    citationFailure: '这次生成结果未通过引用完整性校验，因此没有作为可靠答案保留。已转人工处理。',
    orderNotFound: '没有找到这个订单号，请检查示例订单号后重试。',
    emailMismatch: '订单号存在，但下单邮箱不匹配。为保护订单信息，我不会返回详情。',
    toolFailure: '订单相关工具暂时不可用。我没有猜测结果，并已转人工处理。',
    orderToolSummary: '订单凭据已由服务端校验，返回的是脱敏只读信息。',
    unverifiedToolSummary: '这次工具调用未得到可核验结果，没有返回订单详情。',
    returnToolSummary: '退货资格已由版本化政策规则计算，不会自动退款或修改订单。',
    returnRequested: '已将退货意向创建为待人工审批工单；系统没有执行退款。',
  },
  'en-US': {
    missing: (fields: string[]) =>
      `Before continuing, I still need: ${fields.map((field) => fieldLabels['en-US'][field as keyof (typeof fieldLabels)['en-US']] ?? field).join(', ')}. I will not guess these values.`,
    noEvidence:
      'The available sources are not sufficient to confirm this. I recorded the checked sources and created a human-support ticket.',
    conflict:
      'The retrieved sources conflict, so I will not choose one by guesswork. A human-support ticket was created for policy review.',
    injection:
      'I cannot ignore safety rules, reveal system prompts, or bypass authorization. This request was handed off for review.',
    human: 'I handed this conversation to a human support agent as requested.',
    handoffPending:
      'This conversation is already with human support. Your new message remains in the same thread, and AI will not answer automatically.',
    providerFailure:
      'The AI service could not complete this answer. To avoid guessing, I created a human-support ticket.',
    planningFailure:
      'The tool plan could not be executed; this does not mean your order details are missing. A human-support ticket was created.',
    citationFailure:
      'The generated answer did not pass citation-integrity checks, so it was not retained as a reliable answer. A human ticket was created.',
    orderNotFound:
      'That order number was not found. Please check the demo order number and try again.',
    emailMismatch:
      'The order number exists, but the checkout email does not match. I will not return order details.',
    toolFailure:
      'The order tool is temporarily unavailable. I did not guess the result and created a human-support ticket.',
    orderToolSummary:
      'The server verified the order credentials and returned only masked, read-only details.',
    unverifiedToolSummary:
      'The tool did not return a verifiable result. No order details were returned.',
    returnToolSummary:
      'Versioned policy rules calculated the return eligibility; no refund or order change was performed.',
    returnRequested:
      'I created a return request for human approval. The system did not issue a refund.',
  },
} as const satisfies Record<Locale, Record<string, unknown>>
