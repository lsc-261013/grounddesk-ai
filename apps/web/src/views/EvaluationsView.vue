<script setup lang="ts">
import {
  AlertCircle,
  ArrowLeft,
  Beaker,
  Check,
  CircleX,
  LoaderCircle,
  Play,
  ShieldCheck,
} from 'lucide-vue-next'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import type { EvaluationMetrics } from '@grounddesk/shared'

import { useAuthStore } from '../stores/auth'
import { useEvaluationStore } from '../stores/evaluations'

const { locale, t } = useI18n()
const authStore = useAuthStore()
const evaluationStore = useEvaluationStore()
const isAdmin = computed(() => authStore.activeMembership?.role === 'admin')
const latestCompleted = computed(() =>
  evaluationStore.runs.find((run) => run.providerMode === 'live' && run.status === 'completed'),
)
const categories = computed(() => {
  const counts = new Map<string, number>()
  for (const evaluationCase of evaluationStore.cases) {
    counts.set(evaluationCase.category, (counts.get(evaluationCase.category) ?? 0) + 1)
  }
  return [...counts.entries()]
})

const percent = (value: number | null): string =>
  value === null ? t('common.unavailable') : `${Math.round(value * 100)}%`
const formatDate = (value: string): string =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  )
const metricEntries = (summary: EvaluationMetrics): Array<[string, number | null]> => [
  ['citationCoverage', summary.citationCoverage],
  ['retrievalAt5', summary.retrievalAt5],
  ['refusalHandoffRate', summary.refusalHandoffRate],
  ['toolSelectionAccuracy', summary.toolSelectionAccuracy],
  ['returnRuleAccuracy', summary.returnRuleAccuracy],
  ['isolationPassRate', summary.isolationPassRate],
]

onMounted(() => void evaluationStore.load())
</script>

<template>
  <div class="evaluations-page">
    <header class="console-page-heading">
      <div>
        <p class="console-kicker">DETERMINISTIC EVALS · REAL PROVIDERS</p>
        <h1>{{ t('evaluations.title') }}</h1>
        <p>{{ t('evaluations.description') }}</p>
      </div>
      <span class="document-limit"
        >{{ evaluationStore.cases.length }} {{ t('evaluations.cases') }}</span
      >
    </header>

    <p v-if="evaluationStore.error" class="console-alert" role="alert">
      <AlertCircle :size="17" />{{ t('evaluations.error') }}
    </p>

    <section
      v-if="evaluationStore.isLoading && evaluationStore.runs.length === 0"
      class="console-panel console-empty"
    >
      <LoaderCircle class="spin" :size="18" />{{ t('evaluations.loading') }}
    </section>

    <template v-else>
      <section class="evaluation-hero">
        <article class="evaluation-score">
          <div>
            <span>{{ t('evaluations.latestLive') }}</span>
            <strong v-if="latestCompleted?.summary">
              {{ latestCompleted.summary.passed }}/{{ latestCompleted.summary.total }}
            </strong>
            <strong v-else>—</strong>
            <small v-if="latestCompleted">{{ formatDate(latestCompleted.createdAt) }}</small>
            <small v-else>{{ t('evaluations.noLiveRun') }}</small>
          </div>
          <ShieldCheck :size="34" />
        </article>
        <article class="console-panel evaluation-categories">
          <p class="console-kicker">CASE DISTRIBUTION</p>
          <h2>{{ t('evaluations.coverageTitle') }}</h2>
          <div>
            <span v-for="[category, count] in categories" :key="category">
              {{ t(`evaluations.category.${category}`) }} <b>{{ count }}</b>
            </span>
          </div>
        </article>
        <article class="console-panel evaluation-actions">
          <p class="console-kicker">CONTROLLED EXECUTION</p>
          <h2>{{ t('evaluations.runTitle') }}</h2>
          <p>{{ isAdmin ? t('evaluations.runDescription') : t('evaluations.readOnly') }}</p>
          <div v-if="isAdmin">
            <button
              class="console-secondary-button"
              type="button"
              :disabled="evaluationStore.isRunning"
              @click="evaluationStore.run('mock')"
            >
              <Beaker :size="15" />{{ t('evaluations.runMock') }}
            </button>
            <button
              class="console-primary-button"
              type="button"
              :disabled="evaluationStore.isRunning"
              @click="evaluationStore.run('live')"
            >
              <LoaderCircle v-if="evaluationStore.isRunning" class="spin" :size="15" />
              <Play v-else :size="15" />{{ t('evaluations.runLive') }}
            </button>
          </div>
        </article>
      </section>

      <section v-if="latestCompleted?.summary" class="evaluation-metrics">
        <article v-for="[key, value] in metricEntries(latestCompleted.summary)" :key="key">
          <span>{{ t(`evaluations.metric.${key}`) }}</span>
          <strong>{{ percent(value) }}</strong>
        </article>
      </section>

      <section class="console-panel run-history">
        <div class="console-panel__heading">
          <div>
            <p class="console-kicker">AUDITABLE RUNS</p>
            <h2>{{ t('evaluations.history') }}</h2>
          </div>
        </div>
        <p v-if="evaluationStore.runs.length === 0" class="console-empty">
          {{ t('evaluations.empty') }}
        </p>
        <button
          v-for="run in evaluationStore.runs"
          v-else
          :key="run.id"
          type="button"
          @click="evaluationStore.detail(run.id)"
        >
          <span class="run-mode" :data-mode="run.providerMode">{{ run.providerMode }}</span>
          <span>
            <strong>{{
              run.summary
                ? `${run.summary.passed}/${run.summary.total}`
                : t(`evaluations.status.${run.status}`)
            }}</strong>
            <small
              >{{ formatDate(run.createdAt) }} ·
              {{ run.gitCommitSha?.slice(0, 8) ?? t('common.unavailable') }}</small
            >
          </span>
          <span class="status-badge" :data-status="run.status">{{
            t(`evaluations.status.${run.status}`)
          }}</span>
        </button>
      </section>
    </template>

    <aside v-if="evaluationStore.selectedRun" class="evaluation-drawer">
      <header>
        <button type="button" :aria-label="t('common.close')" @click="evaluationStore.closeDetail">
          <ArrowLeft :size="17" />
        </button>
        <div>
          <p class="console-kicker">
            {{ evaluationStore.selectedRun.providerMode }} ·
            {{ evaluationStore.selectedRun.id.slice(0, 8) }}
          </p>
          <h2>{{ t('evaluations.runDetail') }}</h2>
        </div>
      </header>
      <div v-if="evaluationStore.selectedRun.summary" class="evaluation-drawer__summary">
        <strong
          >{{ evaluationStore.selectedRun.summary.passed }}/{{
            evaluationStore.selectedRun.summary.total
          }}</strong
        >
        <span>{{ t('evaluations.passed') }}</span>
      </div>
      <div class="result-list">
        <article
          v-for="result in evaluationStore.results"
          :key="result.id"
          :class="{ failed: !result.passed }"
        >
          <Check v-if="result.passed" :size="15" />
          <CircleX v-else :size="15" />
          <div>
            <strong>{{ result.caseKey }}</strong>
            <small
              >{{ t(`evaluations.category.${result.category}`) }} · {{ result.locale }} ·
              {{ result.latencyMs ?? 0 }} ms</small
            >
            <p v-if="result.failures.length">{{ result.failures.join(' · ') }}</p>
          </div>
        </article>
      </div>
    </aside>
    <button
      v-if="evaluationStore.selectedRun"
      class="drawer-backdrop"
      type="button"
      :aria-label="t('common.close')"
      @click="evaluationStore.closeDetail"
    ></button>
  </div>
</template>
