<script setup lang="ts">
import { ArrowRight, Building2, ShieldCheck } from 'lucide-vue-next'
import { computed, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import type { Locale } from '@grounddesk/shared'

import { useAuthStore } from '../stores/auth'

const { locale, t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const form = reactive({ name: '', slug: '' })
const normalizedSlug = computed(() =>
  form.slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, ''),
)

const submit = async (): Promise<void> => {
  if (await authStore.onboard(form.name, normalizedSlug.value, locale.value as Locale)) {
    await router.replace('/console')
  }
}
</script>

<template>
  <main class="auth-page onboarding-page">
    <section class="auth-intro" aria-labelledby="onboarding-heading">
      <p class="eyebrow">TENANT BOUNDARY</p>
      <h1 id="onboarding-heading">{{ t('auth.onboardingTitle') }}</h1>
      <p>{{ t('auth.onboardingDescription') }}</p>
      <ul class="trust-list">
        <li><Building2 :size="18" />{{ t('auth.onboardingWorkspace') }}</li>
        <li><ShieldCheck :size="18" />{{ t('auth.onboardingAdmin') }}</li>
      </ul>
    </section>
    <form class="auth-card" @submit.prevent="submit">
      <div>
        <p class="auth-card__kicker">FIRST WORKSPACE</p>
        <h2>{{ t('auth.onboardingFormTitle') }}</h2>
      </div>
      <label class="field">
        <span>{{ t('auth.workspaceName') }}</span>
        <input v-model.trim="form.name" required minlength="2" maxlength="80" />
      </label>
      <label class="field">
        <span>{{ t('auth.workspaceSlug') }}</span>
        <input v-model.trim="form.slug" required pattern="[a-zA-Z0-9-]+" />
        <small>{{ normalizedSlug || t('auth.workspaceSlugPreview') }}</small>
      </label>
      <p v-if="authStore.error" class="form-message" role="alert">
        {{ t('auth.onboardingError') }}
      </p>
      <button
        class="primary-button"
        type="submit"
        :disabled="authStore.isSubmitting || form.name.length < 2 || !normalizedSlug"
      >
        <span>{{
          authStore.isSubmitting ? t('auth.creatingWorkspace') : t('auth.createWorkspace')
        }}</span>
        <ArrowRight :size="17" />
      </button>
    </form>
  </main>
</template>
