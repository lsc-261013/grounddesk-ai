// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import DemoEvidencePanel from '../src/components/DemoEvidencePanel.vue'
import { i18n } from '../src/i18n'
import type { ChatMessageView } from '../src/stores/chat'

describe('Demo evidence panel', () => {
  it('renders an empty evidence state before the first answer', () => {
    const wrapper = mount(DemoEvidencePanel, {
      props: {
        isLoading: false,
        message: null,
        productError: null,
        products: [],
      },
      global: { plugins: [i18n] },
    })

    expect(wrapper.get('.demo-evidence').attributes('aria-label')).toBe('当前回答上下文')
    expect(wrapper.text()).toContain('从答案，看到依据。')
  })

  it('does not claim a confirmed handoff if a previously received status ends in failure', () => {
    const message: ChatMessageView = {
      id: 'failed-message',
      role: 'assistant',
      content: 'Partial answer',
      citations: [],
      stages: [],
      tools: [],
      streaming: false,
      refused: true,
      handedOff: true,
      failed: true,
      feedback: null,
    }
    const wrapper = mount(DemoEvidencePanel, {
      props: { isLoading: false, message, productError: null, products: [] },
      global: { plugins: [i18n] },
    })
    expect(wrapper.get('.demo-evidence__empty').attributes('data-state')).toBe('failed')
    expect(wrapper.find('.demo-evidence__handoff').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('已确认的人工处理状态见上方')
  })
})
