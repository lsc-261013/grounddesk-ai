<script setup lang="ts">
import { ArrowRight, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-vue-next'
import { reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { isSupabaseConfigured } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const credentials = reactive({ email: '', password: '' })

const submit = async (): Promise<void> => {
  const signedIn = await authStore.signIn(credentials.email, credentials.password)
  if (signedIn) await router.replace('/console')
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-intro" aria-labelledby="login-heading">
      <p class="eyebrow">SECURE WORKSPACE ACCESS</p>
      <h1 id="login-heading">{{ t('auth.title') }}</h1>
      <p>{{ t('auth.description') }}</p>

      <ul class="trust-list">
        <li><ShieldCheck :size="18" />{{ t('auth.boundaryJwt') }}</li>
        <li><KeyRound :size="18" />{{ t('auth.boundaryRole') }}</li>
        <li><LockKeyhole :size="18" />{{ t('auth.boundaryIsolation') }}</li>
      </ul>
    </section>

    <form class="auth-card" @submit.prevent="submit">
      <div>
        <p class="auth-card__kicker">DEMO WORKSPACE</p>
        <h2>{{ t('auth.formTitle') }}</h2>
        <p class="auth-card__description">{{ t('auth.formDescription') }}</p>
      </div>

      <label class="field">
        <span>{{ t('auth.email') }}</span>
        <input
          v-model.trim="credentials.email"
          type="email"
          autocomplete="username"
          required
          :placeholder="t('auth.emailPlaceholder')"
        />
      </label>

      <label class="field">
        <span>{{ t('auth.password') }}</span>
        <input
          v-model="credentials.password"
          type="password"
          autocomplete="current-password"
          minlength="8"
          required
          :placeholder="t('auth.passwordPlaceholder')"
        />
      </label>

      <p v-if="!isSupabaseConfigured" class="form-message form-message--warning" role="alert">
        {{ t('auth.notConfigured') }}
      </p>
      <p v-else-if="authStore.error" class="form-message" role="alert">
        {{ t('auth.signInError') }}
      </p>

      <button
        class="primary-button"
        type="submit"
        :disabled="authStore.isSubmitting || !isSupabaseConfigured"
      >
        <span>{{ authStore.isSubmitting ? t('auth.signingIn') : t('auth.signIn') }}</span>
        <ArrowRight :size="17" aria-hidden="true" />
      </button>
    </form>
  </main>
</template>
