<script setup lang="ts">
import { Check, CircleDashed, Database, Server, Workflow } from 'lucide-vue-next'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSystemStore } from '../stores/system'

const { t } = useI18n()
const systemStore = useSystemStore()

const apiStateLabel = computed(() => t(`status.${systemStore.apiStatus}`))

onMounted(() => {
  void systemStore.checkHealth()
})
</script>

<template>
  <main>
    <section class="foundation-hero">
      <div class="foundation-hero__content">
        <p class="eyebrow">{{ t('hero.eyebrow') }}</p>
        <h1>{{ t('hero.title') }}</h1>
        <p class="foundation-hero__description">{{ t('hero.description') }}</p>
        <div class="milestone-label">
          <span class="milestone-label__line"></span>
          <span>{{ t('hero.milestone') }}</span>
        </div>
      </div>

      <aside class="foundation-panel" aria-labelledby="foundation-status-title">
        <div class="foundation-panel__heading">
          <div>
            <p class="eyebrow">SYSTEM FOUNDATION</p>
            <h2 id="foundation-status-title">{{ t('status.title') }}</h2>
          </div>
          <Workflow :size="23" :stroke-width="1.5" aria-hidden="true" />
        </div>
        <p class="foundation-panel__description">{{ t('status.description') }}</p>

        <ul class="status-list">
          <li>
            <span class="status-icon status-icon--ready"><Check :size="15" /></span>
            <span>{{ t('status.web') }}</span>
            <strong>{{ t('status.ready') }}</strong>
          </li>
          <li>
            <span
              class="status-icon"
              :class="
                systemStore.apiStatus === 'ready' ? 'status-icon--ready' : 'status-icon--pending'
              "
            >
              <Server v-if="systemStore.apiStatus === 'ready'" :size="15" />
              <CircleDashed v-else :size="15" />
            </span>
            <span>{{ t('status.api') }}</span>
            <strong>{{ apiStateLabel }}</strong>
          </li>
          <li>
            <span class="status-icon status-icon--pending"><Database :size="15" /></span>
            <span>{{ t('status.database') }}</span>
            <strong>{{ t('status.unavailable') }}</strong>
          </li>
        </ul>

        <p v-if="systemStore.error" class="connection-note" role="status">
          API offline mode: {{ systemStore.error }}
        </p>
      </aside>
    </section>
  </main>
</template>
