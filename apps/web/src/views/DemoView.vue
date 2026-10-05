<script setup lang="ts">
import { ArrowDown, ArrowLeft, ArrowUp, Headphones, RotateCcw } from 'lucide-vue-next'
import { computed, nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import type { FeedbackRating, Locale } from '@grounddesk/shared'

import DemoChatMessage from '../components/DemoChatMessage.vue'
import DemoWelcome from '../components/DemoWelcome.vue'
import DemoEvidencePanel from '../components/DemoEvidencePanel.vue'
import { useDemoScroll } from '../composables/useDemoScroll'
import { useDemoSelection } from '../composables/useDemoSelection'
import { type ChatMessageView, useChatStore } from '../stores/chat'
import { useShowcaseStore } from '../stores/showcase'

const { locale, t } = useI18n()
const route = useRoute()
const chatStore = useChatStore()
const showcaseStore = useShowcaseStore()
const draft = ref('')
const composing = ref(false)
const transcript = ref<HTMLElement | null>(null)
const composer = ref<HTMLTextAreaElement | null>(null)
const activeView = ref<'chat' | 'evidence'>('chat')
const returnFocus = ref<HTMLElement | null>(null)
const evidencePanel = ref<HTMLElement | null>(null)
const {
  selected,
  question,
  answerNumber,
  citationOrdinal,
  selectionRevision,
  select,
  toggleSource,
  reset,
} = useDemoSelection(() => chatStore.messages)
const { hasNewContent, onScroll, toBottom } = useDemoScroll(transcript, () =>
  chatStore.messages
    .map(
      (message) =>
        `${message.content.length}:${message.citations.length}:${message.tools.length}:${message.streaming}:${message.failed}`,
    )
    .join('|'),
)
const numberedMessages = computed(() => {
  let number = 0
  return chatStore.messages.map((message) => ({
    message,
    number: message.role === 'assistant' ? ++number : 0,
  }))
})
const selectQuestion = async (value: string): Promise<void> => {
  draft.value = value
  activeView.value = 'chat'
  await nextTick()
  composer.value?.focus()
}
const selectEvidence = async (message: ChatMessageView, ordinal?: number): Promise<void> => {
  returnFocus.value = document.activeElement instanceof HTMLElement ? document.activeElement : null
  select(message, ordinal ?? null)
  const revision = selectionRevision.value
  activeView.value = 'evidence'
  await nextTick()
  if (revision !== selectionRevision.value) return
  const target = citationOrdinal.value
    ? evidencePanel.value?.querySelector<HTMLElement>(
        `[data-source="${citationOrdinal.value}"] summary`,
      )
    : document.getElementById('demo-evidence-title')
  target?.focus({ preventScroll: true })
  if (target && evidencePanel.value) {
    // Only the evidence pane should move; scrollIntoView also jumps the outer page.
    const pane = evidencePanel.value
    const targetBounds = target.getBoundingClientRect()
    const paneBounds = pane.getBoundingClientRect()
    // Include the start of the excerpt, not just its collapsed heading, in the readable area.
    const previewHeight = citationOrdinal.value ? 96 : 0
    if (
      targetBounds.top < paneBounds.top + 12 ||
      targetBounds.bottom + previewHeight > paneBounds.bottom - 12
    )
      pane.scrollTop += targetBounds.top - paneBounds.top - 12
  }
}
const backToChat = async (): Promise<void> => {
  activeView.value = 'chat'
  await nextTick()
  returnFocus.value?.focus({ preventScroll: true })
}
const send = async (): Promise<void> => {
  const content = draft.value.trim()
  if (!content || chatStore.isStreaming || composing.value) return
  draft.value = ''
  const operation = chatStore.sendMessage(content, locale.value as Locale)
  await toBottom()
  await operation
}
const onComposerKey = (event: KeyboardEvent): void => {
  if (
    event.key !== 'Enter' ||
    (!event.ctrlKey && !event.metaKey) ||
    event.isComposing ||
    composing.value
  )
    return
  event.preventDefault()
  void send()
}
const resetConversation = async (): Promise<void> => {
  if (chatStore.isStreaming) return
  chatStore.resetConversation()
  reset()
  activeView.value = 'chat'
  returnFocus.value = null
  draft.value = ''
  await toBottom()
  composer.value?.focus()
}
const recoverQuestion = (message: ChatMessageView): void => {
  const index = chatStore.messages.indexOf(message)
  const original = chatStore.messages[index - 1]
  if (original?.role === 'user') void selectQuestion(original.content)
}
const submitFeedback = (message: ChatMessageView, rating: FeedbackRating): void => {
  void chatStore.submitFeedback(message, rating)
}
const onTabKey = (event: KeyboardEvent): void => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  activeView.value =
    event.key === 'Home'
      ? 'chat'
      : event.key === 'End'
        ? 'evidence'
        : activeView.value === 'chat'
          ? 'evidence'
          : 'chat'
  document.getElementById(`demo-tab-${activeView.value}`)?.focus()
}
onMounted(() => {
  void showcaseStore.loadProducts()
  const scenario = route.query.scenario
  if (scenario === 'product' || scenario === 'order' || scenario === 'handoff') {
    // Route scenarios are draft suggestions, never automatic model requests.
    draft.value = t(`presentation.${scenario}Question`, { email: 'demo.customer19@example.com' })
  }
})
</script>

