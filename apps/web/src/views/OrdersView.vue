<script setup lang="ts">
import { AlertCircle, LoaderCircle, PackageSearch, Search, Truck } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { ORDER_STATUSES, type OrderStatus } from '@grounddesk/shared'

import { useAuthStore } from '../stores/auth'
import { useOrderStore } from '../stores/orders'

const { locale, t } = useI18n()
const authStore = useAuthStore()
const orderStore = useOrderStore()
const query = ref('')
const status = ref<OrderStatus | ''>('')
const expandedId = ref<string | null>(null)
const isAdmin = computed(() => authStore.activeMembership?.role === 'admin')

const formatMoney = (cents: number, currency: string): string =>
  new Intl.NumberFormat(locale.value, { style: 'currency', currency }).format(cents / 100)

const formatDate = (value: string): string =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(value))

const load = (): Promise<void> => orderStore.load(query.value, status.value)

const updateStatus = async (orderId: string, event: Event): Promise<void> => {
  const nextStatus = (event.target as HTMLSelectElement).value as OrderStatus
  await orderStore.updateStatus(orderId, nextStatus)
}

onMounted(() => void load())
</script>

<template>
  <div class="console-page orders-page">
    <header class="console-page-heading">
      <div>
        <p class="console-kicker">{{ t('orders.kicker') }}</p>
        <h1>{{ t('orders.title') }}</h1>
        <p>{{ t('orders.description') }}</p>
      </div>
      <span class="metric-chip"><Truck :size="15" />{{ orderStore.total }}</span>
    </header>

    <form class="console-toolbar order-filters" @submit.prevent="load">
      <label class="console-search-field">
        <Search :size="16" />
        <span class="sr-only">{{ t('orders.searchLabel') }}</span>
        <input v-model="query" :placeholder="t('orders.searchPlaceholder')" />
      </label>
      <label>
        <span class="sr-only">{{ t('orders.statusFilter') }}</span>
        <select v-model="status" @change="load">
          <option value="">{{ t('orders.allStatuses') }}</option>
          <option v-for="value in ORDER_STATUSES" :key="value" :value="value">
            {{ t(`orders.status.${value}`) }}
          </option>
        </select>
      </label>
      <button class="console-secondary-button" type="submit">
        <Search :size="14" />{{ t('common.search') }}
      </button>
    </form>

    <p v-if="orderStore.error" class="console-alert" role="alert">
      <AlertCircle :size="17" />{{ orderStore.error }}
    </p>
    <section v-if="orderStore.isLoading" class="console-panel console-empty">
      <LoaderCircle class="spin" :size="18" />{{ t('orders.loading') }}
    </section>
    <section v-else-if="orderStore.orders.length === 0" class="console-panel console-empty">
      <PackageSearch :size="24" />
      <strong>{{ t('orders.emptyTitle') }}</strong>
      <span>{{ t('orders.emptyDescription') }}</span>
    </section>
    <section v-else class="console-panel order-table-panel">
      <div class="order-table order-table--header" aria-hidden="true">
        <span>{{ t('orders.order') }}</span>
        <span>{{ t('orders.customer') }}</span>
        <span>{{ t('orders.items') }}</span>
        <span>{{ t('orders.total') }}</span>
        <span>{{ t('orders.statusLabel') }}</span>
      </div>
      <article v-for="order in orderStore.orders" :key="order.id" class="order-record">
        <button
          class="order-table order-table--row"
          type="button"
          :aria-expanded="expandedId === order.id"
          @click="expandedId = expandedId === order.id ? null : order.id"
        >
          <span>
            <strong>{{ order.orderNumber }}</strong>
            <small>{{ formatDate(order.orderedAt) }}</small>
          </span>
          <span>
            <strong>{{ order.customerName }}</strong>
            <small>{{ order.customerEmail }}</small>
          </span>
          <span>{{ order.items.map((item) => item.model).join(' · ') }}</span>
          <strong>{{ formatMoney(order.totalCents, order.currency) }}</strong>
          <span class="status-badge" :data-status="order.status">
            {{ t(`orders.status.${order.status}`) }}
          </span>
        </button>
        <div v-if="expandedId === order.id" class="order-detail-strip">
          <div v-for="item in order.items" :key="item.id">
            <strong>{{ locale === 'zh-CN' ? item.nameZh : item.nameEn }}</strong>
            <span>{{ item.sku }} · ×{{ item.quantity }}</span>
            <span>{{ item.opened ? t('orders.opened') : t('orders.sealed') }}</span>
          </div>
          <dl>
            <div>
              <dt>{{ t('orders.destination') }}</dt>
              <dd>{{ order.shippingCountryCode }}</dd>
            </div>
            <div>
              <dt>{{ t('orders.tracking') }}</dt>
              <dd>{{ order.carrier ?? '—' }} · {{ order.trackingNumberMasked ?? '—' }}</dd>
            </div>
          </dl>
          <label v-if="isAdmin" class="order-status-editor">
            <span>{{ t('orders.changeStatus') }}</span>
            <select
              :value="order.status"
              :disabled="orderStore.isMutating"
              @change="updateStatus(order.id, $event)"
            >
              <option v-for="value in ORDER_STATUSES" :key="value" :value="value">
                {{ t(`orders.status.${value}`) }}
              </option>
            </select>
          </label>
        </div>
      </article>
    </section>
  </div>
</template>
