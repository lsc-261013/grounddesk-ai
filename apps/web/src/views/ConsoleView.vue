<script setup lang="ts">
import {
  AlertCircle,
  ArrowUpRight,
  Clock3,
  Coins,
  MessageSquareText,
  ShieldCheck,
  TicketCheck,
} from 'lucide-vue-next'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import { useAuthStore } from '../stores/auth'
import { useOverviewStore } from '../stores/overview'

const { locale, t } = useI18n()
const authStore = useAuthStore()
const overviewStore = useOverviewStore()
const role = computed(() => authStore.activeMembership?.role ?? 'agent')
const metrics = computed(() => overviewStore.metrics)

const percent = (value: number | null | undefined): string =>
  value === null || value === undefined ? t('common.unavailable') : `${Math.round(value * 100)}%`
const latency = (value: number | null | undefined): string =>
  value === null || value === undefined ? t('common.unavailable') : `${value.toLocaleString()} ms`
const money = (value: number | null | undefined): string =>
  value === null || value === undefined ? t('common.unavailable') : `$${value.toFixed(4)}`
const formatDate = (value: string): string =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  )

onMounted(() => void overviewStore.load())
</script>

<template>
  <div class="console-overview">
    <header class="console-page-heading">
      <div>
        <p class="console-kicker">LIVE OPERATIONS · 30 DAYS</p>
        <h1>{{ t('overview.title') }}</h1>
        <p>{{ t('overview.description') }}</p>
      </div>
      <span class="role-chip"><ShieldCheck :size="15" />{{ role }}</span>
    </header>

    <p v-if="overviewStore.error" class="console-alert" role="alert">
      <AlertCircle :size="17" />{{ t('overview.error') }}
      <button type="button" @click="overviewStore.load">{{ t('common.retry') }}</button>
    </p>

    <section v-if="overviewStore.isLoading && !metrics" class="metric-grid" aria-busy="true">
      <div v-for="index in 6" :key="index" class="metric-card metric-card--loading"></div>
    </section>

    <template v-else-if="metrics">
      <section class="metric-grid" :aria-label="t('overview.metrics')">
        <article class="metric-card metric-card--lead">
          <MessageSquareText :size="18" />
          <span>{{ t('overview.conversations') }}</span>
          <strong>{{ metrics.totalConversations }}</strong>
          <small>{{ metrics.assistantAnswers }} {{ t('overview.answers') }}</small>
        </article>
        <article class="metric-card">
          <ShieldCheck :size="18" />
          <span>{{ t('overview.citationCoverage') }}</span>
          <strong>{{ percent(metrics.citationCoverageRate) }}</strong>
          <small>{{ t('overview.citationHint') }}</small>
        </article>
        <article class="metric-card metric-card--warm">
          <TicketCheck :size="18" />
          <span>{{ t('overview.handoffRate') }}</span>
          <strong>{{ percent(metrics.handoffRate) }}</strong>
          <small>{{ metrics.openTickets }} {{ t('overview.openTickets') }}</small>
        </article>
        <article class="metric-card">
          <Clock3 :size="18" />
          <span>{{ t('overview.firstToken') }}</span>
          <strong>{{ latency(metrics.medianFirstTokenLatencyMs) }}</strong>
          <small>{{ t('overview.medianLatency') }}</small>
        </article>
        <article class="metric-card">
          <Clock3 :size="18" />
          <span>{{ t('overview.totalLatency') }}</span>
          <strong>{{ latency(metrics.medianTotalLatencyMs) }}</strong>
          <small>{{ t('overview.medianLatency') }}</small>
        </article>
        <article class="metric-card">
          <Coins :size="18" />
          <span>{{ t('overview.estimatedCost') }}</span>
          <strong>{{ money(metrics.estimatedCostUsd) }}</strong>
          <small>
            {{ metrics.totalTokens?.toLocaleString() ?? t('common.unavailable') }}
            {{ t('overview.tokens') }}
          </small>
        </article>
      </section>

      <section class="overview-lower-grid">
        <article class="console-panel">
          <div class="console-panel__heading">
            <div>
              <p class="console-kicker">KNOWLEDGE GAPS</p>
              <h2>{{ t('overview.gapsTitle') }}</h2>
            </div>
            <RouterLink to="/console/playground">
              {{ t('overview.inspect') }}<ArrowUpRight :size="14" />
            </RouterLink>
          </div>
          <p v-if="metrics.knowledgeGaps.length === 0" class="console-empty">
            {{ t('overview.noGaps') }}
          </p>
          <ol v-else class="gap-list">
            <li v-for="gap in metrics.knowledgeGaps" :key="gap.query">
              <span>{{ gap.query }}</span>
              <small>{{ gap.occurrenceCount }}× · {{ formatDate(gap.lastSeenAt) }}</small>
            </li>
          </ol>
        </article>
        <article class="console-panel overview-boundary">
          <p class="console-kicker">MEASUREMENT BOUNDARY</p>
          <h2>{{ t('overview.boundaryTitle') }}</h2>
          <p>{{ t('overview.boundaryDescription') }}</p>
          <dl>
            <div>
              <dt>{{ t('overview.refusalRate') }}</dt>
              <dd>{{ percent(metrics.refusalRate) }}</dd>
            </div>
            <div>
              <dt>{{ t('overview.period') }}</dt>
              <dd>{{ metrics.periodDays }} {{ t('overview.days') }}</dd>
            </div>
          </dl>
        </article>
      </section>
    </template>
  </div>
</template>
