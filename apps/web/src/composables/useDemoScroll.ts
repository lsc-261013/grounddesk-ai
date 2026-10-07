import { nextTick, ref, watch, type Ref } from 'vue'

export const useDemoScroll = (element: Ref<HTMLElement | null>, signature: () => string) => {
  const nearBottom = ref(true)
  const hasNewContent = ref(false)
  const onScroll = (): void => {
    const node = element.value
    if (!node || !node.clientHeight) return
    nearBottom.value = node.scrollHeight - node.scrollTop - node.clientHeight < 72
    if (nearBottom.value) hasNewContent.value = false
  }
  const toBottom = async (): Promise<void> => {
    nearBottom.value = true
    hasNewContent.value = false
    await nextTick()
    element.value?.scrollTo({ top: element.value.scrollHeight, behavior: 'instant' })
  }
  watch(signature, async () => {
    if (nearBottom.value) await toBottom()
    else hasNewContent.value = true
  })
  return { hasNewContent, onScroll, toBottom }
}
