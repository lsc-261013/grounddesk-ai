<script setup lang="ts">
import { AlertCircle, BookOpenText, LoaderCircle, MessageSquareText, Wrench } from 'lucide-vue-next'
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import { useConversationStore } from '../stores/conversations'

const { locale, t } = useI18n()
const conversationStore = useConversationStore()

const formatDate = (value: string): string =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  )

const initialize = async (): Promise<void> => {
  await conversationStore.load()
  const first = conversationStore.conversations[0]
  if (first) await conversationStore.select(first.id)
}

onMounted(() => void initialize())
</script>

<template>
  <div class="console-page conversations-page">
    <header class="console-page-heading">
      <div>
        <p class="console-kicker">{{ t('conversations.kicker') }}</p>
        <h1>{{ t('conversations.title') }}</h1>
        <p>{{ t('conversations.description') }}</p>
      </div>
      <span class="metric-chip"><MessageSquareText :size="15" />{{ conversationStore.total }}</span>
    </header>

    <p v-if="conversationStore.error" class="console-alert" role="alert">
      <AlertCircle :size="17" />{{ conversationStore.error }}
    </p>
    <section v-if="conversationStore.isLoading" class="console-panel console-empty">
      <LoaderCircle class="spin" :size="18" />{{ t('conversations.loading') }}
    </section>
    <section
      v-else-if="conversationStore.conversations.length === 0"
      class="console-panel console-empty"
    >
      <MessageSquareText :size="24" />
      <strong>{{ t('conversations.emptyTitle') }}</strong>
      <span>{{ t('conversations.emptyDescription') }}</span>
    </section>
    <section v-else class="conversation-workbench">
      <nav class="console-panel conversation-index" :aria-label="t('conversations.listLabel')">
        <button
          v-for="conversation in conversationStore.conversations"
          :key="conversation.id"
          type="button"
          :class="{ active: conversationStore.selected?.id === conversation.id }"
          @click="conversationStore.select(conversation.id)"
        >
          <span>
            <strong>{{ t(`conversations.source.${conversation.source}`) }}</strong>
            <time>{{ formatDate(conversation.updatedAt) }}</time>
          </span>
          <p>{{ conversation.latestMessage ?? t('conversations.noMessage') }}</p>
          <span class="conversation-index__meta">
            <small>{{ conversation.messageCount }} {{ t('conversations.messages') }}</small>
            <small v-if="conversation.lastIntent">{{ conversation.lastIntent }}</small>
            <small v-if="conversation.handedOff" class="is-risk">{{
              t('conversations.handoff')
            }}</small>
          </span>
        </button>
      </nav>

      <article class="console-panel conversation-inspector">
        <div v-if="conversationStore.isLoadingDetail" class="console-empty">
          <LoaderCircle class="spin" :size="18" />{{ t('conversations.loadingDetail') }}
        </div>
        <template v-else-if="conversationStore.selected">
          <header>
            <div>
              <p class="console-kicker">{{ conversationStore.selected.id.slice(0, 8) }}</p>
              <h2>{{ t(`conversations.source.${conversationStore.selected.source}`) }}</h2>
            </div>
            <span class="status-badge" :data-status="conversationStore.selected.status">
              {{ t(`conversations.status.${conversationStore.selected.status}`) }}
            </span>
          </header>
          <div class="conversation-transcript">
            <article
              v-for="message in conversationStore.selected.messages"
              :key="message.id"
              :class="`is-${message.role}`"
            >
              <div>
                <strong>{{ message.role === 'user' ? t('playground.you') : 'GroundDesk' }}</strong>
                <time>{{ formatDate(message.createdAt) }}</time>
              </div>
              <p>{{ message.content }}</p>
              <dl v-if="message.role === 'assistant'" class="message-observability">
                <div>
                  <dt>{{ t('conversations.intent') }}</dt>
                  <dd>{{ message.intent ?? '—' }}</dd>
                </div>
                <div>
                  <dt>{{ t('conversations.latency') }}</dt>
                  <dd>{{ message.totalLatencyMs ?? '—' }} ms</dd>
                </div>
                <div>
                  <dt>{{ t('conversations.tokens') }}</dt>
                  <dd>{{ (message.inputTokens ?? 0) + (message.outputTokens ?? 0) || '—' }}</dd>
                </div>
              </dl>
              <details
                v-for="citation in message.citations"
                :key="citation.chunkId"
                class="audit-citation"
              >
                <summary>
                  <BookOpenText :size="13" />[{{ citation.ordinal }}] {{ citation.documentTitle }}
                </summary>
                <blockquote>{{ citation.quote }}</blockquote>
              </details>
            </article>
          </div>
          <section v-if="conversationStore.selected.tools.length" class="conversation-tools">
            <h3><Wrench :size="15" />{{ t('conversations.tools') }}</h3>
            <div v-for="tool in conversationStore.selected.tools" :key="tool.id">
              <strong>{{ tool.toolName }}</strong>
              <span class="status-badge" :data-status="tool.status">{{ tool.status }}</span>
              <small>{{ tool.durationMs ?? '—' }} ms</small>
            </div>
          </section>
        </template>
      </article>
    </section>
  </div>
</template>
