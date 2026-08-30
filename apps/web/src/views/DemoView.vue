<script setup lang="ts">
import {
  ArrowUp,
  BookOpenCheck,
  CheckCircle2,
  CircleDashed,
  Headphones,
  LoaderCircle,
  RotateCcw,
  ShieldAlert,
  ShoppingBag,
  ThumbsDown,
  ThumbsUp,
  Wrench,
} from 'lucide-vue-next'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Locale, PublicProduct } from '@grounddesk/shared'

import { useChatStore } from '../stores/chat'
import { useShowcaseStore } from '../stores/showcase'

const { locale, t } = useI18n()
const chatStore = useChatStore()
const showcaseStore = useShowcaseStore()
const draft = ref('')
const transcript = ref<HTMLElement | null>(null)
const examples = computed(() => [
  t('playground.examples.compatibility'),
  t('playground.examples.warranty'),
  t('playground.examples.order'),
  t('playground.examples.unknown'),
])

const productName = (product: PublicProduct): string =>
  locale.value === 'zh-CN' ? product.nameZh : product.nameEn
const productDescription = (product: PublicProduct): string =>
  locale.value === 'zh-CN' ? product.descriptionZh : product.descriptionEn
const productVisualId = (model: string): string =>
  ({
    'Airwave S1': 'airwave-s1',
    'Airwave S1 Pro': 'airwave-s1-pro',
    'Orbit H5': 'orbit-h5',
    'Flux 67': 'flux-67',
    'Flux 100': 'flux-100',
    'LinkCore C240': 'linkcore-c240',
    'Reserve 10K': 'reserve-10k',
    'Dockline 6': 'dockline-6',
  })[model] ?? 'airwave-s1'
const price = (product: PublicProduct): string =>
  new Intl.NumberFormat(locale.value, {
    style: 'currency',
    currency: product.currency,
    maximumFractionDigits: 0,
  }).format(product.priceCents / 100)

watch(
  () => chatStore.messages.map((message) => message.content).join(''),
  async () => {
    await nextTick()
    transcript.value?.scrollTo({ top: transcript.value.scrollHeight, behavior: 'smooth' })
  },
)

const send = async (example?: string): Promise<void> => {
  const content = example ?? draft.value
  if (!content.trim()) return
  draft.value = ''
  await chatStore.sendMessage(content, locale.value as Locale)
}

onMounted(() => void showcaseStore.load())
</script>

