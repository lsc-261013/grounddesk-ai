// @vitest-environment happy-dom

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useChatStore } from '../src/stores/chat'

describe('public chat request state', () => {
  beforeEach(() => {
    window.localStorage.clear()
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  it('does not claim that feedback was saved when the feedback request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Feedback could not be saved')))
    const store = useChatStore()
    store.conversationId = crypto.randomUUID()
    store.messages.push({
      id: crypto.randomUUID(),
      role: 'assistant',
      content: 'Completed answer',
      citations: [],
      stages: [],
      tools: [],
      streaming: false,
      refused: false,
      handedOff: false,
      failed: false,
      feedback: null,
    })
    const response = store.messages[0]!
    await store.submitFeedback(response, 'helpful')
    expect(response.feedback).toBeNull()
    expect(response.feedbackPending).toBe(false)
    expect(store.error).toBe('Feedback could not be saved')
  })

  it('replaces the empty streaming placeholder with an explicit network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const store = useChatStore()
    await store.sendMessage('LinkCore C240 的保修期是多久？', 'zh-CN')

    expect(store.isStreaming).toBe(false)
    expect(store.error).toBe('无法连接问答服务，请检查 API 地址、服务状态或跨域配置。')
    expect(store.messages).toHaveLength(2)
    expect(store.messages[1]).toMatchObject({
      role: 'assistant',
      content: '暂时无法连接问答服务，请稍后重试。',
      streaming: false,
      failed: true,
    })
  })

  it('terminates an SSE error without claiming a successful handoff or keeping a spinner', async () => {
    const body = `data: ${JSON.stringify({ type: 'error', code: 'unavailable', message: 'Service unavailable' })}\n\n`
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)))
    const store = useChatStore()
    await store.sendMessage('Question', 'en-US')
    expect(store.messages[1]).toMatchObject({ failed: true, streaming: false, handedOff: false })
    expect(store.error).toBe('Service unavailable')
  })

  it('keeps partial content and reports a stream without its completion event as incomplete', async () => {
    const body = `data: ${JSON.stringify({ type: 'token', delta: 'Partial content' })}\n\n`
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)))
    const store = useChatStore()
    await store.sendMessage('Question', 'en-US')
    expect(store.messages[1]).toMatchObject({
      content: 'Partial content',
      failed: true,
      streaming: false,
    })
    expect(store.error).toContain('ended before completion')
  })

  it('locks repeated sends and reset while the response is in flight', async () => {
    let resolve: ((response: Response) => void) | undefined
    const fetch = vi.fn().mockReturnValue(
      new Promise<Response>((done) => {
        resolve = done
      }),
    )
    vi.stubGlobal('fetch', fetch)
    const store = useChatStore()
    const first = store.sendMessage('Question', 'zh-CN')
    await store.sendMessage('Duplicate', 'zh-CN')
    store.resetConversation()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(store.messages).toHaveLength(2)
    resolve?.(
      new Response('data: {"type":"error","code":"unavailable","message":"unavailable"}\n\n'),
    )
    await first
    expect(store.isStreaming).toBe(false)
  })
})
