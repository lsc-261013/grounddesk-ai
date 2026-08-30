<script setup lang="ts">
import { Check, LoaderCircle, SlidersHorizontal } from 'lucide-vue-next'
import { reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Locale } from '@grounddesk/shared'

import { useWorkspaceStore } from '../stores/workspace'

const { t } = useI18n()
const workspaceStore = useWorkspaceStore()
const saved = ref(false)
const form = reactive<{ name: string; defaultLocale: Locale; confidenceThreshold: number }>({
  name: '',
  defaultLocale: 'zh-CN',
  confidenceThreshold: 0.6,
})

watch(
  () => workspaceStore.workspace,
  (workspace) => {
    if (!workspace) return
    form.name = workspace.name
    form.defaultLocale = workspace.defaultLocale
    form.confidenceThreshold = workspace.confidenceThreshold
  },
  { immediate: true },
)

const save = async (): Promise<void> => {
  saved.value = await workspaceStore.save(form)
  if (saved.value) window.setTimeout(() => (saved.value = false), 1_800)
}
</script>

<template>
  <article class="console-panel workspace-settings-panel">
    <div class="console-panel__heading">
      <div>
        <p class="console-kicker">WORKSPACE POLICY</p>
        <h2>{{ t('settings.workspaceTitle') }}</h2>
      </div>
      <SlidersHorizontal :size="20" />
    </div>
    <form @submit.prevent="save">
      <label>
        <span>{{ t('settings.workspaceName') }}</span>
        <input v-model.trim="form.name" required minlength="2" maxlength="80" />
      </label>
      <label>
        <span>{{ t('settings.defaultLocale') }}</span>
        <select v-model="form.defaultLocale">
          <option value="zh-CN">简体中文</option>
          <option value="en-US">English</option>
        </select>
      </label>
      <label>
        <span>{{ t('settings.confidenceThreshold') }}</span>
        <strong>{{ Math.round(form.confidenceThreshold * 100) }}%</strong>
        <input
          v-model.number="form.confidenceThreshold"
          type="range"
          min="0.3"
          max="0.95"
          step="0.01"
        />
        <small>{{ t('settings.confidenceHelp') }}</small>
      </label>
      <button
        class="console-primary-button"
        type="submit"
        :disabled="workspaceStore.isMutating || form.name.length < 2"
      >
        <Check v-if="saved" :size="14" />
        <LoaderCircle v-else-if="workspaceStore.isMutating" class="spin" :size="14" />
        <SlidersHorizontal v-else :size="14" />
        {{ saved ? t('common.saved') : t('common.save') }}
      </button>
    </form>
  </article>
</template>
