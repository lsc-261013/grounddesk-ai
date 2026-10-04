<script setup lang="ts">
import { BookOpenCheck, Box, ChevronRight, RotateCcw, TicketCheck } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ChatCitation, PublicProduct } from '@grounddesk/shared'

import type { ChatMessageView } from '../stores/chat'
import DemoToolResult from './DemoToolResult.vue'

const props = defineProps<{
  isLoading: boolean
  message: ChatMessageView | null
  productError: string | null
  products: PublicProduct[]
  question?: string
  answerNumber?: number
  citationOrdinal?: number | null
  selectionRevision?: number
}>()
const emit = defineEmits<{ retryProducts: []; selectOrder: []; back: [] }>()
const { locale, t } = useI18n()
const citations = computed(() => props.message?.citations ?? [])
const sectionLabel = (citation: ChatCitation): string =>
  citation.sectionPath
    .filter((part) => part !== citation.documentTitle)
    .slice(-2)
    .join(' / ')
const openOrdinal = ref<number | null>(null)
watch(
  () => props.message,
  () => {
    openOrdinal.value = null
  },
)
watch(
  () => [props.message, props.citationOrdinal, props.selectionRevision] as const,
  ([, ordinal]) => {
    openOrdinal.value = ordinal ?? null
  },
)
const emptyState = computed(() =>
  !props.message
    ? 'initial'
    : props.message.failed
      ? 'failed'
      : props.message.streaming
        ? 'pending'
        : 'none',
)
const productName = (product: PublicProduct): string =>
  locale.value === 'zh-CN' ? product.nameZh : product.nameEn
</script>

<template>
  <aside class="demo-evidence" :aria-label="t('demo.sources.panelLabel')">
    <section class="demo-evidence__sources">
      <header>
        <BookOpenCheck :size="19" />
        <div>
          <h2 id="demo-evidence-title" tabindex="-1">{{ t('demo.sources.title') }}</h2>
          <p>{{ t('demo.experience.evidenceHint') }}</p>
        </div>
      </header>
      <button type="button" class="demo-mobile-back" @click="emit('back')">
        {{ t('demo.experience.backToChat') }}
      </button>
      <div v-if="message" class="demo-evidence__question">
        <span>{{ t('demo.experience.answerNumber', { number: answerNumber || 1 }) }}</span>
        <p>{{ question }}</p>
      </div>
      <div v-if="message?.handedOff && !message.failed" class="demo-evidence__handoff">
        <TicketCheck :size="19" />
        <div>
          <strong>{{ t('demo.sources.handoffTitle') }}</strong>
          <p>{{ t('demo.experience.handoffNotice') }}</p>
        </div>
      </div>
      <p v-else-if="message?.refused && !message.streaming" class="demo-evidence__unconfirmed">
        {{ t('demo.experience.handoffUnconfirmed') }}
      </p>
      <p v-if="message?.failed && citations.length" class="demo-message__notice">
        {{ t('demo.experience.evidenceState.failed.description') }}
      </p>
      <div v-if="citations.length" class="demo-evidence__list">
        <p class="demo-evidence__disclaimer">
          {{
            t(
              message?.refused
                ? 'demo.experience.checkedDisclaimer'
                : 'demo.experience.sourceDisclaimer',
            )
          }}
        </p>
        <details
          v-for="citation in citations"
          :key="`${message?.id}-${citation.chunkId}`"
          :data-source="citation.ordinal"
          :open="openOrdinal === citation.ordinal"
          :class="{ 'is-active': citationOrdinal === citation.ordinal }"
        >
          <summary
            @click.prevent="
              openOrdinal = openOrdinal === citation.ordinal ? null : citation.ordinal
            "
          >
            <span>[{{ citation.ordinal }}]</span>
            <div>
              <strong>{{ citation.documentTitle }}</strong
              ><small v-if="sectionLabel(citation)">{{ sectionLabel(citation) }}</small>
            </div>
            <ChevronRight :size="16" />
          </summary>
          <div class="demo-evidence__excerpt">
            <p v-if="citation.sectionPath.length">{{ citation.sectionPath.join(' / ') }}</p>
            <p v-if="citation.pageStart !== null">
              {{ t('demo.experience.page', { page: citation.pageStart })
              }}<template
                v-if="citation.pageEnd !== null && citation.pageEnd !== citation.pageStart"
                >–{{ citation.pageEnd }}</template
              >
            </p>
            <blockquote>{{ citation.quote }}</blockquote>
          </div>
        </details>
      </div>
      <div v-else class="demo-evidence__empty" :data-state="emptyState">
        <strong>{{ t(`demo.experience.evidenceState.${emptyState}.title`) }}</strong>
        <p>{{ t(`demo.experience.evidenceState.${emptyState}.description`) }}</p>
      </div>
      <div v-if="message?.tools.length" class="demo-evidence__tools">
        <h3>{{ t('demo.sources.toolsTitle') }}</h3>
        <DemoToolResult v-for="(tool, index) in message.tools" :key="index" :tool="tool" />
      </div>
    </section>
    <details class="demo-order-context">
      <summary>{{ t('demo.order.title') }}<ChevronRight :size="16" /></summary>
      <p>{{ t('demo.order.description') }}</p>
      <code>GD-2026D019</code><code>demo.customer19@example.com</code>
      <button type="button" @click="emit('selectOrder')">
        {{ t('demo.order.fill') }}<ChevronRight :size="15" />
      </button>
    </details>
    <details class="demo-product-context">
      <summary>
        <span><Box :size="17" />{{ t('demo.productsPanel.title') }}</span
        ><small>{{
          isLoading
            ? t('demo.experience.loadingShort')
            : productError
              ? t('demo.experience.unavailable')
              : t('demo.productsPanel.count', { count: products.length })
        }}</small>
      </summary>
      <p>{{ t('demo.productsPanel.description') }}</p>
      <div v-if="isLoading" class="demo-product-context__state" role="status">
        {{ t('demo.loading') }}
      </div>
      <div v-else-if="productError" class="demo-product-context__state is-error" role="alert">
        <span>{{ t('demo.loadError') }}</span
        ><button type="button" @click="emit('retryProducts')">
          <RotateCcw :size="14" />{{ t('common.retry') }}
        </button>
      </div>
      <ul v-else-if="products.length">
        <li v-for="product in products" :key="product.id">
          <span>{{ product.model }}</span
          ><strong>{{ productName(product) }}</strong>
        </li>
      </ul>
      <p v-else>{{ t('demo.empty') }}</p>
    </details>
  </aside>
</template>
