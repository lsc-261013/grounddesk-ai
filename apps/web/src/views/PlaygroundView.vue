<script setup lang="ts">
import {
  ArrowUp,
  BookMarked,
  CircleCheck,
  CircleDashed,
  RotateCcw,
  ShieldAlert,
  ThumbsDown,
  ThumbsUp,
  Wrench,
} from 'lucide-vue-next'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Locale } from '@grounddesk/shared'

import { useChatStore } from '../stores/chat'

const { locale, t } = useI18n()
const chatStore = useChatStore()
const draft = ref('')
const transcript = ref<HTMLElement | null>(null)

const examples = computed(() => [
  t('playground.examples.compatibility'),
  t('playground.examples.warranty'),
  t('playground.examples.order'),
  t('playground.examples.unknown'),
])

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

const sourceLocation = (pageStart: number | null, sectionPath: string[]): string => {
  if (pageStart) {
    return locale.value === 'zh-CN'
      ? `${pageStart} ${t('playground.page')}`
      : `${t('playground.page')} ${pageStart}`
  }
  return sectionPath.at(-1) ?? t('knowledge.noSection')
}
</script>

<template>
  <div class="console-page playground-page">
    <header class="console-page-heading playground-heading">
      <div>
        <p class="console-sidebar__eyebrow">LIVE AGENT TRACE</p>
        <h1>{{ t('playground.title') }}</h1>
        <p>{{ t('playground.description') }}</p>
      </div>
      <button class="secondary-button" type="button" @click="chatStore.resetConversation">
        <RotateCcw :size="16" />{{ t('playground.newConversation') }}
      </button>
    </header>

    <section class="playground-shell" aria-live="polite">
      <div ref="transcript" class="chat-transcript">
        <div v-if="!chatStore.hasMessages" class="chat-empty">
          <div class="chat-empty__mark"><BookMarked :size="22" /></div>
          <h2>{{ t('playground.emptyTitle') }}</h2>
          <p>{{ t('playground.emptyDescription') }}</p>
          <div class="example-grid">
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
        </div>

        <article
          v-for="message in chatStore.messages"
          :key="message.id"
          class="chat-message"
          :class="[`chat-message--${message.role}`, { 'chat-message--handoff': message.handedOff }]"
        >
          <p class="chat-message__role">
            {{ message.role === 'user' ? t('playground.you') : 'GroundDesk' }}
          </p>

          <details
            v-if="message.role === 'assistant' && message.stages.length"
            :open="message.streaming"
          >
            <summary>{{ t('playground.trace') }}</summary>
            <ol class="trace-list">
              <li v-for="trace in message.stages" :key="trace.stage" :class="`is-${trace.status}`">
                <CircleCheck v-if="trace.status === 'completed'" :size="14" />
                <ShieldAlert v-else-if="trace.status === 'failed'" :size="14" />
                <CircleDashed v-else :size="14" />
                {{ t(`playground.stage.${trace.stage}`) }}
              </li>
            </ol>
          </details>

          <div
            v-for="tool in message.tools"
            :key="`${tool.toolName}-${tool.status}`"
            class="tool-card"
          >
            <Wrench :size="16" />
            <div>
              <strong>{{ t(`playground.tool.${tool.toolName}`) }}</strong>
              <p>{{ tool.summary }}</p>
              <dl v-if="tool.details.kind === 'order_lookup'" class="tool-card__details">
                <div>
                  <dt>{{ t('playground.orderNumber') }}</dt>
                  <dd>{{ tool.details.orderNumber }}</dd>
                </div>
                <div>
                  <dt>{{ t('playground.orderStatus') }}</dt>
                  <dd>{{ t(`playground.orderStatuses.${tool.details.orderStatus}`) }}</dd>
                </div>
                <div>
                  <dt>{{ t('playground.items') }}</dt>
                  <dd>{{ tool.details.itemModels.join(' · ') }}</dd>
                </div>
              </dl>
              <dl v-else-if="tool.details.kind === 'return_eligibility'" class="tool-card__details">
                <div>
                  <dt>{{ t('playground.eligibility') }}</dt>
                  <dd>{{ t(`playground.eligibilityStatuses.${tool.details.eligibility}`) }}</dd>
                </div>
                <div>
                  <dt>{{ t('playground.policyVersion') }}</dt>
                  <dd>v{{ tool.details.policyVersion }}</dd>
                </div>
              </dl>
            </div>
            <span>{{ t(`playground.toolStatus.${tool.status}`) }}</span>
          </div>

          <p v-if="message.content" class="chat-message__content">{{ message.content }}</p>
          <p v-else-if="message.streaming" class="chat-message__waiting">
            {{ t('playground.waiting') }}
          </p>

          <div v-if="message.citations.length" class="citation-stack">
            <p>{{ t('playground.sourcesChecked') }}</p>
            <details v-for="citation in message.citations" :key="citation.chunkId">
              <summary>
                <span>[{{ citation.ordinal }}] {{ citation.documentTitle }}</span>
                <small>{{ sourceLocation(citation.pageStart, citation.sectionPath) }}</small>
              </summary>
              <blockquote>{{ citation.quote }}</blockquote>
            </details>
          </div>

          <div v-if="message.role === 'assistant' && !message.streaming" class="answer-feedback">
            <span>{{ t('playground.feedbackQuestion') }}</span>
            <button
              type="button"
              :class="{ active: message.feedback === 'helpful' }"
              :aria-label="t('playground.helpful')"
              :aria-pressed="message.feedback === 'helpful'"
              @click="chatStore.submitFeedback(message, 'helpful')"
            >
              <ThumbsUp :size="13" />
            </button>
            <button
              type="button"
              :class="{ active: message.feedback === 'unhelpful' }"
              :aria-label="t('playground.unhelpful')"
              :aria-pressed="message.feedback === 'unhelpful'"
              @click="chatStore.submitFeedback(message, 'unhelpful')"
            >
              <ThumbsDown :size="13" />
            </button>
          </div>
        </article>
      </div>

      <form class="chat-composer" @submit.prevent="send()">
        <label for="playground-message">{{ t('playground.inputLabel') }}</label>
        <div>
          <textarea
            id="playground-message"
            v-model="draft"
            :placeholder="t('playground.inputPlaceholder')"
            :disabled="chatStore.isStreaming"
            rows="3"
            @keydown.ctrl.enter.prevent="send()"
          />
          <button
            type="submit"
            :disabled="chatStore.isStreaming || !draft.trim()"
            :aria-label="t('playground.send')"
          >
            <ArrowUp :size="18" />
          </button>
        </div>
        <p v-if="chatStore.error" class="chat-error" role="alert">{{ chatStore.error }}</p>
        <p class="chat-composer__note">{{ t('playground.safetyNote') }}</p>
      </form>
    </section>
  </div>
</template>
