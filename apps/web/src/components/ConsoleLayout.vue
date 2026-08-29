<script setup lang="ts">
import {
  BookOpenText,
  Gauge,
  LogOut,
  MessageSquareText,
  Settings,
  TicketCheck,
} from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { useAuthStore } from '../stores/auth'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const signOut = async (): Promise<void> => {
  await authStore.signOut()
  await router.replace('/login')
}
</script>

<template>
  <main class="console-layout">
    <aside class="console-sidebar">
      <div>
        <p class="console-sidebar__eyebrow">DEMO WORKSPACE</p>
        <strong>{{ authStore.activeMembership?.workspace.name }}</strong>
      </div>

      <nav :aria-label="t('console.navigation')">
        <RouterLink to="/console" :class="{ active: route.name === 'console' }">
          <Gauge :size="17" />{{ t('console.overview') }}
        </RouterLink>
        <RouterLink to="/console/knowledge" :class="{ active: route.name === 'console-knowledge' }">
          <BookOpenText :size="17" />{{ t('console.knowledge') }}
        </RouterLink>
        <span class="console-sidebar__disabled">
          <MessageSquareText :size="17" />{{ t('console.conversations') }}
        </span>
        <span class="console-sidebar__disabled">
          <TicketCheck :size="17" />{{ t('console.tickets') }}
        </span>
        <span class="console-sidebar__disabled">
          <Settings :size="17" />{{ t('console.settings') }}
        </span>
      </nav>

      <button class="console-sidebar__signout" type="button" @click="signOut">
        <LogOut :size="16" />{{ t('auth.signOut') }}
      </button>
    </aside>

    <section class="console-content">
      <RouterView />
    </section>
  </main>
</template>
