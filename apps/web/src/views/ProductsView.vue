<script setup lang="ts">
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  LoaderCircle,
  PackagePlus,
  PencilLine,
  ShieldCheck,
  X,
} from 'lucide-vue-next'
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ConsoleProduct, ProductMutationInput } from '@grounddesk/shared'

import { useAuthStore } from '../stores/auth'
import { useProductStore } from '../stores/products'

const { locale, t } = useI18n()
const authStore = useAuthStore()
const productStore = useProductStore()
const dialog = ref<HTMLDialogElement | null>(null)
const editingId = ref<string | null>(null)
const formError = ref<string | null>(null)
const saved = ref(false)
const isAdmin = computed(() => authStore.activeMembership?.role === 'admin')

const form = reactive({
  sku: '',
  model: '',
  category: '',
  nameZh: '',
  nameEn: '',
  descriptionZh: '',
  descriptionEn: '',
  price: '',
  currency: 'USD',
  specsJson: '{}',
  isReturnable: true,
  openedReturnPolicy: 'standard',
  isActive: true,
})

const productName = (product: ConsoleProduct): string =>
  locale.value === 'zh-CN' ? product.nameZh : product.nameEn
const productDescription = (product: ConsoleProduct): string =>
  locale.value === 'zh-CN' ? product.descriptionZh : product.descriptionEn
const formatMoney = (product: ConsoleProduct): string =>
  new Intl.NumberFormat(locale.value, { style: 'currency', currency: product.currency }).format(
    product.priceCents / 100,
  )

const resetForm = (product?: ConsoleProduct): void => {
  editingId.value = product?.id ?? null
  Object.assign(form, {
    sku: product?.sku ?? '',
    model: product?.model ?? '',
    category: product?.category ?? '',
    nameZh: product?.nameZh ?? '',
    nameEn: product?.nameEn ?? '',
    descriptionZh: product?.descriptionZh ?? '',
    descriptionEn: product?.descriptionEn ?? '',
    price: product ? (product.priceCents / 100).toFixed(2) : '',
    currency: product?.currency ?? 'USD',
    specsJson: JSON.stringify(product?.specs ?? {}, null, 2),
    isReturnable: product?.isReturnable ?? true,
    openedReturnPolicy: product?.openedReturnPolicy ?? 'standard',
    isActive: product?.isActive ?? true,
  })
  formError.value = null
  saved.value = false
}

const openEditor = async (product?: ConsoleProduct): Promise<void> => {
  resetForm(product)
  await nextTick()
  dialog.value?.showModal()
}

const closeEditor = (): void => dialog.value?.close()

const productInput = (): ProductMutationInput | null => {
  try {
    const specs: unknown = JSON.parse(form.specsJson)
    if (typeof specs !== 'object' || specs === null || Array.isArray(specs)) throw new Error()
    const price = Number(form.price)
    if (!Number.isFinite(price) || price < 0) throw new Error()
    return {
      sku: form.sku.trim().toUpperCase(),
      model: form.model.trim(),
      category: form.category.trim().toLowerCase(),
      nameZh: form.nameZh.trim(),
      nameEn: form.nameEn.trim(),
      descriptionZh: form.descriptionZh.trim(),
      descriptionEn: form.descriptionEn.trim(),
      priceCents: Math.round(price * 100),
      currency: form.currency.trim().toUpperCase(),
      specs: specs as Record<string, unknown>,
      isReturnable: form.isReturnable,
      openedReturnPolicy: form.openedReturnPolicy,
      isActive: form.isActive,
    }
  } catch {
    formError.value = t('products.invalidForm')
    return null
  }
}

const save = async (): Promise<void> => {
  const input = productInput()
  if (!input) return
  if (await productStore.save(editingId.value, input)) {
    saved.value = true
    window.setTimeout(closeEditor, 500)
  }
}

onMounted(() => {
  if (isAdmin.value) void productStore.load()
})
</script>

