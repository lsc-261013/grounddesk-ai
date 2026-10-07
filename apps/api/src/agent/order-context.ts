const ORDER_PATTERN = /\bGD-[A-Z0-9]{8}\b/gi
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi

export const requestsOrderLookup = (text: string): boolean =>
  !/退货|退款|return|refund/i.test(text) &&
  !/(?:如何|怎么)(?:查询|查|追踪|查看)|查询订单.*(?:需要什么|的步骤)|how (?:to|do)|what.*need/i.test(
    text,
  ) &&
  /查(?:询|看)?(?:一下)?(?:我的|该)?订单|我的订单(?:在哪|到哪)|订单状态|物流状态|(?:track|check|look up|查询).{0,20}(?:GD-|my order|order)|where is my order|order status/i.test(
    text,
  )

export const orderCredentials = (
  text: string,
): { orderNumber: string | null; email: string | null } => {
  const normalized = text.normalize('NFKC')
  const orders = [
    ...new Set(normalized.match(ORDER_PATTERN)?.map((value) => value.toUpperCase()) ?? []),
  ]
  const emails = [
    ...new Set(normalized.match(EMAIL_PATTERN)?.map((value) => value.toLowerCase()) ?? []),
  ]
  return {
    orderNumber: orders.length === 1 ? orders[0]! : null,
    email: emails.length === 1 ? emails[0]! : null,
  }
}

const isCredentialFollowUp = (text: string): boolean => {
  const normalized = text.normalize('NFKC')
  if (!normalized.match(ORDER_PATTERN) && !normalized.match(EMAIL_PATTERN)) return false
  const remainder = normalized
    .replace(ORDER_PATTERN, '')
    .replace(EMAIL_PATTERN, '')
    .replace(
      /下单邮箱|邮箱|订单号|订单|我的|补充|改为|改成|更正为|应该是|是|或|或者|my|checkout|email|order|number|is|corrected|change(?:d)?|to|or/gi,
      '',
    )
    .replace(/[\s\p{P}\p{S}]/gu, '')
  return remainder.length === 0
}

export const resolveOrderContext = (current: string, previousUserMessages: string[]): string => {
  if (requestsOrderLookup(current)) return current
  // A new topic terminates the credential exchange; assistant text is never a source.
  if (!isCredentialFollowUp(current)) return current
  const chain: string[] = []
  for (const text of [...previousUserMessages].reverse()) {
    chain.unshift(text)
    if (requestsOrderLookup(text)) break
    if (!isCredentialFollowUp(text)) return current
  }
  if (!chain.length || !requestsOrderLookup(chain[0]!)) return current
  const credentials = orderCredentials(chain[0]!)
  for (const text of [...chain.slice(1), current]) {
    const normalized = text.normalize('NFKC')
    const next = orderCredentials(normalized)
    // A changed order cannot silently reuse another order's checkout email.
    if (next.orderNumber && next.orderNumber !== credentials.orderNumber) credentials.email = null
    if (normalized.match(ORDER_PATTERN)) credentials.orderNumber = next.orderNumber
    if (normalized.match(EMAIL_PATTERN)) credentials.email = next.email
  }
  return `Check my order status. ${credentials.orderNumber ?? ''} ${credentials.email ?? ''}`.trim()
}
