<script setup lang="ts">
import {
  ArrowUpRight,
  BookOpenCheck,
  Cable,
  Headphones,
  PackageCheck,
  TicketCheck,
} from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const emit = defineEmits<{ select: [question: string] }>()
const { t } = useI18n()
const scenarios = computed(() => [
  {
    key: 'product',
    icon: Cable,
    caption: t('presentation.demo.productCaption'),
    label: t('demo.scenarios.productTitle'),
    question: t('playground.examples.warranty'),
  },
  {
    key: 'citation',
    icon: Headphones,
    caption: t('presentation.demo.compatibilityCaption'),
    label: t('demo.scenarios.citationTitle'),
    question: t('playground.examples.compatibility'),
  },
  {
    key: 'unknown',
    icon: TicketCheck,
    caption: t('presentation.demo.unknownCaption'),
    label: t('demo.scenarios.unknownTitle'),
    question: t('playground.examples.unknown'),
  },
  {
    key: 'order',
    icon: PackageCheck,
    caption: t('presentation.demo.orderCaption'),
    label: t('demo.order.title'),
    question: t('playground.examples.order'),
  },
])
</script>

<template>
  <section class="demo-chat__welcome">
    <div class="demo-welcome-eyebrow">
      <span class="demo-chat__welcome-mark"><BookOpenCheck :size="18" /></span>
      <p class="demo-chat__welcome-kicker">{{ t('demo.experience.welcomeKicker') }}</p>
    </div>
    <div class="demo-welcome-heading">
      <div>
        <h3>{{ t('presentation.demo.welcome') }}</h3>
        <p>{{ t('presentation.demo.welcomeLead') }}</p>
      </div>
      <figure>
        <svg
          viewBox="0 0 320 240"
          role="img"
          :aria-label="`LinkCore C240 · ${t('presentation.demo.illustration')}`"
        >
          <use href="/products.svg#linkcore-c240" />
        </svg>
        <figcaption>{{ t('presentation.demo.illustration') }}</figcaption>
      </figure>
    </div>
    <div class="demo-scenario-list">
      <button
        v-for="scenario in scenarios"
        :key="scenario.key"
        type="button"
        :aria-label="scenario.label"
        @click="emit('select', scenario.question)"
      >
        <component :is="scenario.icon" :size="20" :stroke-width="1.6" /><span
          ><strong>{{ scenario.label }}</strong
          ><small>{{ scenario.caption }}</small></span
        ><ArrowUpRight :size="15" />
      </button>
    </div>
    <small>{{ t('demo.experience.fillOnly') }}</small>
  </section>
</template>
