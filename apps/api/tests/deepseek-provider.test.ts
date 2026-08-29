import { describe, expect, it } from 'vitest'

import { DeepSeekGenerationProvider } from '../src/generation/deepseek-provider.js'

const jsonResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })

describe('DeepSeek provider adapter', () => {
  it('validates an allowlisted order tool call before returning it', async () => {
    const request: typeof fetch = () =>
      Promise.resolve(
        jsonResponse({
          id: 'request-plan-1',
          choices: [
            {
              message: {
                content: null,
                tool_calls: [
                  {
                    id: 'call-1',
                    type: 'function',
                    function: {
                      name: 'order_lookup',
                      arguments: JSON.stringify({
                        orderNumber: 'GD-2026D019',
                        email: 'demo.customer19@example.com',
                      }),
                    },
                  },
                ],
              },
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
        }),
      )
    const provider = new DeepSeekGenerationProvider(
      'deepseek-v4-flash',
      'https://api.deepseek.com',
      'test-key',
      5_000,
      request,
    )

    const result = await provider.plan('check my order', 'en-US')

    expect(result.plan.intent).toBe('order_lookup')
    expect(result.plan.toolCall).toMatchObject({
      name: 'order_lookup',
      input: { orderNumber: 'GD-2026D019', email: 'demo.customer19@example.com' },
    })
    expect(result.usage.totalTokens).toBe(14)
  })

  it('streams visible answer tokens but never exposes reasoning content', async () => {
    const payload = [
      'data: {"id":"request-stream-1","choices":[{"delta":{"reasoning_content":"hidden"}}],"usage":null}\n\n',
      'data: {"id":"request-stream-1","choices":[{"delta":{"content":"Supported [1]."}}],"usage":null}\n\n',
      'data: {"id":"request-stream-1","choices":[],"usage":{"prompt_tokens":20,"completion_tokens":5,"total_tokens":25}}\n\n',
      'data: [DONE]\n\n',
    ].join('')
    const request: typeof fetch = () =>
      Promise.resolve(
        new Response(payload, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
      )
    const provider = new DeepSeekGenerationProvider(
      'deepseek-v4-flash',
      'https://api.deepseek.com',
      'test-key',
      5_000,
      request,
    )
    const chunks = []

    for await (const chunk of provider.streamGroundedAnswer({
      locale: 'en-US',
      question: 'Does it support this?',
      intent: 'knowledge_answer',
      evidence: [],
      toolResult: null,
    })) {
      chunks.push(chunk)
    }

    expect(chunks).toEqual([
      { type: 'text', delta: 'Supported [1].' },
      {
        type: 'usage',
        providerRequestId: 'request-stream-1',
        usage: { inputTokens: 20, outputTokens: 5, totalTokens: 25, available: true },
      },
    ])
    expect(JSON.stringify(chunks)).not.toContain('hidden')
  })
})