<template>
  <main class="demo-page">
    <section class="demo-banner">
      <span>AVENLO · {{ t('demo.simulated') }}</span>
      <p>{{ t('demo.privacy') }}</p>
    </section>

    <section class="demo-storefront">
      <header class="demo-storefront__header">
        <div class="demo-brand"><span>A</span><strong>AVENLO</strong></div>
        <nav :aria-label="t('demo.storeNavigation')">
          <a href="#products">{{ t('demo.products') }}</a>
          <a href="#support">{{ t('demo.support') }}</a>
        </nav>
        <ShoppingBag :size="18" />
      </header>

      <div class="demo-hero">
        <div>
          <p>DESIGNED FOR THE DEVICES BETWEEN DEVICES</p>
          <h1>{{ t('demo.title') }}</h1>
          <span>{{ t('demo.description') }}</span>
        </div>
        <div class="demo-hero__object" aria-hidden="true">
          <svg viewBox="0 0 320 240"><use href="/products.svg#dockline-6" /></svg>
        </div>
      </div>

      <div class="demo-layout">
        <section id="products" class="demo-products" :aria-busy="showcaseStore.isLoading">
          <div class="demo-section-heading">
            <div>
              <p>AVENLO / 2026</p>
              <h2>{{ t('demo.collection') }}</h2>
            </div>
            <span>{{ showcaseStore.products.length }} {{ t('demo.items') }}</span>
          </div>
          <p v-if="showcaseStore.error" class="demo-state">
            <ShieldAlert :size="17" />{{ t('demo.loadError') }}
          </p>
          <p v-else-if="showcaseStore.isLoading" class="demo-state">
            <LoaderCircle class="spin" :size="17" />{{ t('demo.loading') }}
          </p>
          <p v-else-if="showcaseStore.products.length === 0" class="demo-state">
            {{ t('demo.empty') }}
          </p>
          <div v-else class="demo-product-grid">
            <article v-for="product in showcaseStore.products" :key="product.id">
              <div>
                <span>{{ product.category }}</span>
                <svg viewBox="0 0 320 240" role="img" :aria-label="productName(product)">
                  <use :href="`/products.svg#${productVisualId(product.model)}`" />
                </svg>
              </div>
              <h3>{{ productName(product) }}</h3>
              <p>{{ productDescription(product) }}</p>
              <footer>
                <span>{{ product.model }}</span
                ><strong>{{ price(product) }}</strong>
              </footer>
            </article>
          </div>
        </section>

        <aside id="support" class="demo-chat" aria-labelledby="demo-chat-title">
          <header>
            <div>
              <span><Headphones :size="16" /></span>
              <div>
                <h2 id="demo-chat-title">Avenlo Support</h2>
                <p><i></i>{{ t('demo.chat.online') }}</p>
              </div>
            </div>
            <button
              type="button"
              :aria-label="t('playground.newConversation')"
              @click="chatStore.resetConversation"
            >
              <RotateCcw :size="15" />
            </button>
          </header>

          <div class="demo-credentials">
            <strong>{{ t('demo.chat.tryOrder') }}</strong>
            <code>GD-2026D019</code>
            <code>demo.customer19@example.com</code>
          </div>

          <div ref="transcript" class="demo-chat__transcript" aria-live="polite">
            <div v-if="!chatStore.hasMessages" class="demo-chat__welcome">
              <BookOpenCheck :size="20" />
              <h3>{{ t('demo.chat.welcome') }}</h3>
              <p>{{ t('demo.chat.welcomeDescription') }}</p>
              <button
                v-for="example in examples"
                :key="example"
                type="button"
                :disabled="chatStore.isStreaming"
                @click="send(example)"
              >
                {{ example }}
              </button>
            </div>

            <article
              v-for="message in chatStore.messages"
              v-else
              :key="message.id"
              class="demo-message"
              :data-role="message.role"
              :data-handoff="message.handedOff"
            >
              <details
                v-if="message.role === 'assistant' && message.stages.length"
                :open="message.streaming"
              >
                <summary>{{ t('playground.trace') }}</summary>
                <ol>
                  <li
                    v-for="stage in message.stages"
                    :key="stage.stage"
                    :data-status="stage.status"
                  >
                    <CheckCircle2 v-if="stage.status === 'completed'" :size="12" /><ShieldAlert
                      v-else-if="stage.status === 'failed'"
                      :size="12"
                    /><CircleDashed v-else :size="12" />{{ t(`playground.stage.${stage.stage}`) }}
                  </li>
                </ol>
              </details>
              <div
                v-for="tool in message.tools"
                :key="`${tool.toolName}-${tool.status}`"
                class="demo-tool"
              >
                <Wrench :size="13" /><span
                  ><strong>{{ t(`playground.tool.${tool.toolName}`) }}</strong
                  ><small>{{ tool.summary }}</small></span
                >
              </div>
              <p>{{ message.content || t('playground.waiting') }}</p>
              <div v-if="message.citations.length" class="demo-citations">
                <details v-for="citation in message.citations" :key="citation.chunkId">
                  <summary>[{{ citation.ordinal }}] {{ citation.documentTitle }}</summary>
                  <blockquote>{{ citation.quote }}</blockquote>
                </details>
              </div>
              <div
                v-if="message.role === 'assistant' && !message.streaming"
                class="answer-feedback"
              >
                <span>{{ t('playground.feedbackQuestion') }}</span>
                <button
                  type="button"
                  :class="{ active: message.feedback === 'helpful' }"
                  :aria-label="t('playground.helpful')"
                  @click="chatStore.submitFeedback(message, 'helpful')"
                >
                  <ThumbsUp :size="12" />
                </button>
                <button
                  type="button"
                  :class="{ active: message.feedback === 'unhelpful' }"
                  :aria-label="t('playground.unhelpful')"
                  @click="chatStore.submitFeedback(message, 'unhelpful')"
                >
                  <ThumbsDown :size="12" />
                </button>
              </div>
            </article>
          </div>

          <form class="demo-chat__composer" @submit.prevent="send()">
            <label class="visually-hidden" for="demo-message">{{
              t('playground.inputLabel')
            }}</label>
            <textarea
              id="demo-message"
              v-model="draft"
              rows="2"
              :disabled="chatStore.isStreaming"
              :placeholder="t('demo.chat.placeholder')"
              @keydown.ctrl.enter.prevent="send()"
            ></textarea>
            <button
              type="submit"
              :disabled="chatStore.isStreaming || !draft.trim()"
              :aria-label="t('playground.send')"
            >
              <ArrowUp :size="17" />
            </button>
          </form>
          <p v-if="chatStore.error" class="demo-chat__error" role="alert">{{ chatStore.error }}</p>
          <footer>{{ t('demo.chat.footer') }}</footer>
        </aside>
      </div>
    </section>
  </main>
</template>
