<script setup lang="ts">
import {
  BookOpenCheck,
  Box,
  ChevronRight,
  LoaderCircle,
  RotateCcw,
  TicketCheck,
  Wrench,
} from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { PublicProduct } from '@grounddesk/shared'

import type { ChatMessageView } from '../stores/chat'

const props = defineProps<{
  isLoading: boolean
  message: ChatMessageView | null
  productError: string | null
  products: PublicProduct[]
}>()

const emit = defineEmits<{
  retryProducts: []
  selectOrder: []
}>()

const { locale, t } = useI18n()
const citations = computed(() => props.message?.citations ?? [])
const tools = computed(() => props.message?.tools ?? [])
const productName = (product: PublicProduct): string =>
  locale.value === 'zh-CN' ? product.nameZh : product.nameEn
</script>

<template>
  <aside class="demo-evidence" :aria-label="t('demo.sources.panelLabel')">
    <section class="demo-evidence__sources">
      <header>
        <span><BookOpenCheck :size="18" /></span>
        <div>
          <h2>{{ t('demo.sources.title') }}</h2>
          <p>{{ t('demo.sources.description') }}</p>
        </div>
      </header>

      <div v-if="citations.length" class="demo-evidence__list">
        <details v-for="citation in citations" :key="citation.chunkId">
          <summary>
            <span>[{{ citation.ordinal }}]</span>
            <strong>{{ citation.documentTitle }}</strong>
            <ChevronRight :size="15" />
          </summary>
          <blockquote>{{ citation.quote }}</blockquote>
        </details>
      </div>
      <div v-else class="demo-evidence__empty">
        <strong>{{ t('demo.sources.emptyTitle') }}</strong>
        <p>{{ t('demo.sources.emptyDescription') }}</p>
      </div>

      <div v-if="tools.length" class="demo-evidence__tools">
        <h3><Wrench :size="15" />{{ t('demo.sources.toolsTitle') }}</h3>
        <article v-for="tool in tools" :key="`${tool.toolName}-${tool.status}`">
          <strong>{{ t(`playground.tool.${tool.toolName}`) }}</strong>
          <span>{{ tool.summary }}</span>
        </article>
      </div>

      <div v-if="message?.handedOff" class="demo-evidence__handoff">
        <TicketCheck :size="18" />
        <span>
          <strong>{{ t('demo.sources.handoffTitle') }}</strong>
          <small>{{ t('demo.sources.handoffDescription') }}</small>
        </span>
      </div>
    </section>

    <section class="demo-order-context">
      <header>
        <span>{{ t('demo.order.kicker') }}</span>
        <strong>{{ t('demo.order.title') }}</strong>
      </header>
      <p>{{ t('demo.order.description') }}</p>
      <code>GD-2026D019</code>
      <code>demo.customer19@example.com</code>
      <button type="button" @click="emit('selectOrder')">
        {{ t('demo.order.fill') }}<ChevronRight :size="15" />
      </button>
    </section>

    <details class="demo-product-context">
      <summary>
        <span><Box :size="17" />{{ t('demo.productsPanel.title') }}</span>
        <small>{{ t('demo.productsPanel.count', { count: products.length }) }}</small>
      </summary>
      <p>{{ t('demo.productsPanel.description') }}</p>
      <div v-if="isLoading" class="demo-product-context__state" role="status">
        <LoaderCircle class="spin" :size="16" />{{ t('demo.loading') }}
      </div>
      <div v-else-if="productError" class="demo-product-context__state is-error" role="alert">
        <span>{{ t('demo.loadError') }}</span>
        <button type="button" @click="emit('retryProducts')">
          <RotateCcw :size="14" />{{ t('common.retry') }}
        </button>
      </div>
      <ul v-else-if="products.length">
        <li v-for="product in products" :key="product.id">
          <span>{{ product.model }}</span>
          <strong>{{ productName(product) }}</strong>
        </li>
      </ul>
      <p v-else>{{ t('demo.empty') }}</p>
    </details>
  </aside>
</template>
