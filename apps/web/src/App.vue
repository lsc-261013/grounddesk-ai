<script setup lang="ts">
import { Languages, ShieldCheck } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Locale } from '@grounddesk/shared'

import { persistLocale } from './i18n'
import { useAuthStore } from './stores/auth'

const { locale, t } = useI18n()
const authStore = useAuthStore()
const accessRoute = computed(() => (authStore.isAuthenticated ? '/console' : '/login'))
const accessLabel = computed(() =>
  authStore.isAuthenticated ? t('navigation.console') : t('navigation.signIn'),
)
const authorName = import.meta.env.VITE_AUTHOR_NAME?.trim()
const authorUrl =
  import.meta.env.VITE_CONTACT_URL?.trim() || import.meta.env.VITE_GITHUB_URL?.trim()

const toggleLocale = (): void => {
  const nextLocale: Locale = locale.value === 'zh-CN' ? 'en-US' : 'zh-CN'
  locale.value = nextLocale
  persistLocale(nextLocale)
}
</script>

<template>
  <div class="app-shell">
    <header class="site-header">
      <RouterLink class="brand" to="/" aria-label="GroundDesk home">
        <span class="brand__mark"><ShieldCheck :size="18" :stroke-width="1.8" /></span>
        <span>GroundDesk</span>
      </RouterLink>
      <nav class="site-header__actions" :aria-label="t('navigation.status')">
        <span class="demo-badge">Demo Workspace</span>
        <RouterLink class="access-link" :to="accessRoute">{{ accessLabel }}</RouterLink>
        <button class="locale-button" type="button" @click="toggleLocale">
          <Languages :size="16" aria-hidden="true" />
          <span>{{ t('locale') }}</span>
        </button>
      </nav>
    </header>

    <RouterView />

    <footer class="site-footer">
      <span>{{ t('footer') }}</span>
      <a v-if="authorName && authorUrl" :href="authorUrl" target="_blank" rel="noreferrer">
        {{ t('authorCredit', { name: authorName }) }}
      </a>
      <span v-else-if="authorName">{{ t('authorCredit', { name: authorName }) }}</span>
    </footer>
  </div>
</template>
