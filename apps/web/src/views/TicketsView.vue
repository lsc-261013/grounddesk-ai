<script setup lang="ts">
import {
  AlertCircle,
  ArrowLeft,
  BookOpenText,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  MessageSquareText,
  Send,
  Wrench,
} from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { TicketPriority, TicketStatus } from '@grounddesk/shared'

import { useAuthStore } from '../stores/auth'
import { useTicketStore } from '../stores/tickets'

const { locale, t } = useI18n()
const authStore = useAuthStore()
const ticketStore = useTicketStore()
const statusFilter = ref<TicketStatus | 'all'>('all')
const replyBody = ref('')
const isAdmin = computed(() => authStore.activeMembership?.role === 'admin')
const filteredTickets = computed(() =>
  statusFilter.value === 'all'
    ? ticketStore.tickets
    : ticketStore.tickets.filter((ticket) => ticket.status === statusFilter.value),
)

const formatDate = (value: string): string =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  )

const sendReply = async (): Promise<void> => {
  const ticket = ticketStore.selected
  const body = replyBody.value.trim()
  if (!ticket || !body) return
  if (await ticketStore.reply(ticket.id, body)) replyBody.value = ''
}

const updateStatus = (event: Event): void => {
  const ticket = ticketStore.selected
  if (ticket)
    void ticketStore.setStatus(ticket.id, (event.target as HTMLSelectElement).value as TicketStatus)
}

const updateAssignment = (event: Event): void => {
  const ticket = ticketStore.selected
  if (!ticket) return
  const value = (event.target as HTMLSelectElement).value
  void ticketStore.assign(ticket.id, value || null, ticket.priority)
}

const updatePriority = (event: Event): void => {
  const ticket = ticketStore.selected
  if (!ticket) return
  void ticketStore.assign(
    ticket.id,
    ticket.assignedTo?.id ?? null,
    (event.target as HTMLSelectElement).value as TicketPriority,
  )
}

onMounted(() => {
  void ticketStore.load()
  if (isAdmin.value) void ticketStore.loadAgents()
})
</script>

