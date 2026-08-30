<script setup lang="ts">
import {
  ArrowRight,
  BookOpenCheck,
  Boxes,
  Check,
  Database,
  GitBranch,
  LockKeyhole,
  MessageSquareText,
  ShieldCheck,
  ShoppingBag,
  TicketCheck,
  Wrench,
} from 'lucide-vue-next'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import TrustFlowAnimation from '../components/TrustFlowAnimation.vue'
import { useShowcaseStore } from '../stores/showcase'

const { locale, t } = useI18n()
const showcaseStore = useShowcaseStore()
const featuredProducts = computed(() => showcaseStore.products.slice(0, 4))
const evaluation = computed(() => showcaseStore.evaluation)
const githubUrl = import.meta.env.VITE_GITHUB_URL

const productName = (product: (typeof showcaseStore.products)[number]): string =>
  locale.value === 'zh-CN' ? product.nameZh : product.nameEn
const productVisualId = (model: string): string =>
  ({
    'Airwave S1': 'airwave-s1',
    'Airwave S1 Pro': 'airwave-s1-pro',
    'Orbit H5': 'orbit-h5',
    'Flux 67': 'flux-67',
    'Flux 100': 'flux-100',
    'LinkCore C240': 'linkcore-c240',
    'Reserve 10K': 'reserve-10k',
    'Dockline 6': 'dockline-6',
  })[model] ?? 'airwave-s1'

onMounted(() => void showcaseStore.load())
</script>

