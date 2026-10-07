// @vitest-environment happy-dom

import { ref, nextTick } from 'vue'
import { describe, expect, it } from 'vitest'

import { useDemoSelection } from '../src/composables/useDemoSelection'
import type { ChatMessageView } from '../src/stores/chat'

const answer = (id: string, ordinals: number[]): ChatMessageView => ({
  id,
  role: 'assistant',
  content: 'Controlled test answer',
  stages: [],
  tools: [],
  streaming: false,
  refused: false,
  handedOff: false,
  failed: false,
  feedback: null,
  citations: ordinals.map((ordinal) => ({
    ordinal,
    chunkId: `${id}-${ordinal}`,
    documentId: id,
    documentTitle: id,
    sectionPath: [],
    pageStart: null,
    pageEnd: null,
    quote: `Excerpt ${id}-${ordinal}`,
  })),
})

describe('source selection ownership', () => {
  it('opens the first valid source from the aggregate entry, preserving the chosen source on repeats', () => {
    const message = answer('first', [4, 8])
    const selection = useDemoSelection(() => [message])
    selection.select(message)
    expect(selection.citationOrdinal.value).toBe(4)
    selection.select(message, 8)
    selection.select(message)
    expect(selection.citationOrdinal.value).toBe(8)
    const revision = selection.selectionRevision.value
    selection.select(message, 8)
    expect(selection.citationOrdinal.value).toBe(8)
    expect(selection.selectionRevision.value).toBe(revision + 1)
  })
  it('separates each answer, handles manual collapse, and retains pinning as a new reply arrives', async () => {
    const messages = ref([answer('first', [1, 2]), answer('second', [1, 3])])
    const selection = useDemoSelection(() => messages.value)
    const first = messages.value[0]!
    selection.select(first, 2)
    selection.select(messages.value[1]!)
    expect(selection.citationOrdinal.value).toBe(1)
    selection.select(first)
    expect(selection.citationOrdinal.value).toBe(2)
    selection.toggleSource(2)
    expect(selection.citationOrdinal.value).toBeNull()
    selection.select(first, 2)
    first.id = 'server-replaced-id'
    messages.value.push(answer('third', [1]))
    await nextTick()
    expect(selection.selected.value).toBe(first)
    expect(selection.citationOrdinal.value).toBe(2)
    selection.select(first)
    expect(selection.citationOrdinal.value).toBe(2)
  })
  it('does not invent sources for empty/tool-only answers or unknown ordinals, and clears memory on reset', () => {
    const message = answer('first', [1, 2])
    const selection = useDemoSelection(() => [message])
    selection.select(message, 99)
    expect(selection.citationOrdinal.value).toBeNull()
    selection.select(answer('empty', []))
    expect(selection.citationOrdinal.value).toBeNull()
    selection.select(message, 2)
    selection.reset()
    selection.select(message)
    expect(selection.citationOrdinal.value).toBe(1)
  })
})
