<script setup lang="ts">
import {
  BookOpenCheck,
  CheckCircle2,
  CircleDashed,
  ShieldAlert,
  ThumbsDown,
  ThumbsUp,
  TicketCheck,
  Wrench,
} from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

import type { FeedbackRating } from '@grounddesk/shared'

import type { ChatMessageView } from '../stores/chat'

defineProps<{
  isSelected: boolean
  message: ChatMessageView
}>()

const emit = defineEmits<{
  feedback: [message: ChatMessageView, rating: FeedbackRating]
  select: [message: ChatMessageView]
}>()

const { t } = useI18n()
</script>

<template>
  <article
    class="demo-message"
    :class="{ 'is-selected': isSelected }"
    :data-role="message.role"
    :data-handoff="message.handedOff"
  >
    <header v-if="message.role === 'assistant'" class="demo-message__meta">
      <span>GroundDesk AI</span>
      <b v-if="message.streaming">{{ t('demo.chat.generating') }}</b>
      <b v-else-if="message.handedOff" class="is-handoff">
        <TicketCheck :size="13" />{{ t('demo.chat.handedOff') }}
      </b>
      <b v-else-if="message.failed" class="is-error">
        <ShieldAlert :size="13" />{{ t('demo.chat.failed') }}
      </b>
    </header>

    <details v-if="message.role === 'assistant' && message.stages.length" class="demo-trace">
      <summary>{{ t('playground.trace') }}</summary>
      <ol>
        <li v-for="stage in message.stages" :key="stage.stage" :data-status="stage.status">
          <CheckCircle2 v-if="stage.status === 'completed'" :size="13" />
          <ShieldAlert v-else-if="stage.status === 'failed'" :size="13" />
          <CircleDashed v-else :size="13" />
          {{ t(`playground.stage.${stage.stage}`) }}
        </li>
      </ol>
    </details>

    <div v-for="tool in message.tools" :key="`${tool.toolName}-${tool.status}`" class="demo-tool">
      <Wrench :size="15" />
      <span>
        <strong>{{ t(`playground.tool.${tool.toolName}`) }}</strong>
        <small>{{ tool.summary }}</small>
      </span>
    </div>

    <p class="demo-message__content">{{ message.content || t('playground.waiting') }}</p>

    <button
      v-if="message.role === 'assistant' && message.citations.length"
      type="button"
      class="demo-message__source-button"
      @click="emit('select', message)"
    >
      <BookOpenCheck :size="15" />
      {{ t('demo.sources.open', { count: message.citations.length }) }}
    </button>

    <details
      v-if="message.role === 'assistant' && message.citations.length"
      class="demo-inline-citations"
    >
      <summary>{{ t('demo.sources.mobileOpen') }}</summary>
      <div>
        <article v-for="citation in message.citations" :key="citation.chunkId">
          <strong>[{{ citation.ordinal }}] {{ citation.documentTitle }}</strong>
          <blockquote>{{ citation.quote }}</blockquote>
        </article>
      </div>
    </details>

    <div
      v-if="message.role === 'assistant' && !message.streaming && !message.failed"
      class="answer-feedback"
    >
      <span>{{ t('playground.feedbackQuestion') }}</span>
      <button
        type="button"
        :class="{ active: message.feedback === 'helpful' }"
        :aria-label="t('playground.helpful')"
        @click="emit('feedback', message, 'helpful')"
      >
        <ThumbsUp :size="14" />
      </button>
      <button
        type="button"
        :class="{ active: message.feedback === 'unhelpful' }"
        :aria-label="t('playground.unhelpful')"
        @click="emit('feedback', message, 'unhelpful')"
      >
        <ThumbsDown :size="14" />
      </button>
    </div>
  </article>
</template>
