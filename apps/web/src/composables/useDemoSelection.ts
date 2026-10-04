import { computed, ref, shallowRef, watch } from 'vue'

import type { ChatMessageView } from '../stores/chat'

export const useDemoSelection = (messages: () => ChatMessageView[]) => {
  const pinned = ref(false)
  const selected = shallowRef<ChatMessageView | null>(null)
  const citationOrdinal = ref<number | null>(null)
  const selectionRevision = ref(0)
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
    selected.value = message
    citationOrdinal.value = ordinal
    selectionRevision.value += 1
    pinned.value = true
  }
  const reset = (): void => {
    selected.value = null
    citationOrdinal.value = null
    pinned.value = false
  }
  return { selected, question, answerNumber, citationOrdinal, selectionRevision, select, reset }
}
