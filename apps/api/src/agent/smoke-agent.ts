import { randomUUID } from 'node:crypto'

import { chatStreamEventSchema, type AgentIntent, type ChatStreamEvent } from '@grounddesk/shared'

import { buildApp } from '../app.js'

interface SmokeCase {
  caseKey: string
  message: string
  locale: 'zh-CN' | 'en-US'
  expectedIntent: AgentIntent
  expectedTool?: 'order_lookup' | 'return_eligibility'
  expectedEligibility?: 'eligible' | 'ineligible' | 'manual_review'
  expectedRefused: boolean
}

const cases: readonly SmokeCase[] = [
  {
    caseKey: 'grounded_knowledge_stream',
    message: 'Airwave S1 是否支持同时连接两台设备？',
    locale: 'zh-CN',
    expectedIntent: 'knowledge_answer',
    expectedRefused: false,
  },
  {
    caseKey: 'verified_order_tool',
    message: '请查询订单 GD-2026D019，下单邮箱是 demo.customer19@example.com。',
    locale: 'zh-CN',
    expectedIntent: 'order_lookup',
    expectedTool: 'order_lookup',
    expectedRefused: false,
  },
  {
    caseKey: 'deterministic_return_tool',
    message:
      'Check return eligibility for order GD-2026D019, email demo.customer19@example.com, SKU AVL-OR-H5-NVY. I changed my mind and the headphones are opened.',
    locale: 'en-US',
    expectedIntent: 'return_eligibility',
    expectedTool: 'return_eligibility',
    expectedEligibility: 'manual_review',
    expectedRefused: false,
  },
  {
    caseKey: 'unknown_question_handoff',
    message: '你们是否为火星殖民地提供维修服务？',
    locale: 'zh-CN',
    expectedIntent: 'human_handoff',
    expectedRefused: true,
  },
]

const parseEvents = (body: string): ChatStreamEvent[] =>
  body
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data: '))
    .map((line) => chatStreamEventSchema.parse(JSON.parse(line.slice(6)) as unknown))

const app = await buildApp({ logger: false })

try {
  const results = []
  for (const smokeCase of cases) {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/public/workspaces/avenlo-demo/chat/stream',
      payload: {
        sessionId: randomUUID(),
        message: smokeCase.message,
        locale: smokeCase.locale,
      },
    })
    if (response.statusCode !== 200) {
      throw new Error(`${smokeCase.caseKey} returned HTTP ${response.statusCode}.`)
    }
    const events = parseEvents(response.body)
    const done = events.find(
      (streamEvent): streamEvent is Extract<ChatStreamEvent, { type: 'done' }> =>
        streamEvent.type === 'done',
    )
    const tools = events.filter(
      (streamEvent): streamEvent is Extract<ChatStreamEvent, { type: 'tool' }> =>
        streamEvent.type === 'tool',
    )
    const citations = events.flatMap((streamEvent) =>
      streamEvent.type === 'citations' ? streamEvent.citations : [],
    )
    const tokenEvents = events.filter((streamEvent) => streamEvent.type === 'token').length
    if (
      !done ||
      done.intent !== smokeCase.expectedIntent ||
      done.refused !== smokeCase.expectedRefused ||
      (smokeCase.expectedTool &&
        !tools.some(
          (tool) => tool.toolName === smokeCase.expectedTool && tool.status === 'succeeded',
        )) ||
      (smokeCase.expectedEligibility &&
        !tools.some(
          (tool) =>
            tool.details.kind === 'return_eligibility' &&
            tool.details.eligibility === smokeCase.expectedEligibility,
        )) ||
      (!smokeCase.expectedRefused && tokenEvents === 0) ||
      (smokeCase.caseKey === 'grounded_knowledge_stream' && citations.length === 0)
    ) {
      throw new Error(
        `${smokeCase.caseKey} did not meet its expected observable outcome: ${JSON.stringify({
          done,
          tools: tools.map((tool) => ({
            name: tool.toolName,
            status: tool.status,
            details: tool.details,
          })),
          citationCount: citations.length,
          tokenEvents,
        })}`,
      )
    }
    results.push({
      caseKey: smokeCase.caseKey,
      intent: done.intent,
      refused: done.refused,
      handedOff: done.handedOff,
      tools: tools.map((tool) => ({
        name: tool.toolName,
        status: tool.status,
        details: tool.details,
      })),
      citationCount: citations.length,
      tokenEvents,
    })
  }

  process.stdout.write(`${JSON.stringify({ valid: true, cases: results }, null, 2)}\n`)
} finally {
  await app.close()
}