<template>
  <main class="demo-page">
    <section class="demo-shell">
      <header class="demo-topbar">
        <RouterLink to="/" class="demo-topbar__back"
          ><ArrowLeft :size="16" />{{ t('demo.back') }}</RouterLink
        >
        <div class="demo-topbar__brand">
          <span>A</span><strong>AVENLO</strong><small>{{ t('demo.experience.fictional') }}</small>
        </div>
        <p>{{ t('demo.privacy') }}</p>
      </header>
      <div class="demo-intro">
        <div>
          <p>{{ t('demo.eyebrow') }}</p>
          <h1>{{ t('presentation.demo.title') }}</h1>
        </div>
        <p>{{ t('presentation.demo.description') }}</p>
      </div>
      <div
        class="demo-mobile-tabs"
        role="tablist"
        :aria-label="t('demo.experience.tabsLabel')"
        @keydown="onTabKey"
      >
        <button
          id="demo-tab-chat"
          type="button"
          role="tab"
          aria-controls="demo-chat-panel"
          :aria-selected="activeView === 'chat'"
          :tabindex="activeView === 'chat' ? 0 : -1"
          @click="activeView = 'chat'"
        >
          {{ t('demo.experience.chatTab') }}
        </button>
        <button
          id="demo-tab-evidence"
          type="button"
          role="tab"
          aria-controls="demo-evidence-panel"
          :aria-selected="activeView === 'evidence'"
          :tabindex="activeView === 'evidence' ? 0 : -1"
          @click="activeView = 'evidence'"
        >
          {{ t('demo.experience.evidenceTab')
          }}<span v-if="selected?.citations.length">{{ selected.citations.length }}</span>
        </button>
      </div>
      <div class="demo-layout" :data-view="activeView">
        <section id="demo-chat-panel" class="demo-chat" aria-labelledby="demo-chat-title">
          <header class="demo-chat__header">
            <div>
              <span><Headphones :size="19" /></span>
              <div>
                <h2 id="demo-chat-title">Avenlo Support</h2>
                <p>
                  <i :class="{ 'is-busy': chatStore.isStreaming }"></i
                  >{{ chatStore.isStreaming ? t('demo.chat.processing') : t('demo.chat.ready') }}
                </p>
              </div>
            </div>
            <button
              type="button"
              :disabled="chatStore.isStreaming"
              :aria-label="t('playground.newConversation')"
              @click="resetConversation"
            >
              <RotateCcw :size="16" />
            </button>
          </header>
          <div class="demo-chat__body">
            <div
              ref="transcript"
              class="demo-chat__transcript"
              tabindex="0"
              :aria-label="t('demo.experience.transcript')"
              @scroll="onScroll"
            >
              <DemoWelcome v-if="!chatStore.hasMessages" @select="selectQuestion" />
              <DemoChatMessage
                v-for="(entry, index) in numberedMessages"
                :key="index"
                :message="entry.message"
                :answer-number="entry.number"
                :is-selected="selected === entry.message"
                @feedback="submitFeedback"
                @select="selectEvidence"
                @recover="recoverQuestion"
              />
            </div>
            <button v-if="hasNewContent" type="button" class="demo-new-content" @click="toBottom">
              <ArrowDown :size="15" />{{ t('demo.experience.newContent') }}
            </button>
          </div>
          <div v-if="chatStore.error" class="demo-chat__error" role="alert">
            <strong>{{ t('demo.experience.requestNotice') }}</strong
            ><span>{{ chatStore.error }}</span>
          </div>
          <form class="demo-chat__composer" @submit.prevent="send">
            <label class="visually-hidden" for="demo-message">{{
              t('playground.inputLabel')
            }}</label>
            <div class="demo-chat__input">
              <textarea
                id="demo-message"
                ref="composer"
                v-model="draft"
                rows="2"
                :placeholder="t('demo.chat.placeholder')"
                @compositionstart="composing = true"
                @compositionend="composing = false"
                @keydown="onComposerKey"
              ></textarea>
              <button
                type="submit"
                :disabled="chatStore.isStreaming || !draft.trim() || composing"
                :aria-label="t('playground.send')"
              >
                <ArrowUp :size="19" />
              </button>
            </div>
            <span>{{
              chatStore.isStreaming
                ? t('demo.experience.draftWhileWaiting')
                : t('demo.experience.composerHint')
            }}</span>
          </form>
          <footer>{{ t('demo.chat.footer') }}</footer>
        </section>
        <div id="demo-evidence-panel" ref="evidencePanel" class="demo-evidence-wrapper">
          <DemoEvidencePanel
            :is-loading="showcaseStore.isProductsLoading"
            :message="selected"
            :question="question"
            :answer-number="answerNumber"
            :citation-ordinal="citationOrdinal"
            :selection-revision="selectionRevision"
            :product-error="showcaseStore.productError"
            :products="showcaseStore.products"
            @retry-products="showcaseStore.loadProducts(true)"
            @select-order="selectQuestion(t('playground.examples.order'))"
            @back="backToChat"
            @toggle-source="toggleSource"
          />
        </div>
      </div>
    </section>
  </main>
</template>
