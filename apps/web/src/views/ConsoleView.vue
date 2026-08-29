<script setup lang="ts">
import { ArrowUpRight, BookOpenText, ShieldCheck, UsersRound } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useAuthStore } from '../stores/auth'

const { t } = useI18n()
const authStore = useAuthStore()
const role = computed(() => authStore.activeMembership?.role ?? 'agent')
</script>

<template>
  <div class="console-overview">
    <header class="console-page-heading">
      <div>
        <p class="console-kicker">MILESTONE 2 · VERIFIED</p>
        <h1>{{ t('console.title') }}</h1>
        <p>{{ t('console.description') }}</p>
      </div>
      <span class="role-chip"><ShieldCheck :size="15" />{{ role }}</span>
    </header>

    <section class="console-overview__grid">
      <article>
        <BookOpenText :size="20" />
        <span>{{ t('console.knowledge') }}</span>
        <strong>{{ t('console.readyForUse') }}</strong>
        <RouterLink to="/console/knowledge">
          {{ t('console.openModule') }}<ArrowUpRight :size="14" />
        </RouterLink>
      </article>
      <article>
        <UsersRound :size="20" />
        <span>{{ t('console.role') }}</span>
        <strong>{{ role }}</strong>
        <small>{{ t('console.roleSource') }}</small>
      </article>
    </section>
  </div>
</template>
