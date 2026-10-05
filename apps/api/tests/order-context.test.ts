import { describe, expect, it } from 'vitest'
import {
  orderCredentials,
  resolveOrderContext,
  requestsOrderLookup,
} from '../src/agent/order-context.js'
import { constrainAgentPlan } from '../src/agent/plan-constraints.js'

const complete = '查询订单 GD-2026D019，下单邮箱是 demo.customer19@example.com。'
describe('order request boundaries and user-only context', () => {
  it.each([{ missingFields: [] }, { missingFields: ['orderNumber', 'email'] }])(
    'recovers a missing tool call and ignores invented missing fields %j',
    ({ missingFields }) => {
      expect(
        constrainAgentPlan(
          { intent: 'order_lookup', normalizedQuestion: complete, missingFields, toolCall: null },
          complete,
        ),
      ).toMatchObject({
        intent: 'order_lookup',
        missingFields: [],
        toolCall: {
          name: 'order_lookup',
          input: { orderNumber: 'GD-2026D019', email: 'demo.customer19@example.com' },
        },
      })
    },
  )
  it.each([
    ['查询订单 GD-2026D019。', ['email']],
    ['Check my order status, email demo.customer19@example.com.', ['orderNumber']],
  ])('asks only for absent fields', (message, expected) => {
    expect(
      constrainAgentPlan(
        {
          intent: 'order_lookup',
          normalizedQuestion: message,
          missingFields: ['email', 'orderNumber'],
          toolCall: null,
        },
        message,
      ),
    ).toMatchObject({ toolCall: null, missingFields: expected })
  })
  it('accepts Chinese punctuation, full-width text and English', () => {
    expect(
      orderCredentials('Check order ＧＤ-２０２６Ｄ０１９，EMAIL：Demo.Customer19@example.com。'),
    ).toEqual({ orderNumber: 'GD-2026D019', email: 'demo.customer19@example.com' })
  })
  it('does not authorize a tool from credentials or generic instructions alone', () => {
    expect(requestsOrderLookup('GD-2026D019 demo.customer19@example.com')).toBe(false)
    expect(requestsOrderLookup('如何查询订单，需要什么资料？')).toBe(false)
    expect(requestsOrderLookup('Check return eligibility for order GD-2026D019')).toBe(false)
  })
  it('recognizes an explicit status request without treating a how-to question as authorization', () => {
    expect(requestsOrderLookup('查询我的订单，GD-2026D019 怎么还没到？')).toBe(true)
    expect(requestsOrderLookup('查看订单 GD-2026D019')).toBe(true)
    expect(requestsOrderLookup('怎么查询订单？')).toBe(false)
  })
  it('supplements only the contiguous order exchange', () => {
    expect(resolveOrderContext('公司邮箱 ceo@example.com 是什么？', [complete])).toBe(
      '公司邮箱 ceo@example.com 是什么？',
    )
    expect(
      orderCredentials(
        resolveOrderContext('邮箱是 demo.customer19@example.com。', ['查询订单 GD-2026D019。']),
      ),
    ).toEqual({ orderNumber: 'GD-2026D019', email: 'demo.customer19@example.com' })
    expect(
      resolveOrderContext('demo.customer19@example.com', ['查询订单 GD-2026D019', '保修期多久？']),
    ).toBe('demo.customer19@example.com')
    expect(resolveOrderContext('demo.customer19@example.com', [])).toBe(
      'demo.customer19@example.com',
    )
  })
  it('uses corrections, rejects ambiguous values and clears email on changed order', () => {
    expect(
      orderCredentials(resolveOrderContext('订单号改成 ＧＤ－２０２６Ｄ０２０', [complete])),
    ).toEqual({
      orderNumber: 'GD-2026D020',
      email: null,
    })
    expect(
      orderCredentials(resolveOrderContext('邮箱改为 corrected@example.com', [complete])),
    ).toEqual({ orderNumber: 'GD-2026D019', email: 'corrected@example.com' })
    expect(orderCredentials(resolveOrderContext('订单号改成 GD-2026D020', [complete]))).toEqual({
      orderNumber: 'GD-2026D020',
      email: null,
    })
    expect(
      orderCredentials(resolveOrderContext('a@example.com 或 b@example.com', [complete])).email,
    ).toBeNull()
    expect(orderCredentials('GD-2026D019 或 GD-2026D020 a@example.com').orderNumber).toBeNull()
  })
})
