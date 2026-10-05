<script setup lang="ts">
import {
  ArrowUpRight,
  BookOpenCheck,
  Check,
  ChevronRight,
  PackageCheck,
  TicketCheck,
} from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useViewportEntrance } from '../composables/useViewportEntrance'

const { t } = useI18n()
const scene = ref<'product' | 'order' | 'handoff'>('product')
const options = ['product', 'order', 'handoff'] as const
const stage = ref<HTMLElement | null>(null)
const { entered } = useViewportEntrance(stage)
const replay = ref(0)
const motion = ref<'entrance' | 'replay'>('entrance')
const sceneIndex = computed(() => options.indexOf(scene.value))
const question = computed(() =>
  t(`presentation.${scene.value}Question`, { email: 'demo.customer19@example.com' }),
)
const icon = computed(() =>
  scene.value === 'product' ? BookOpenCheck : scene.value === 'order' ? PackageCheck : TicketCheck,
)
const selectScene = (option: typeof scene.value): void => {
  motion.value = 'replay'
  scene.value = option
  replay.value++
}
const onTabKey = (event: KeyboardEvent): void => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const index = options.indexOf(scene.value)
  selectScene(
    options[
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? 2
          : (index + (event.key === 'ArrowRight' ? 1 : 2)) % 3
    ]!,
  )
  document.getElementById(`preview-${scene.value}`)?.focus()
}
</script>

<template>
  <section
    ref="stage"
    class="support-preview"
    :class="{ 'has-entered': entered }"
    :data-motion="motion"
    :aria-label="t('landing.preview.ariaLabel')"
  >
    <header class="support-preview__header">
      <div>
        <span>AVENLO SUPPORT</span>
        <h2>{{ t('presentation.stageTitle') }}</h2>
      </div>
      <span class="preview-example">{{ t('presentation.example') }}</span>
    </header>
    <div
      class="preview-tabs"
      role="tablist"
      :aria-label="t('presentation.scenarios')"
      @keydown="onTabKey"
    >
      <span
        class="preview-tab-indicator"
        :style="{ transform: `translateX(${sceneIndex * 100}%)` }"
        aria-hidden="true"
      ></span>
      <button
        v-for="(option, index) in options"
        :id="`preview-${option}`"
        :key="option"
        type="button"
        role="tab"
        :aria-selected="scene === option"
        :tabindex="scene === option ? 0 : -1"
        aria-controls="preview-scene"
        @click="selectScene(option)"
      >
        <small aria-hidden="true">0{{ index + 1 }}</small
        >{{ t(`presentation.${option}`) }}
      </button>
    </div>
    <div
      id="preview-scene"
      :key="`${scene}-${replay}`"
      class="preview-scene"
      role="tabpanel"
      :aria-labelledby="`preview-${scene}`"
      :data-scene="scene"
    >
      <div class="preview-question-row">
        <div class="preview-object" aria-hidden="true">
          <svg v-if="scene !== 'handoff'" viewBox="0 0 320 240">
            <use :href="`/products.svg#${scene === 'product' ? 'linkcore-c240' : 'orbit-h5'}`" />
          </svg>
          <TicketCheck v-else :size="68" :stroke-width="1" />
          <span>{{
            scene === 'product'
              ? 'LINKCORE C240'
              : scene === 'order'
                ? 'GD-2026D019'
                : 'HUMAN REVIEW'
          }}</span>
        </div>
        <div class="preview-question">
          <small>{{ t('presentation.question') }}</small>
          <p>{{ question }}</p>
        </div>
      </div>
      <div class="preview-response">
        <span
          ><component :is="icon" :size="16" />{{ t('presentation.outcome')
          }}<b>{{
            scene === 'product' ? t('presentation.source') : t('presentation.nextStep')
          }}</b></span
        >
        <p>{{ t(`presentation.${scene}Answer`) }} <b v-if="scene === 'product'">[1]</b></p>
      </div>
      <details v-if="scene === 'product'" open class="preview-proof">
        <summary>
          <span class="preview-proof__number">[1]</span><BookOpenCheck :size="15" />{{
            t('presentation.productSource')
          }}<ChevronRight :size="14" />
        </summary>
        <blockquote>{{ t('presentation.productQuote') }}</blockquote>
      </details>
      <div v-else class="preview-proof preview-proof--summary">
        <strong
          ><Check :size="15" />{{
            t(`presentation.${scene === 'order' ? 'orderCheck' : 'handoffCheck'}`)
          }}</strong
        >
        <p>{{ t(`presentation.${scene === 'order' ? 'orderPreviewStatus' : 'handoffNext'}`) }}</p>
        <small>{{
          t(`presentation.${scene === 'order' ? 'orderPreviewNote' : 'handoffNote'}`)
        }}</small>
      </div>
    </div>
    <footer class="preview-footer">
      <p>{{ t('presentation.exampleNote') }}</p>
      <RouterLink :to="{ path: '/demo', query: { scenario: scene } }"
        >{{ t('presentation.tryScenario') }}<ArrowUpRight :size="17"
      /></RouterLink>
    </footer>
  </section>
</template>
