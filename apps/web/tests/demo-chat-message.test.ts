// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import DemoChatMessage from '../src/components/DemoChatMessage.vue'
import { i18n } from '../src/i18n'
import type { ChatMessageView } from '../src/stores/chat'

const createMessage = (overrides: Partial<ChatMessageView>): ChatMessageView => ({
  id: crypto.randomUUID(),
  role: 'user',
  content: 'LinkCore C240 的保修期是多久？',
  citations: [],
  stages: [],
  tools: [],
  streaming: false,
  refused: false,
  handedOff: false,
  failed: false,
  feedback: null,
  ...overrides,
})

describe('Demo chat message', () => {
  it('does not add a redundant sender label to right-aligned visitor messages', () => {
    const wrapper = mount(DemoChatMessage, {
      props: { isSelected: false, message: createMessage({}) },
      global: { plugins: [i18n] },
    })

    expect(wrapper.find('.demo-message__meta').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('你')
  })

  it('renders a failed assistant response without asking for feedback', () => {
    const wrapper = mount(DemoChatMessage, {
      props: {
        isSelected: false,
        message: createMessage({
          role: 'assistant',
          content: '暂时无法连接问答服务，请稍后重试。',
          failed: true,
        }),
      },
      global: { plugins: [i18n] },
    })

    expect(wrapper.text()).toContain('请求失败')
    expect(wrapper.find('.answer-feedback').exists()).toBe(false)
  })
})