<template>
  <div class="tickets-page">
    <header class="console-page-heading">
      <div>
        <p class="console-kicker">HUMAN HANDOFF · VERIFIED CONTEXT</p>
        <h1>{{ t('tickets.title') }}</h1>
        <p>{{ isAdmin ? t('tickets.adminDescription') : t('tickets.agentDescription') }}</p>
      </div>
      <span class="document-limit">{{ ticketStore.tickets.length }} {{ t('tickets.total') }}</span>
    </header>

    <p v-if="ticketStore.error" class="console-alert" role="alert">
      <AlertCircle :size="17" />{{ t('tickets.error') }}
    </p>

    <div class="ticket-filter" :aria-label="t('tickets.filter')">
      <button
        v-for="status in ['all', 'open', 'in_progress', 'waiting_customer', 'resolved'] as const"
        :key="status"
        type="button"
        :class="{ active: statusFilter === status }"
        @click="statusFilter = status"
      >
        {{ t(`tickets.status.${status}`) }}
      </button>
    </div>

    <section class="ticket-workspace">
      <div class="ticket-queue">
        <div v-if="ticketStore.isLoading && ticketStore.tickets.length === 0" class="console-empty">
          <LoaderCircle class="spin" :size="18" />{{ t('tickets.loading') }}
        </div>
        <div v-else-if="filteredTickets.length === 0" class="console-empty">
          <CheckCircle2 :size="20" />{{ t('tickets.empty') }}
        </div>
        <template v-else>
          <button
            v-for="ticket in filteredTickets"
            :key="ticket.id"
            class="ticket-row"
            :class="{ active: ticketStore.selected?.id === ticket.id }"
            type="button"
            @click="ticketStore.open(ticket.id)"
          >
            <span class="ticket-priority" :data-priority="ticket.priority"></span>
            <span>
              <strong>{{ ticket.summary }}</strong>
              <small>{{ t(`tickets.reason.${ticket.handoffReason}`, ticket.handoffReason) }}</small>
            </span>
            <span class="status-badge" :data-status="ticket.status">
              {{ t(`tickets.status.${ticket.status}`) }}
            </span>
            <time>{{ formatDate(ticket.updatedAt) }}</time>
          </button>
        </template>
      </div>

      <article v-if="ticketStore.selected" class="ticket-detail">
        <div class="ticket-detail__header">
          <button type="button" :aria-label="t('common.close')" @click="ticketStore.closeDetail">
            <ArrowLeft :size="17" />
          </button>
          <div>
            <p class="console-kicker">{{ ticketStore.selected.id.slice(0, 8) }}</p>
            <h2>{{ ticketStore.selected.summary }}</h2>
          </div>
        </div>

        <div class="ticket-controls">
          <label>
            <span>{{ t('tickets.statusLabel') }}</span>
            <select
              :value="ticketStore.selected.status"
              :disabled="ticketStore.isMutating"
              @change="updateStatus"
            >
              <option
                v-for="status in ['open', 'in_progress', 'waiting_customer', 'resolved'] as const"
                :key="status"
                :value="status"
              >
                {{ t(`tickets.status.${status}`) }}
              </option>
            </select>
          </label>
          <label v-if="isAdmin">
            <span>{{ t('tickets.assignee') }}</span>
            <select
              :value="ticketStore.selected.assignedTo?.id ?? ''"
              :disabled="ticketStore.isMutating"
              @change="updateAssignment"
            >
              <option value="">{{ t('tickets.unassigned') }}</option>
              <option v-for="agent in ticketStore.agents" :key="agent.id" :value="agent.id">
                {{ agent.displayName }}
              </option>
            </select>
          </label>
          <label v-if="isAdmin">
            <span>{{ t('tickets.priorityLabel') }}</span>
            <select
              :value="ticketStore.selected.priority"
              :disabled="ticketStore.isMutating"
              @change="updatePriority"
            >
              <option
                v-for="priority in ['low', 'normal', 'high', 'urgent'] as const"
                :key="priority"
                :value="priority"
              >
                {{ t(`tickets.priority.${priority}`) }}
              </option>
            </select>
          </label>
        </div>

        <section class="ticket-context-block">
          <h3><MessageSquareText :size="15" />{{ t('tickets.conversation') }}</h3>
          <div class="ticket-transcript">
            <div
              v-for="message in ticketStore.selected.conversationMessages"
              :key="message.id"
              :data-role="message.role"
            >
              <small>{{ message.role }} · {{ formatDate(message.createdAt) }}</small>
              <p>{{ message.content }}</p>
            </div>
          </div>
        </section>

        <section v-if="ticketStore.selected.evidence.length" class="ticket-context-block">
          <h3><BookOpenText :size="15" />{{ t('tickets.evidence') }}</h3>
          <details v-for="citation in ticketStore.selected.evidence" :key="citation.chunkId">
            <summary>[{{ citation.ordinal }}] {{ citation.documentTitle }}</summary>
            <blockquote>{{ citation.quote }}</blockquote>
          </details>
        </section>

        <section v-if="ticketStore.selected.tools.length" class="ticket-context-block">
          <h3><Wrench :size="15" />{{ t('tickets.tools') }}</h3>
          <div v-for="tool in ticketStore.selected.tools" :key="tool.id" class="ticket-tool-row">
            <strong>{{ t(`playground.tool.${tool.toolName}`) }}</strong>
            <span>{{ tool.status }}</span>
            <small><Clock3 :size="12" />{{ tool.durationMs ?? 0 }} ms</small>
          </div>
        </section>

        <section class="ticket-context-block">
          <h3>{{ t('tickets.replies') }}</h3>
          <p v-if="ticketStore.selected.replies.length === 0" class="console-empty">
            {{ t('tickets.noReplies') }}
          </p>
          <div v-for="reply in ticketStore.selected.replies" :key="reply.id" class="ticket-reply">
            <small>
              {{ reply.author?.displayName ?? reply.authorType }} ·
              {{ formatDate(reply.createdAt) }}
            </small>
            <p>{{ reply.body }}</p>
          </div>
          <form
            v-if="ticketStore.selected.status !== 'resolved'"
            class="ticket-reply-form"
            @submit.prevent="sendReply"
          >
            <label>
              <span class="visually-hidden">{{ t('tickets.replyPlaceholder') }}</span>
              <textarea
                v-model="replyBody"
                maxlength="4000"
                :placeholder="t('tickets.replyPlaceholder')"
              ></textarea>
            </label>
            <button
              class="console-primary-button"
              type="submit"
              :disabled="!replyBody.trim() || ticketStore.isMutating"
            >
              <LoaderCircle v-if="ticketStore.isMutating" class="spin" :size="14" />
              <Send v-else :size="14" />{{ t('tickets.sendReply') }}
            </button>
          </form>
        </section>
      </article>

      <div v-else class="ticket-detail ticket-detail--empty">
        <MessageSquareText :size="24" />
        <h2>{{ t('tickets.selectTitle') }}</h2>
        <p>{{ t('tickets.selectDescription') }}</p>
      </div>
    </section>
  </div>
</template>
