<script setup lang="ts">
import { LogOut, ShieldCheck, UserRoundCog } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { useAuthStore } from '../stores/auth'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()

const signOut = async (): Promise<void> => {
  await authStore.signOut()
  await router.replace('/login')
}
</script>

<template>
  <main class="console-page">
    <section class="console-card">
      <div class="console-card__icon"><ShieldCheck :size="24" /></div>
      <p class="eyebrow">AUTHENTICATED CONSOLE</p>
      <h1>{{ t('console.title') }}</h1>
      <p>{{ t('console.description') }}</p>

      <dl v-if="authStore.session && authStore.activeMembership" class="identity-grid">
        <div>
          <dt>{{ t('console.user') }}</dt>
          <dd>{{ authStore.session.profile.displayName }}</dd>
        </div>
        <div>
          <dt>{{ t('console.workspace') }}</dt>
          <dd>{{ authStore.activeMembership.workspace.name }}</dd>
        </div>
        <div>
          <dt>{{ t('console.role') }}</dt>
          <dd class="role-label">
            <UserRoundCog :size="15" />{{ authStore.activeMembership.role }}
          </dd>
        </div>
      </dl>

      <button class="secondary-button" type="button" @click="signOut">
        <LogOut :size="16" />{{ t('auth.signOut') }}
      </button>
    </section>
  </main>
</template>
