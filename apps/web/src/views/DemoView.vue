<script setup lang="ts">
import { ArrowLeft, ArrowUp, Headphones, RotateCcw, Sparkles } from 'lucide-vue-next'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { FeedbackRating, Locale } from '@grounddesk/shared'

import DemoChatMessage from '../components/DemoChatMessage.vue'
import DemoEvidencePanel from '../components/DemoEvidencePanel.vue'
import { type ChatMessageView, useChatStore } from '../stores/chat'
import { useShowcaseStore } from '../stores/showcase'

const { locale, t } = useI18n()
const chatStore = useChatStore()
const showcaseStore = useShowcaseStore()
const draft = ref('')
const transcript = ref<HTMLElement | null>(null)
const composer = ref<HTMLTextAreaElement | null>(null)
const selectedMessageId = ref<string | null>(null)

const scenarios = computed(() => [
  {
    key: 'product',
    label: t('demo.scenarios.productTitle'),
    description: t('demo.scenarios.productDescription'),
    question: t('playground.examples.warranty'),
  },
  {
    key: 'citation',
    label: t('demo.scenarios.citationTitle'),
    description: t('demo.scenarios.citationDescription'),
    question: t('playground.examples.compatibility'),
  },
  {
    key: 'unknown',
    label: t('demo.scenarios.unknownTitle'),
    description: t('demo.scenarios.unknownDescription'),
    question: t('playground.examples.unknown'),
  },
])

const latestAssistant = computed<ChatMessageView | null>(() => {
  for (let index = chatStore.messages.length - 1; index >= 0; index -= 1) {
    const message = chatStore.messages[index]
    if (message?.role === 'assistant') return message
  }
  return null
})

const selectedMessage = computed<ChatMessageView | null>(() => {
  if (selectedMessageId.value) {
    const selected = chatStore.messages.find(
      (message) => message.id === selectedMessageId.value && message.role === 'assistant',
    )
    if (selected) return selected
  }
  return latestAssistant.value
})

watch(
  () =>
    chatStore.messages
      .map(
        (message) =>
          `${message.id}:${message.content.length}:${message.citations.length}:${message.tools.length}:${message.handedOff}`,
      )
      .join('|'),
  async () => {
    const latest = latestAssistant.value
    if (latest && (latest.citations.length || latest.tools.length || latest.handedOff)) {
      selectedMessageId.value = latest.id
    }
    await nextTick()
    transcript.value?.scrollTo({ top: transcript.value.scrollHeight, behavior: 'smooth' })
  },
)

const selectQuestion = async (question: string): Promise<void> => {
  draft.value = question
  await nextTick()
  composer.value?.focus()
}

const send = async (): Promise<void> => {
  const content = draft.value.trim()
  if (!content) return
  draft.value = ''
  await chatStore.sendMessage(content, locale.value as Locale)
}

const resetConversation = async (): Promise<void> => {
  chatStore.resetConversation()
  selectedMessageId.value = null
  draft.value = ''
  await nextTick()
  composer.value?.focus()
}

const submitFeedback = (message: ChatMessageView, rating: FeedbackRating): void => {
  void chatStore.submitFeedback(message, rating)
}

onMounted(() => void showcaseStore.loadProducts())
</script>

<template>
  <main class="demo-page">
    <section class="demo-shell">
      <header class="demo-topbar">
        <RouterLink to="/" class="demo-topbar__back">
          <ArrowLeft :size="17" />{{ t('demo.back') }}
        </RouterLink>
        <div class="demo-topbar__brand">
          <span>A</span>
          <strong>AVENLO</strong>
          <small>{{ t('demo.simulated') }}</small>
        </div>
        <p>{{ t('demo.privacy') }}</p>
      </header>

      <div class="demo-intro">
        <div>
          <p><span></span>{{ t('demo.eyebrow') }}</p>
          <h1>{{ t('demo.title') }}</h1>
        </div>
        <p>{{ t('demo.description') }}</p>
      </div>

      <div class="demo-layout">
        <section id="support" class="demo-chat" aria-labelledby="demo-chat-title">
          <header class="demo-chat__header">
            <div>
              <span><Headphones :size="18" /></span>
              <div>
                <h2 id="demo-chat-title">Avenlo Support</h2>
                <p>
                  <i :class="{ 'is-busy': chatStore.isStreaming }"></i>
                  {{ chatStore.isStreaming ? t('demo.chat.processing') : t('demo.chat.ready') }}
                </p>
              </div>
            </div>
            <button
              type="button"
              :aria-label="t('playground.newConversation')"
              @click="resetConversation"
            >
              <RotateCcw :size="16" />
            </button>
          </header>

          <div ref="transcript" class="demo-chat__transcript" aria-live="polite">
            <section v-if="!chatStore.hasMessages" class="demo-chat__welcome">
              <span><Sparkles :size="18" /></span>
              <div>
                <h3>{{ t('demo.chat.welcome') }}</h3>
                <p>{{ t('demo.chat.welcomeDescription') }}</p>
              </div>
              <div class="demo-scenario-list">
                <button
                  v-for="(scenario, index) in scenarios"
                  :key="scenario.key"
                  type="button"
                  :disabled="chatStore.isStreaming"
                  @click="selectQuestion(scenario.question)"
                >
                  <span>0{{ index + 1 }}</span>
                  <strong>{{ scenario.label }}</strong>
                  <small>{{ scenario.description }}</small>
                </button>
              </div>
            </section>

            <DemoChatMessage
              v-for="message in chatStore.messages"
              :key="message.id"
              :message="message"
              :is-selected="selectedMessage?.id === message.id"
              @feedback="submitFeedback"
              @select="selectedMessageId = $event.id"
            />
          </div>

          <form class="demo-chat__composer" @submit.prevent="send">
            <label class="visually-hidden" for="demo-message">{{
              t('playground.inputLabel')
            }}</label>
            <textarea
              id="demo-message"
              ref="composer"
              v-model="draft"
              rows="3"
              :disabled="chatStore.isStreaming"
              :placeholder="t('demo.chat.placeholder')"
              @keydown.ctrl.enter.prevent="send"
            ></textarea>
            <div>
              <span>{{ t('demo.chat.sendHint') }}</span>
              <button
                type="submit"
                :disabled="chatStore.isStreaming || !draft.trim()"
                :aria-label="t('playground.send')"
              >
                <ArrowUp :size="18" />
              </button>
            </div>
          </form>

          <div v-if="chatStore.error" class="demo-chat__error" role="alert">
            <strong>{{ t('demo.chat.errorTitle') }}</strong>
            <span>{{ chatStore.error }}</span>
          </div>
          <footer>{{ t('demo.chat.footer') }}</footer>
        </section>

        <DemoEvidencePanel
          :is-loading="showcaseStore.isProductsLoading"
          :message="selectedMessage"
          :product-error="showcaseStore.productError"
          :products="showcaseStore.products"
          @retry-products="showcaseStore.loadProducts(true)"
          @select-order="selectQuestion(t('playground.examples.order'))"
        />
      </div>
    </section>
  </main>
</template>
