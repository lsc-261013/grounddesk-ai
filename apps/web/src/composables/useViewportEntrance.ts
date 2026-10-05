import { onMounted, onUnmounted, ref, type Ref } from 'vue'

export const useViewportEntrance = (element: Ref<HTMLElement | null>) => {
  const entered = ref(false)
  const inView = ref(true)
  let observer: IntersectionObserver | undefined
  onMounted(() => {
    if (!element.value || typeof IntersectionObserver === 'undefined') {
      entered.value = true
      return
    }
    try {
      observer = new IntersectionObserver(
        ([entry]) => {
          inView.value = Boolean(entry?.isIntersecting)
          if (inView.value) entered.value = true
        },
        { threshold: 0.12 },
      )
      observer.observe(element.value)
    } catch {
      // Visibility must not depend on a working observer.
      entered.value = true
    }
  })
  onUnmounted(() => observer?.disconnect())
  return { entered, inView }
}
