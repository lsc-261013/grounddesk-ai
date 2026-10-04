<script setup lang="ts">
import {
  BookOpenCheck,
  CheckCircle2,
  CircleDashed,
  ShieldAlert,
  ThumbsDown,
  ThumbsUp,
  TicketCheck,
} from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { FeedbackRating } from '@grounddesk/shared'

import type { ChatMessageView } from '../stores/chat'
import DemoAnswerText from './DemoAnswerText.vue'
import DemoToolResult from './DemoToolResult.vue'

const props = defineProps<{
  isSelected: boolean
  message: ChatMessageView
  answerNumber?: number
}>()
const emit = defineEmits<{
  feedback: [message: ChatMessageView, rating: FeedbackRating]
  select: [message: ChatMessageView, ordinal?: number]
  recover: [message: ChatMessageView]
}>()
const { t } = useI18n()
const activeStage = computed(() =>
  [...props.message.stages].reverse().find((stage) => stage.status === 'active'),
)
</script>

<template>
  <article
    class="demo-message"
    :class="{ 'is-selected': isSelected }"
    :data-role="message.role"
    :data-handoff="message.handedOff"
    :data-failed="message.failed"
  >
    <header v-if="message.role === 'assistant'" class="demo-message__meta">
      <span
        >GroundDesk AI
        <small v-if="answerNumber"
          >· {{ t('demo.experience.answerNumber', { number: answerNumber }) }}</small
        ></span
      >
      <b v-if="message.streaming">{{
        activeStage ? t(`playground.stage.${activeStage.stage}`) : t('demo.experience.receiving')
      }}</b>
      <b v-else-if="message.failed" class="is-error"
        ><ShieldAlert :size="13" />{{ t('demo.chat.failed') }}</b
      >
      <b v-else-if="message.handedOff" class="is-handoff"
        ><TicketCheck :size="13" />{{ t('demo.chat.handedOff') }}</b
      >
    </header>
    <p v-if="!message.content" class="demo-waiting" role="status">{{ t('playground.waiting') }}</p>
    <DemoAnswerText
      v-else
      :content="message.content"
      :citations="message.role === 'assistant' ? message.citations : []"
      @citation="emit('select', message, $event)"
    />
    <DemoToolResult v-for="(tool, index) in message.tools" :key="index" :tool="tool" />
    <div v-if="message.role === 'assistant'" class="demo-message__actions">
      <button
        type="button"
        class="demo-message__source-button"
        :aria-pressed="isSelected"
        @click="emit('select', message)"
      >
        <BookOpenCheck :size="15" />{{
          message.citations.length
            ? t('demo.sources.open', { count: message.citations.length })
            : t('demo.experience.viewOutcome')
        }}
      </button>
      <button
        v-if="message.failed"
        type="button"
        class="demo-recover"
        @click="emit('recover', message)"
      >
        {{ t('demo.experience.restoreQuestion') }}
      </button>
    </div>
    <p v-if="message.failed" class="demo-message__notice">
      {{ t('demo.experience.failureNotice') }}
    </p>
    <details v-if="message.role === 'assistant' && message.stages.length" class="demo-trace">
      <summary>{{ t('playground.trace') }}</summary>
      <ol>
        <li v-for="stage in message.stages" :key="stage.stage" :data-status="stage.status">
          <CheckCircle2 v-if="stage.status === 'completed'" :size="13" /><ShieldAlert
            v-else-if="stage.status === 'failed'"
            :size="13"
          /><CircleDashed v-else :size="13" />{{ t(`playground.stage.${stage.stage}`) }}
        </li>
      </ol>
    </details>
    <div
      v-if="message.role === 'assistant' && !message.streaming && !message.failed"
      class="answer-feedback"
    >
      <span>{{
        message.feedback ? t('demo.experience.feedbackSaved') : t('playground.feedbackQuestion')
      }}</span>
      <button
        type="button"
        :disabled="message.feedbackPending"
        :class="{ active: message.feedback === 'helpful' }"
        :aria-pressed="message.feedback === 'helpful'"
        :aria-label="t('playground.helpful')"
        @click="emit('feedback', message, 'helpful')"
      >
        <ThumbsUp :size="14" />
      </button>
      <button
        type="button"
        :disabled="message.feedbackPending"
        :class="{ active: message.feedback === 'unhelpful' }"
        :aria-pressed="message.feedback === 'unhelpful'"
        :aria-label="t('playground.unhelpful')"
        @click="emit('feedback', message, 'unhelpful')"
      >
        <ThumbsDown :size="14" />
      </button>
    </div>
  </article>
</template>
