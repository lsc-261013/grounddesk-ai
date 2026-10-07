// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'

import SupportPreview from '../src/components/SupportPreview.vue'
import { presentationEn, presentationZh } from '../src/locales/presentation'

describe('bilingual scenario preview', () => {
  it.each(['zh-CN', 'en-US'])(
    'renders order email as data, not linked-message syntax: %s',
    async (locale) => {
      const wrapper = mount(SupportPreview, {
        global: {
          plugins: [
            createI18n({
              legacy: false,
              locale,
              messages: {
                'zh-CN': {
                  presentation: presentationZh,
                  landing: { preview: { ariaLabel: '服务场景预览' } },
                },
                'en-US': {
                  presentation: presentationEn,
                  landing: { preview: { ariaLabel: 'Support preview' } },
                },
              },
            }),
          ],
          stubs: { RouterLink: true, Transition: true },
        },
      })
      await wrapper.get('#preview-order').trigger('click')
      expect(wrapper.get('.preview-question').text()).toContain('demo.customer19@example.com')
      expect(wrapper.get('.preview-response').text()).not.toContain('18')
      await wrapper.get('#preview-handoff').trigger('click')
      expect(wrapper.get('.preview-question').text()).not.toContain('demo.customer19@example.com')
    },
  )
})
