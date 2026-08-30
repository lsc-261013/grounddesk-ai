<script setup lang="ts">
import { FileText, Search, ShieldCheck, TicketCheck } from 'lucide-vue-next'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const root = ref<HTMLElement | null>(null)
const isVisible = ref(false)
let observer: IntersectionObserver | null = null

onMounted(() => {
  if (!root.value || typeof IntersectionObserver === 'undefined') {
    isVisible.value = true
    return
  }
  observer = new IntersectionObserver(
    ([entry]) => {
      isVisible.value = Boolean(entry?.isIntersecting)
    },
    { threshold: 0.25 },
  )
  observer.observe(root.value)
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div
    ref="root"
    class="trust-flow"
    :class="{ 'is-running': isVisible }"
    :aria-label="t('landing.flow.ariaLabel')"
  >
    <div class="trust-flow__topline">
      <span><i></i>{{ t('landing.flow.live') }}</span>
      <span>RAG / TOOL / HANDOFF</span>
    </div>

    <div class="flow-stage">
      <div class="flow-document">
        <FileText :size="16" />
        <span>
          <strong>returns-policy-v3.md</strong>
          <small>{{ t('landing.flow.policySource') }}</small>
        </span>
      </div>

      <div class="flow-chunks" aria-hidden="true">
        <span>CHUNK 01</span><span class="relevant">CHUNK 02</span><span>CHUNK 03</span>
      </div>

      <div class="flow-query flow-query--grounded">
        <Search :size="14" />
        <span>{{ t('landing.flow.knownQuestion') }}</span>
      </div>

      <svg class="flow-link" viewBox="0 0 250 80" aria-hidden="true">
        <path d="M8 66 C78 66 90 12 242 12" />
      </svg>

      <div class="flow-answer">
        <ShieldCheck :size="16" />
        <p>{{ t('landing.flow.knownAnswer') }} <b>[1]</b></p>
      </div>

      <div class="flow-query flow-query--unknown">
        <Search :size="14" />
        <span>{{ t('landing.flow.unknownQuestion') }}</span>
      </div>

      <div class="flow-insufficient">
        <span>{{ t('landing.flow.insufficient') }}</span>
        <i></i>
      </div>

      <div class="flow-ticket">
        <TicketCheck :size="16" />
        <span>
          <strong>{{ t('landing.flow.ticketCreated') }}</strong>
          <small>{{ t('landing.flow.contextAttached') }}</small>
        </span>
      </div>
    </div>

    <p class="trust-flow__caption">{{ t('landing.flow.caption') }}</p>
  </div>
</template>
