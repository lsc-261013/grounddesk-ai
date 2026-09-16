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
})