<template>
  <div class="console-page products-page">
    <header class="console-page-heading">
      <div>
        <p class="console-kicker">CATALOG CONTROL · VERSIONED KNOWLEDGE INPUT</p>
        <h1>{{ t('products.title') }}</h1>
        <p>{{ t('products.description') }}</p>
      </div>
      <button v-if="isAdmin" class="console-primary-button" type="button" @click="openEditor()">
        <PackagePlus :size="15" />{{ t('products.add') }}
      </button>
    </header>

    <section v-if="!isAdmin" class="console-panel no-permission">
      <ShieldCheck :size="24" />
      <h2>{{ t('products.noPermissionTitle') }}</h2>
      <p>{{ t('products.noPermissionDescription') }}</p>
    </section>
    <template v-else>
      <p v-if="productStore.error" class="console-alert" role="alert">
        <AlertCircle :size="17" />{{ productStore.error }}
      </p>
      <section v-if="productStore.isLoading" class="console-panel console-empty">
        <LoaderCircle class="spin" :size="18" />{{ t('products.loading') }}
      </section>
      <section v-else-if="productStore.products.length === 0" class="console-panel console-empty">
        <PackagePlus :size="24" />
        <strong>{{ t('products.emptyTitle') }}</strong>
        <span>{{ t('products.emptyDescription') }}</span>
      </section>
      <section v-else class="product-admin-grid">
        <article
          v-for="product in productStore.products"
          :key="product.id"
          class="console-panel product-admin-card"
          :class="{ archived: !product.isActive }"
        >
          <header>
            <div>
              <span>{{ product.category.replaceAll('_', ' ') }}</span>
              <h2>{{ productName(product) }}</h2>
              <code>{{ product.model }} · {{ product.sku }}</code>
            </div>
            <button type="button" :aria-label="t('products.edit')" @click="openEditor(product)">
              <PencilLine :size="15" />
            </button>
          </header>
          <p>{{ productDescription(product) }}</p>
          <footer>
            <strong>{{ formatMoney(product) }}</strong>
            <span :data-active="product.isActive">
              <CheckCircle2 v-if="product.isActive" :size="13" /><Archive v-else :size="13" />
              {{ product.isActive ? t('products.active') : t('products.archived') }}
            </span>
          </footer>
        </article>
      </section>
    </template>

    <dialog ref="dialog" class="product-dialog" @close="formError = null">
      <form method="dialog" class="product-dialog__close">
        <button type="submit" :aria-label="t('common.close')"><X :size="17" /></button>
      </form>
      <header>
        <p class="console-kicker">{{ editingId ? 'EDIT PRODUCT' : 'NEW PRODUCT' }}</p>
        <h2>{{ editingId ? t('products.editTitle') : t('products.createTitle') }}</h2>
        <p>{{ t('products.formDescription') }}</p>
      </header>
      <form class="product-form" @submit.prevent="save">
        <label><span>SKU</span><input v-model="form.sku" required maxlength="80" /></label>
        <label
          ><span>{{ t('products.model') }}</span
          ><input v-model="form.model" required
        /></label>
        <label
          ><span>{{ t('products.category') }}</span
          ><input v-model="form.category" required
        /></label>
        <label
          ><span>{{ t('products.price') }}</span
          ><input v-model="form.price" type="number" min="0" step="0.01" required
        /></label>
        <label
          ><span>{{ t('products.nameZh') }}</span
          ><input v-model="form.nameZh" required
        /></label>
        <label
          ><span>{{ t('products.nameEn') }}</span
          ><input v-model="form.nameEn" required
        /></label>
        <label class="product-form__wide"
          ><span>{{ t('products.descriptionZh') }}</span
          ><textarea v-model="form.descriptionZh" required rows="3"></textarea>
        </label>
        <label class="product-form__wide"
          ><span>{{ t('products.descriptionEn') }}</span
          ><textarea v-model="form.descriptionEn" required rows="3"></textarea>
        </label>
        <label
          ><span>{{ t('products.currency') }}</span
          ><input v-model="form.currency" required maxlength="3"
        /></label>
        <label
          ><span>{{ t('products.returnPolicy') }}</span
          ><select v-model="form.openedReturnPolicy">
            <option value="standard">standard</option>
            <option value="sealed_audio">sealed_audio</option>
            <option value="opened_audio_review">opened_audio_review</option>
            <option value="battery_product">battery_product</option>
          </select></label
        >
        <label class="product-form__wide"
          ><span>{{ t('products.specs') }}</span
          ><textarea v-model="form.specsJson" required rows="6" spellcheck="false"></textarea>
        </label>
        <label class="product-check"
          ><input v-model="form.isReturnable" type="checkbox" />{{
            t('products.returnable')
          }}</label
        >
        <label class="product-check"
          ><input v-model="form.isActive" type="checkbox" />{{ t('products.visible') }}</label
        >
        <p
          v-if="formError || productStore.error"
          class="console-alert product-form__wide"
          role="alert"
        >
          <AlertCircle :size="16" />{{ formError ?? productStore.error }}
        </p>
        <p v-if="saved" class="product-success product-form__wide" role="status">
          <CheckCircle2 :size="16" />{{ t('products.saved') }}
        </p>
        <div class="product-form__actions product-form__wide">
          <button class="console-secondary-button" type="button" @click="closeEditor">
            {{ t('common.cancel') }}
          </button>
          <button class="console-primary-button" type="submit" :disabled="productStore.isMutating">
            <LoaderCircle v-if="productStore.isMutating" class="spin" :size="14" />{{
              t('products.save')
            }}
          </button>
        </div>
      </form>
    </dialog>
  </div>
</template>
