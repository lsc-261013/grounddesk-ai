import { computed, ref, shallowRef, watch } from 'vue'

import type { ChatMessageView } from '../stores/chat'

export const useDemoSelection = (messages: () => ChatMessageView[]) => {
  const pinned = ref(false)
  const selected = shallowRef<ChatMessageView | null>(null)
  const citationOrdinal = ref<number | null>(null)
  const selectionRevision = ref(0)
  // Message IDs change when streaming completes; object identity keeps ownership stable.
  let openedSources = new WeakMap<ChatMessageView, number | null>()
  const latest = computed(
    () => [...messages()].reverse().find((item) => item.role === 'assistant') ?? null,
  )

  watch(
    latest,
    (message) => {
      if (!pinned.value || !selected.value || !messages().includes(selected.value)) {
        selected.value = message
        citationOrdinal.value = null
        pinned.value = false
      }
    },
    { immediate: true },
  )

  const question = computed(() => {
    const index = selected.value ? messages().indexOf(selected.value) : -1
    return index > 0 ? (messages()[index - 1]?.content ?? '') : ''
  })
  const answerNumber = computed(() => {
    const answers = messages().filter((item) => item.role === 'assistant')
    return selected.value ? answers.indexOf(selected.value) + 1 : 0
  })
  const select = (message: ChatMessageView, ordinal: number | null = null): void => {
    const valid = message.citations.filter(
      (citation) => citation.ordinal > 0 && citation.quote.trim(),
    )
    const remembered = openedSources.get(message)
    selected.value = message
    citationOrdinal.value =
      ordinal !== null
        ? (valid.find((citation) => citation.ordinal === ordinal)?.ordinal ?? null)
        : (valid.find((citation) => citation.ordinal === remembered)?.ordinal ??
          valid[0]?.ordinal ??
          null)
    openedSources.set(message, citationOrdinal.value)
    selectionRevision.value += 1
    pinned.value = true
  }
  const toggleSource = (ordinal: number): void => {
    const message = selected.value
    if (!message?.citations.some((citation) => citation.ordinal === ordinal)) return
    citationOrdinal.value = citationOrdinal.value === ordinal ? null : ordinal
    openedSources.set(message, citationOrdinal.value)
    pinned.value = true
  }
  const reset = (): void => {
    selected.value = null
    citationOrdinal.value = null
    pinned.value = false
    openedSources = new WeakMap()
  }
  return {
    selected,
    question,
    answerNumber,
    citationOrdinal,
    selectionRevision,
    select,
    toggleSource,
    reset,
  }
}
