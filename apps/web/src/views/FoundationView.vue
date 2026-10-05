<script setup lang="ts">
import {
  ArrowRight,
  BookOpenCheck,
  Check,
  Database,
  GitBranch,
  LockKeyhole,
  MessageSquareText,
  ShieldCheck,
  TicketCheck,
} from 'lucide-vue-next'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import SupportPreview from '../components/SupportPreview.vue'
import { useShowcaseStore } from '../stores/showcase'

const { locale, t } = useI18n()
const showcaseStore = useShowcaseStore()
const evaluation = computed(() => showcaseStore.evaluation)
const contactUrl = import.meta.env.VITE_CONTACT_URL?.trim()
const githubUrl = import.meta.env.VITE_GITHUB_URL?.trim()

onMounted(() => void showcaseStore.loadEvaluation())
</script>

<template>
  <main class="landing-page">
    <section class="landing-hero">
      <div class="landing-hero__copy">
        <p class="landing-eyebrow"><span></span>{{ t('landing.hero.eyebrow') }}</p>
        <h1>
          <span>{{ t('presentation.titleFirst') }}</span
          ><span>{{ t('presentation.titleSecond') }}</span>
        </h1>
        <p class="landing-hero__lead">{{ t('presentation.lead') }}</p>
        <div class="landing-actions">
          <RouterLink class="landing-button landing-button--primary" to="/demo">
            {{ t('landing.hero.primaryCta') }}<ArrowRight :size="17" />
          </RouterLink>
          <a class="landing-button landing-button--secondary" href="#project-notes">
            {{ t('landing.hero.secondaryCta') }}
          </a>
        </div>
        <ul class="landing-proof-list">
          <li><BookOpenCheck :size="16" />{{ t('presentation.verified') }}</li>
          <li><ShieldCheck :size="16" />{{ t('presentation.readOnly') }}</li>
          <li><TicketCheck :size="16" />{{ t('presentation.handoff') }}</li>
        </ul>
      </div>
      <SupportPreview />
    </section>

    <section class="landing-workbench" aria-labelledby="scenario-title">
      <div class="landing-workbench__inner">
        <header class="landing-section__heading landing-section__heading--dark">
          <div>
            <p class="landing-eyebrow landing-eyebrow--dark">
              <span></span>{{ t('landing.scenarios.eyebrow') }}
            </p>
            <h2 id="scenario-title">{{ t('presentation.pathTitle') }}</h2>
          </div>
          <p>{{ t('presentation.pathDescription') }}</p>
        </header>

        <div class="landing-scenario-grid">
          <article>
            <span class="landing-scenario-grid__icon"><BookOpenCheck :size="20" /></span>
            <small>01 · {{ t('landing.scenarios.groundedLabel') }}</small>
            <h3>{{ t('landing.scenarios.groundedTitle') }}</h3>
            <p>{{ t('landing.scenarios.groundedDescription') }}</p>
            <strong><Check :size="15" />{{ t('landing.scenarios.groundedResult') }}</strong>
          </article>
          <article>
            <span class="landing-scenario-grid__icon"><MessageSquareText :size="20" /></span>
            <small>02 · {{ t('landing.scenarios.unknownLabel') }}</small>
            <h3>{{ t('landing.scenarios.unknownTitle') }}</h3>
            <p>{{ t('landing.scenarios.unknownDescription') }}</p>
            <strong><Check :size="15" />{{ t('landing.scenarios.unknownResult') }}</strong>
          </article>
          <article>
            <span class="landing-scenario-grid__icon is-warm"><TicketCheck :size="20" /></span>
            <small>03 · {{ t('landing.scenarios.handoffLabel') }}</small>
            <h3>{{ t('landing.scenarios.handoffTitle') }}</h3>
            <p>{{ t('landing.scenarios.handoffDescription') }}</p>
            <strong class="is-warm"
              ><Check :size="15" />{{ t('landing.scenarios.handoffResult') }}</strong
            >
          </article>
        </div>

        <div class="landing-demo-bridge">
          <div>
            <span>AVENLO · DEMO WORKSPACE</span>
            <strong>{{ t('landing.demo.title') }}</strong>
            <p>{{ t('landing.demo.description') }}</p>
          </div>
          <RouterLink class="landing-button landing-button--ink" to="/demo">
            {{ t('landing.demo.openDemo') }}<ArrowRight :size="17" />
          </RouterLink>
        </div>
      </div>
    </section>

    <section id="project-notes" class="landing-section landing-evaluation">
      <div class="landing-evaluation__copy">
        <p class="landing-eyebrow"><span></span>{{ t('landing.evaluation.eyebrow') }}</p>
        <h2>{{ t('landing.evaluation.title') }}</h2>
        <p>{{ t('landing.evaluation.description') }}</p>
        <small v-if="evaluation">
          {{ t('landing.evaluation.lastRun') }} ·
          {{ new Date(evaluation.completedAt).toLocaleDateString(locale) }} ·
          {{ t('landing.evaluation.sampleNote', { count: evaluation.metrics.total }) }}
        </small>
        <small v-else>{{ t('landing.evaluation.unavailable') }}</small>
        <p class="evaluation-scope">{{ t('presentation.evaluationNote') }}</p>
      </div>
      <div v-if="evaluation" class="landing-evaluation__score">
        <div>
          <strong>{{ evaluation.metrics.passed }}/{{ evaluation.metrics.total }}</strong>
          <span>{{ t('landing.evaluation.liveCases') }}</span>
        </div>
        <dl>
          <div>
            <dt>{{ t('landing.evaluation.citations') }}</dt>
            <dd>{{ Math.round((evaluation.metrics.citationCoverage ?? 0) * 100) }}%</dd>
          </div>
          <div>
            <dt>{{ t('landing.evaluation.refusal') }}</dt>
            <dd>{{ Math.round((evaluation.metrics.refusalHandoffRate ?? 0) * 100) }}%</dd>
          </div>
          <div>
            <dt>{{ t('landing.evaluation.tools') }}</dt>
            <dd>{{ Math.round((evaluation.metrics.toolSelectionAccuracy ?? 0) * 100) }}%</dd>
          </div>
          <div>
            <dt>{{ t('landing.evaluation.isolation') }}</dt>
            <dd>{{ Math.round((evaluation.metrics.isolationPassRate ?? 0) * 100) }}%</dd>
          </div>
        </dl>
      </div>
      <div v-else class="landing-evaluation__empty">
        <strong>{{
          t(
            showcaseStore.evaluationError
              ? 'landing.evaluation.unavailable'
              : 'landing.evaluation.noResult',
          )
        }}</strong>
        <p v-if="showcaseStore.evaluationError">{{ t('landing.evaluation.retryLater') }}</p>
      </div>
    </section>

    <section id="architecture" class="landing-section landing-architecture">
      <header class="landing-section__heading">
        <div>
          <p class="landing-eyebrow"><span></span>{{ t('landing.architecture.eyebrow') }}</p>
          <h2>{{ t('landing.architecture.title') }}</h2>
        </div>
        <p>{{ t('landing.architecture.description') }}</p>
      </header>
      <div class="architecture-track">
        <article>
          <MessageSquareText :size="20" /><span>Vue 3</span>
          <strong>{{ t('landing.architecture.interface') }}</strong>
        </article>
        <i><ArrowRight :size="16" /></i>
        <article>
          <GitBranch :size="20" /><span>Fastify</span>
          <strong>{{ t('landing.architecture.agent') }}</strong>
        </article>
        <i><ArrowRight :size="16" /></i>
        <article>
          <Database :size="20" /><span>PostgreSQL</span>
          <strong>{{ t('landing.architecture.retrieval') }}</strong>
        </article>
        <i><ArrowRight :size="16" /></i>
        <article>
          <LockKeyhole :size="20" /><span>RLS + HMAC</span>
          <strong>{{ t('landing.architecture.safety') }}</strong>
        </article>
      </div>
      <ul class="architecture-notes">
        <li><Check :size="15" />{{ t('landing.architecture.noteOne') }}</li>
        <li><Check :size="15" />{{ t('landing.architecture.noteTwo') }}</li>
        <li><Check :size="15" />{{ t('landing.architecture.noteThree') }}</li>
      </ul>
    </section>

    <section class="landing-cta">
      <div>
        <p class="landing-eyebrow"><span></span>{{ t('landing.cta.eyebrow') }}</p>
        <h2>{{ t('landing.cta.title') }}</h2>
        <p>{{ t('landing.cta.description') }}</p>
      </div>
      <div>
        <RouterLink class="landing-button landing-button--primary" to="/demo">
          {{ t('landing.cta.demo') }}<ArrowRight :size="17" />
        </RouterLink>
        <a
          v-if="githubUrl"
          class="landing-button landing-button--secondary"
          :href="githubUrl"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
        <a
          v-if="contactUrl && contactUrl !== githubUrl"
          class="landing-button landing-button--secondary"
          :href="contactUrl"
          target="_blank"
          rel="noreferrer"
        >
          {{ t('landing.cta.contact') }}
        </a>
      </div>
    </section>
  </main>
</template>
