<script setup lang="ts">
import {
  BookOpenText,
  Bot,
  Boxes,
  Gauge,
  FlaskConical,
  LogOut,
  Menu,
  MessageSquareText,
  ShoppingBag,
  Settings,
  TicketCheck,
} from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { useAuthStore } from '../stores/auth'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const navigationOpen = ref(false)
const isAdmin = computed(() => authStore.activeMembership?.role === 'admin')

watch(
  () => route.fullPath,
  () => (navigationOpen.value = false),
)

const signOut = async (): Promise<void> => {
  await authStore.signOut()
  await router.replace('/login')
}
</script>

<template>
  <main class="console-layout">
    <header class="console-mobile-header">
      <button
        type="button"
        :aria-label="t('console.openNavigation')"
        @click="navigationOpen = true"
      >
        <Menu :size="19" />
      </button>
      <span>{{ authStore.activeMembership?.workspace.name }}</span>
    </header>
    <aside class="console-sidebar" :class="{ open: navigationOpen }">
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
        <RouterLink
          to="/console/conversations"
          :class="{ active: route.name === 'console-conversations' }"
        >
          <MessageSquareText :size="17" />{{ t('console.conversations') }}
        </RouterLink>
        <RouterLink
          to="/console/playground"
          :class="{ active: route.name === 'console-playground' }"
        >
          <Bot :size="17" />{{ t('console.playground') }}
        </RouterLink>
        <RouterLink
          v-if="isAdmin"
          to="/console/products"
          :class="{ active: route.name === 'console-products' }"
        >
          <Boxes :size="17" />{{ t('console.products') }}
        </RouterLink>
        <RouterLink to="/console/orders" :class="{ active: route.name === 'console-orders' }">
          <ShoppingBag :size="17" />{{ t('console.orders') }}
        </RouterLink>
        <RouterLink to="/console/tickets" :class="{ active: route.name === 'console-tickets' }">
          <TicketCheck :size="17" />{{ t('console.tickets') }}
        </RouterLink>
        <RouterLink
          v-if="isAdmin"
          to="/console/evaluations"
          :class="{ active: route.name === 'console-evaluations' }"
        >
          <FlaskConical :size="17" />{{ t('console.evaluations') }}
        </RouterLink>
        <RouterLink
          v-if="isAdmin"
          to="/console/settings"
          :class="{ active: route.name === 'console-settings' }"
        >
          <Settings :size="17" />{{ t('console.settings') }}
        </RouterLink>
      </nav>

      <button class="console-sidebar__signout" type="button" @click="signOut">
        <LogOut :size="16" />{{ t('auth.signOut') }}
      </button>
    </aside>

    <button
      v-if="navigationOpen"
      class="console-nav-backdrop"
      type="button"
      :aria-label="t('common.close')"
      @click="navigationOpen = false"
    ></button>

    <section class="console-content">
      <RouterView />
    </section>
  </main>
</template>
