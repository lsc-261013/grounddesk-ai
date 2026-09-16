// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import DemoEvidencePanel from '../src/components/DemoEvidencePanel.vue'
import { i18n } from '../src/i18n'

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
    expect(wrapper.text()).toContain('等待一条有依据的回答')
  })
})
