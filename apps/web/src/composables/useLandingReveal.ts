import { onMounted, onUnmounted, type Ref } from 'vue'

export const useLandingReveal = (element: Ref<HTMLElement | null>): void => {
  let observer: IntersectionObserver | undefined
  onMounted(() => {
    if (!element.value || typeof IntersectionObserver === 'undefined') return
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('is-revealed')
          // Reading back up must never hide or replay already revealed content.
          observer?.unobserve(entry.target)
        }
      },
      { threshold: 0.08 },
    )
    element.value
      .querySelectorAll('.landing-reveal')
      .forEach((section) => observer?.observe(section))
  })
  onUnmounted(() => observer?.disconnect())
}