<template>
  <main class="landing-page">
    <section class="landing-hero">
      <div class="landing-hero__copy">
        <p class="landing-eyebrow"><span></span>{{ t('landing.hero.eyebrow') }}</p>
        <h1>{{ t('landing.hero.title') }}</h1>
        <p class="landing-hero__lead">{{ t('landing.hero.description') }}</p>
        <div class="landing-actions">
          <RouterLink class="landing-button landing-button--primary" to="/demo">
            {{ t('landing.hero.primaryCta') }}<ArrowRight :size="16" />
          </RouterLink>
          <a class="landing-button landing-button--secondary" href="#evaluation">
            {{ t('landing.hero.secondaryCta') }}
          </a>
        </div>
        <ul class="landing-proof-list">
          <li><BookOpenCheck :size="15" />{{ t('landing.hero.proofCitation') }}</li>
          <li><Wrench :size="15" />{{ t('landing.hero.proofTool') }}</li>
          <li><TicketCheck :size="15" />{{ t('landing.hero.proofHandoff') }}</li>
        </ul>
      </div>
      <TrustFlowAnimation />
    </section>

    <section class="landing-trust-strip" aria-label="GroundDesk boundaries">
      <div>
        <span>01</span><strong>{{ t('landing.strip.grounded') }}</strong>
      </div>
      <div>
        <span>02</span><strong>{{ t('landing.strip.deterministic') }}</strong>
      </div>
      <div>
        <span>03</span><strong>{{ t('landing.strip.handoff') }}</strong>
      </div>
      <div>
        <span>04</span><strong>{{ t('landing.strip.isolated') }}</strong>
      </div>
    </section>

    <section class="landing-section landing-product-story">
      <header class="landing-section__heading">
        <div>
          <p class="landing-eyebrow"><span></span>AVENLO · DEMO WORKSPACE</p>
          <h2>{{ t('landing.demo.title') }}</h2>
        </div>
        <p>{{ t('landing.demo.description') }}</p>
      </header>
      <div class="landing-product-grid" :aria-busy="showcaseStore.isLoading">
        <article v-for="product in featuredProducts" :key="product.id">
          <span>{{ product.category }}</span>
          <svg viewBox="0 0 320 240" role="img" :aria-label="productName(product)">
            <use :href="`/products.svg#${productVisualId(product.model)}`" />
          </svg>
          <h3>{{ productName(product) }}</h3>
          <small>{{ product.model }} · {{ product.sku }}</small>
        </article>
        <div v-if="showcaseStore.isLoading" class="landing-product-loading">
          {{ t('landing.demo.loading') }}
        </div>
      </div>
      <div class="landing-demo-callout">
        <div>
          <ShoppingBag :size="18" />
          <span>
            <strong>{{ t('landing.demo.calloutTitle') }}</strong>
            <small>{{ t('landing.demo.calloutDescription') }}</small>
          </span>
        </div>
        <RouterLink to="/demo">
          {{ t('landing.demo.openDemo') }}<ArrowRight :size="15" />
        </RouterLink>
      </div>
    </section>

    <section id="evaluation" class="landing-section landing-evaluation">
      <div class="landing-evaluation__copy">
        <p class="landing-eyebrow"><span></span>{{ t('landing.evaluation.eyebrow') }}</p>
        <h2>{{ t('landing.evaluation.title') }}</h2>
        <p>{{ t('landing.evaluation.description') }}</p>
        <small v-if="evaluation"
          >{{ t('landing.evaluation.lastRun') }} ·
          {{ new Date(evaluation.completedAt).toLocaleDateString(locale) }}</small
        >
        <small v-else>{{ t('landing.evaluation.unavailable') }}</small>
      </div>
      <div v-if="evaluation" class="landing-evaluation__score">
        <div>
          <strong>{{ evaluation.metrics.passed }}/{{ evaluation.metrics.total }}</strong>
          <span>{{ t('landing.evaluation.liveCases') }}</span>
        </div>
        <dl>
          <div>
            <dt>Retrieval@5</dt>
            <dd>{{ Math.round((evaluation.metrics.retrievalAt5 ?? 0) * 100) }}%</dd>
          </div>
          <div>
            <dt>{{ t('landing.evaluation.citations') }}</dt>
            <dd>{{ Math.round((evaluation.metrics.citationCoverage ?? 0) * 100) }}%</dd>
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
      <div v-else class="landing-evaluation__empty">{{ t('landing.evaluation.noResult') }}</div>
    </section>

    <section id="architecture" class="landing-section landing-architecture">
      <header class="landing-section__heading">
        <div>
          <p class="landing-eyebrow"><span></span>EXPLICIT SYSTEM BOUNDARIES</p>
          <h2>{{ t('landing.architecture.title') }}</h2>
        </div>
        <p>{{ t('landing.architecture.description') }}</p>
      </header>
      <div class="architecture-track">
        <article>
          <MessageSquareText :size="19" /><span>Vue 3</span
          ><strong>{{ t('landing.architecture.interface') }}</strong>
        </article>
        <i><ArrowRight :size="15" /></i>
        <article>
          <GitBranch :size="19" /><span>Fastify</span
          ><strong>{{ t('landing.architecture.agent') }}</strong>
        </article>
        <i><ArrowRight :size="15" /></i>
        <article>
          <Database :size="19" /><span>PostgreSQL</span
          ><strong>{{ t('landing.architecture.retrieval') }}</strong>
        </article>
        <i><ArrowRight :size="15" /></i>
        <article>
          <LockKeyhole :size="19" /><span>RLS + HMAC</span
          ><strong>{{ t('landing.architecture.safety') }}</strong>
        </article>
      </div>
      <ul class="architecture-notes">
        <li><Check :size="14" />{{ t('landing.architecture.noteOne') }}</li>
        <li><Check :size="14" />{{ t('landing.architecture.noteTwo') }}</li>
        <li><Check :size="14" />{{ t('landing.architecture.noteThree') }}</li>
      </ul>
    </section>

    <section class="landing-section landing-use-cases">
      <div>
        <p class="landing-eyebrow"><span></span>{{ t('landing.useCases.eyebrow') }}</p>
        <h2>{{ t('landing.useCases.title') }}</h2>
      </div>
      <div class="use-case-list">
        <article>
          <span>01</span><Boxes :size="18" />
          <h3>{{ t('landing.useCases.commerce') }}</h3>
          <p>{{ t('landing.useCases.commerceDescription') }}</p>
        </article>
        <article>
          <span>02</span><ShieldCheck :size="18" />
          <h3>{{ t('landing.useCases.software') }}</h3>
          <p>{{ t('landing.useCases.softwareDescription') }}</p>
        </article>
        <article>
          <span>03</span><BookOpenCheck :size="18" />
          <h3>{{ t('landing.useCases.education') }}</h3>
          <p>{{ t('landing.useCases.educationDescription') }}</p>
        </article>
      </div>
    </section>

    <section class="landing-cta">
      <div>
        <p class="landing-eyebrow"><span></span>{{ t('landing.cta.eyebrow') }}</p>
        <h2>{{ t('landing.cta.title') }}</h2>
        <p>{{ t('landing.cta.description') }}</p>
      </div>
      <div>
        <RouterLink class="landing-button landing-button--primary" to="/demo">
          {{ t('landing.cta.demo') }}<ArrowRight :size="16" />
        </RouterLink>
        <a
          v-if="githubUrl"
          class="landing-button landing-button--secondary"
          :href="githubUrl"
          target="_blank"
          rel="noreferrer"
          >GitHub</a
        >
      </div>
    </section>
  </main>
</template>
