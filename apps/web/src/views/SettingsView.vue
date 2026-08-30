<script setup lang="ts">
import { AlertCircle, Check, Copy, LoaderCircle, Send, ShieldCheck, Webhook } from 'lucide-vue-next'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { WEBHOOK_EVENTS, type WebhookEvent } from '@grounddesk/shared'

import { useAuthStore } from '../stores/auth'
import { useWebhookStore } from '../stores/webhooks'

const { locale, t } = useI18n()
const authStore = useAuthStore()
const webhookStore = useWebhookStore()
const isAdmin = computed(() => authStore.activeMembership?.role === 'admin')
const copied = ref(false)
const form = reactive({
  url: '',
  events: [...WEBHOOK_EVENTS.filter((event) => event !== 'webhook.test')] as WebhookEvent[],
})

const formatDate = (value: string): string =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  )

const createEndpoint = async (): Promise<void> => {
  if (await webhookStore.create(form.url.trim(), form.events)) form.url = ''
}

const copySecret = async (): Promise<void> => {
  if (!webhookStore.revealedSecret) return
  await navigator.clipboard.writeText(webhookStore.revealedSecret)
  copied.value = true
  window.setTimeout(() => (copied.value = false), 1_600)
}

onMounted(() => {
  if (isAdmin.value) void webhookStore.load()
})
</script>

<template>
  <div class="settings-page">
    <header class="console-page-heading">
      <div>
        <p class="console-kicker">SIGNED OUTBOUND EVENTS · ADMIN ONLY</p>
        <h1>{{ t('settings.title') }}</h1>
        <p>{{ t('settings.description') }}</p>
      </div>
      <span class="role-chip"><ShieldCheck :size="15" />admin</span>
    </header>

    <section v-if="!isAdmin" class="console-panel no-permission">
      <ShieldCheck :size="24" />
      <h2>{{ t('settings.noPermissionTitle') }}</h2>
      <p>{{ t('settings.noPermissionDescription') }}</p>
    </section>

    <template v-else>
      <p v-if="webhookStore.error" class="console-alert" role="alert">
        <AlertCircle :size="17" />{{ t('settings.error') }}
      </p>
      <section v-if="webhookStore.revealedSecret" class="secret-notice" role="status">
        <div>
          <p class="console-kicker">ONE-TIME SIGNING SECRET</p>
          <h2>{{ t('settings.secretTitle') }}</h2>
          <p>{{ t('settings.secretDescription') }}</p>
        </div>
        <code>{{ webhookStore.revealedSecret }}</code>
        <button class="console-secondary-button" type="button" @click="copySecret">
          <Check v-if="copied" :size="14" /><Copy v-else :size="14" />{{
            copied ? t('common.copied') : t('common.copy')
          }}
        </button>
      </section>

      <section class="settings-grid">
        <article class="console-panel webhook-create">
          <div class="console-panel__heading">
            <div>
              <p class="console-kicker">GENERIC WEBHOOK</p>
              <h2>{{ t('settings.createTitle') }}</h2>
            </div>
            <Webhook :size="20" />
          </div>
          <form @submit.prevent="createEndpoint">
            <label>
              <span>{{ t('settings.endpointUrl') }}</span>
              <input
                v-model.trim="form.url"
                type="url"
                required
                placeholder="https://example.com/hooks/grounddesk"
              />
            </label>
            <fieldset>
              <legend>{{ t('settings.events') }}</legend>
              <label
                v-for="event in WEBHOOK_EVENTS.filter((value) => value !== 'webhook.test')"
                :key="event"
              >
                <input v-model="form.events" type="checkbox" :value="event" />
                <span>{{ event }}</span>
              </label>
            </fieldset>
            <button
              class="console-primary-button"
              type="submit"
              :disabled="!form.url || form.events.length === 0 || webhookStore.isMutating"
            >
              <LoaderCircle v-if="webhookStore.isMutating" class="spin" :size="14" /><Webhook
                v-else
                :size="14"
              />{{ t('settings.create') }}
            </button>
          </form>
        </article>

        <article class="console-panel endpoint-list">
          <div class="console-panel__heading">
            <div>
              <p class="console-kicker">ACTIVE DESTINATIONS</p>
              <h2>{{ t('settings.endpoints') }}</h2>
            </div>
          </div>
          <p v-if="webhookStore.isLoading" class="console-empty">
            <LoaderCircle class="spin" :size="17" />{{ t('settings.loading') }}
          </p>
          <p v-else-if="webhookStore.endpoints.length === 0" class="console-empty">
            {{ t('settings.emptyEndpoints') }}
          </p>
          <div
            v-for="endpoint in webhookStore.endpoints"
            v-else
            :key="endpoint.id"
            class="endpoint-row"
          >
            <div>
              <strong>{{ endpoint.url }}</strong>
              <small>{{ endpoint.subscribedEvents.join(' · ') }} · {{ endpoint.secretHint }}</small>
            </div>
            <button
              class="console-secondary-button"
              type="button"
              :disabled="webhookStore.isMutating"
              @click="webhookStore.test(endpoint.id)"
            >
              <Send :size="13" />{{ t('settings.test') }}
            </button>
            <button
              class="toggle-button"
              type="button"
              :aria-pressed="endpoint.enabled"
              :disabled="webhookStore.isMutating"
              @click="webhookStore.setEnabled(endpoint.id, !endpoint.enabled)"
            >
              <span></span>{{ endpoint.enabled ? t('settings.enabled') : t('settings.disabled') }}
            </button>
          </div>
        </article>
      </section>

      <section class="console-panel delivery-list">
        <div class="console-panel__heading">
          <div>
            <p class="console-kicker">DELIVERY LOG</p>
            <h2>{{ t('settings.deliveries') }}</h2>
          </div>
        </div>
        <p v-if="webhookStore.deliveries.length === 0" class="console-empty">
          {{ t('settings.emptyDeliveries') }}
        </p>
        <div
          v-for="delivery in webhookStore.deliveries"
          v-else
          :key="delivery.id"
          class="delivery-row"
        >
          <span class="status-badge" :data-status="delivery.status">{{
            t(`settings.deliveryStatus.${delivery.status}`)
          }}</span>
          <span
            ><strong>{{ delivery.eventName }}</strong
            ><small>{{ delivery.endpointUrl }}</small></span
          >
          <span>{{ delivery.responseStatus ?? '—' }}</span>
          <span>{{ delivery.attemptCount }}/3</span>
          <time>{{ formatDate(delivery.updatedAt) }}</time>
        </div>
      </section>
    </template>
  </div>
</template>
