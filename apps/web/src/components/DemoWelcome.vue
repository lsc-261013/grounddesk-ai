<script setup lang="ts">
import { ArrowUp, Sparkles } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const emit = defineEmits<{ select: [question: string] }>()
const { t } = useI18n()
const scenarios = computed(() => [
  {
    key: 'product',
    label: t('demo.scenarios.productTitle'),
    question: t('playground.examples.warranty'),
  },
  {
    key: 'citation',
    label: t('demo.scenarios.citationTitle'),
    question: t('playground.examples.compatibility'),
  },
  {
    key: 'unknown',
    label: t('demo.scenarios.unknownTitle'),
    question: t('playground.examples.unknown'),
  },
  { key: 'order', label: t('demo.order.title'), question: t('playground.examples.order') },
])
</script>

<template>
  <section class="demo-chat__welcome">
    <div class="demo-chat__welcome-mark"><Sparkles :size="21" /></div>
    <p class="demo-chat__welcome-kicker">{{ t('demo.experience.welcomeKicker') }}</p>
    <h3>{{ t('demo.chat.welcome') }}</h3>
    <p>{{ t('demo.chat.welcomeDescription') }}</p>
    <div class="demo-scenario-list">
      <button
        v-for="scenario in scenarios"
        :key="scenario.key"
        type="button"
        @click="emit('select', scenario.question)"
      >
        <span>{{ scenario.label }}</span
        ><ArrowUp :size="14" />
      </button>
    </div>
    <small>{{ t('demo.experience.fillOnly') }}</small>
  </section>
</template>
