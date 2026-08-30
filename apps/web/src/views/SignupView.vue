<script setup lang="ts">
import { ArrowRight, CheckCircle2, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-vue-next'
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import type { Locale } from '@grounddesk/shared'

import { isSupabaseConfigured } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'

const { locale, t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const confirmationRequired = ref(false)
const form = reactive({ displayName: '', email: '', password: '' })

const submit = async (): Promise<void> => {
  const result = await authStore.signUp(
    form.email,
    form.password,
    form.displayName,
    locale.value as Locale,
  )
  confirmationRequired.value = result === 'confirmation_required'
  if (result === 'signed_in') await router.replace('/onboarding')
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-intro" aria-labelledby="signup-heading">
      <p class="eyebrow">REAL ACCOUNT · ISOLATED WORKSPACE</p>
      <h1 id="signup-heading">{{ t('auth.signupTitle') }}</h1>
      <p>{{ t('auth.signupDescription') }}</p>
      <ul class="trust-list">
        <li><ShieldCheck :size="18" />{{ t('auth.boundaryJwt') }}</li>
        <li><KeyRound :size="18" />{{ t('auth.boundaryRole') }}</li>
        <li><LockKeyhole :size="18" />{{ t('auth.boundaryIsolation') }}</li>
      </ul>
    </section>

    <form class="auth-card" @submit.prevent="submit">
      <div>
        <p class="auth-card__kicker">CREATE WORKSPACE OWNER</p>
        <h2>{{ t('auth.signupFormTitle') }}</h2>
        <p class="auth-card__description">{{ t('auth.signupFormDescription') }}</p>
      </div>
      <label class="field">
        <span>{{ t('auth.displayName') }}</span>
        <input v-model.trim="form.displayName" required minlength="1" maxlength="80" />
      </label>
      <label class="field">
        <span>{{ t('auth.email') }}</span>
        <input v-model.trim="form.email" type="email" autocomplete="username" required />
      </label>
      <label class="field">
        <span>{{ t('auth.password') }}</span>
        <input
          v-model="form.password"
          type="password"
          autocomplete="new-password"
          minlength="10"
          required
        />
        <small>{{ t('auth.passwordHelp') }}</small>
      </label>
      <p v-if="confirmationRequired" class="form-message form-message--success" role="status">
        <CheckCircle2 :size="16" />{{ t('auth.confirmationRequired') }}
      </p>
      <p v-else-if="authStore.error" class="form-message" role="alert">
        {{ t('auth.signupError') }}
      </p>
      <button
        class="primary-button"
        type="submit"
        :disabled="authStore.isSubmitting || !isSupabaseConfigured || confirmationRequired"
      >
        <span>{{
          authStore.isSubmitting ? t('auth.creatingAccount') : t('auth.createAccount')
        }}</span>
        <ArrowRight :size="17" />
      </button>
      <RouterLink class="auth-switch" to="/login">{{ t('auth.haveAccount') }}</RouterLink>
    </form>
  </main>
</template>
