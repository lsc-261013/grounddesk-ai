import { onMounted, onUnmounted, ref, type Ref } from 'vue'

export const useViewportEntrance = (element: Ref<HTMLElement | null>) => {
  const entered = ref(false)
  const inView = ref(true)
  let observer: IntersectionObserver | undefined
  onMounted(() => {
    if (!element.value || typeof IntersectionObserver === 'undefined') return
    observer = new IntersectionObserver(
      ([entry]) => {
        inView.value = Boolean(entry?.isIntersecting)
        if (inView.value) entered.value = true
      },
      { threshold: 0.12 },
    )
    observer.observe(element.value)
  })
  onUnmounted(() => observer?.disconnect())
  return { entered, inView }
}
