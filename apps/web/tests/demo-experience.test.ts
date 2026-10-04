// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { computed, nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import DemoAnswerText from '../src/components/DemoAnswerText.vue'
import DemoEvidencePanel from '../src/components/DemoEvidencePanel.vue'
import { useDemoSelection } from '../src/composables/useDemoSelection'
import { useDemoScroll } from '../src/composables/useDemoScroll'
import { i18n } from '../src/i18n'
import type { ChatMessageView } from '../src/stores/chat'
import { answerBlocks, answerInlines } from '../src/utils/demoAnswer'

const citation = {
  ordinal: 1,
  chunkId: crypto.randomUUID(),
  documentId: crypto.randomUUID(),
  documentTitle: 'Policy',
  sectionPath: ['Warranty', 'Cable'],
  pageStart: 2,
  pageEnd: 3,
  quote: 'Original excerpt.',
}
const message = (role: 'user' | 'assistant', content = ''): ChatMessageView => ({
  id: crypto.randomUUID(),
  role,
  content,
  citations: [],
  stages: [],
  tools: [],
  streaming: false,
  refused: false,
  handedOff: false,
  failed: false,
  feedback: null,
})

describe('Demo answer presentation', () => {
  it('preserves a masked recipient name without treating its asterisks as formatting', () => {
    const name = '收件人：D** C** 1*，邮箱 d********@example.com'
    expect(answerInlines(name, [])).toEqual([{ kind: 'text', text: name }])
  })
  it('preserves paragraphs, list items, links and real citation markers without HTML rendering', () => {
    expect(answerBlocks('Intro\n\n- One\n- Two\n\n1. First')).toEqual([
      { kind: 'paragraph', lines: ['Intro'] },
      { kind: 'unordered', lines: ['One', 'Two'] },
      { kind: 'ordered', lines: ['First'] },
    ])
    const wrapper = mount(DemoAnswerText, {
      props: {
        content:
          '**Warranty** [1] [99] <script>alert(1)</script>\n\n- One\n- [Source](https://example.com)\n- [Unsafe](javascript:alert)',
        citations: [citation],
      },
      global: { plugins: [i18n] },
    })
    expect(wrapper.findAll('li')).toHaveLength(3)
    expect(wrapper.findAll('.demo-citation-marker')).toHaveLength(1)
    expect(wrapper.get('a').attributes('rel')).toBe('noopener noreferrer')
    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.text()).toContain('[99]')
    void wrapper.get('button').trigger('click')
    expect(wrapper.emitted('citation')).toEqual([[1]])
    expect(
      answerInlines('[Unsafe](javascript:alert)', []).every((part) => part.kind !== 'link'),
    ).toBe(true)
  })
})

describe('Demo selected evidence', () => {
  it('pins the selected answer across a new reply and the server ID replacement', async () => {
    const messages = ref([message('user', 'First question'), message('assistant', 'First answer')])
    const selection = useDemoSelection(() => messages.value)
    await nextTick()
    const first = messages.value[1]!
    selection.select(first, 1)
    messages.value.push(message('user', 'Next question'), message('assistant', 'Streaming'))
    await nextTick()
    messages.value[3]!.content += ' update'
    first.id = crypto.randomUUID()
    await nextTick()
    expect(selection.selected.value).toBe(first)
    expect(selection.question.value).toBe('First question')
    expect(selection.answerNumber.value).toBe(1)
    selection.select(messages.value[3]!)
    expect(selection.question.value).toBe('Next question')
    expect(selection.citationOrdinal.value).toBeNull()
  })

  it('distinguishes pending, empty, failed and confirmed handoff with real metadata', async () => {
    const response = message('assistant')
    const wrapper = mount(DemoEvidencePanel, {
      props: { isLoading: false, productError: null, products: [], message: response },
      global: { plugins: [i18n] },
    })
    expect(wrapper.get('.demo-evidence__empty').attributes('data-state')).toBe('none')
    await wrapper.setProps({ message: { ...response, streaming: true } })
    expect(wrapper.get('.demo-evidence__empty').attributes('data-state')).toBe('pending')
    await wrapper.setProps({ message: { ...response, refused: true, failed: true } })
    expect(wrapper.get('.demo-evidence__empty').attributes('data-state')).toBe('failed')
    expect(wrapper.find('.demo-evidence__handoff').exists()).toBe(false)
    await wrapper.setProps({
      message: { ...response, citations: [citation], handedOff: true },
      citationOrdinal: 1,
      selectionRevision: 1,
    })
    expect(wrapper.get('blockquote').text()).toBe(citation.quote)
    expect(wrapper.text()).toContain('Warranty / Cable')
    expect(wrapper.text()).toContain('第 2 页–3')
    expect(wrapper.find('.demo-evidence__handoff').exists()).toBe(true)
    await wrapper.get('[data-source="1"] summary').trigger('click')
    expect(wrapper.get('[data-source="1"]').attributes('open')).toBeUndefined()
    await wrapper.setProps({ selectionRevision: 2 })
    expect(wrapper.get('[data-source="1"]').attributes('open')).toBeDefined()
  })
})

describe('Demo scroll following', () => {
  it('does not interrupt an upward reader, and allows an explicit jump to the latest', async () => {
    const scrollTo = vi.fn()
    const element = ref({
      clientHeight: 300,
      scrollHeight: 1400,
      scrollTop: 100,
      scrollTo,
    } as unknown as HTMLElement)
    const version = ref(0)
    const scroll = useDemoScroll(element, () => computed(() => String(version.value)).value)
    scroll.onScroll()
    version.value++
    await nextTick()
    expect(scrollTo).not.toHaveBeenCalled()
    expect(scroll.hasNewContent.value).toBe(true)
    await scroll.toBottom()
    expect(scrollTo).toHaveBeenCalledWith({ top: 1400, behavior: 'instant' })
    expect(scroll.hasNewContent.value).toBe(false)
  })
})
