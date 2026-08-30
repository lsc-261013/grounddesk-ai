<script setup lang="ts">
import { Check, LoaderCircle, RotateCcw, ShieldAlert } from 'lucide-vue-next'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useWorkspaceStore } from '../stores/workspace'

const { t } = useI18n()
const workspaceStore = useWorkspaceStore()
const confirmation = ref('')
const resetComplete = ref(false)

const reset = async (): Promise<void> => {
  if (confirmation.value !== 'RESET') return
  resetComplete.value = await workspaceStore.resetDemo()
  if (resetComplete.value) confirmation.value = ''
}
</script>

<template>
  <article v-if="workspaceStore.workspace?.isDemo" class="console-panel demo-reset-panel">
    <div class="console-panel__heading">
      <div>
        <p class="console-kicker">RESETTABLE SIMULATION</p>
        <h2>{{ t('settings.resetTitle') }}</h2>
      </div>
      <ShieldAlert :size="20" />
    </div>
    <p>{{ t('settings.resetDescription') }}</p>
    <label>
      <span>{{ t('settings.resetConfirmation') }}</span>
      <input v-model="confirmation" autocomplete="off" placeholder="RESET" />
    </label>
    <button
      class="console-danger-button"
      type="button"
      :disabled="workspaceStore.isMutating || confirmation !== 'RESET'"
      @click="reset"
    >
      <LoaderCircle v-if="workspaceStore.isMutating" class="spin" :size="14" />
      <Check v-else-if="resetComplete" :size="14" />
      <RotateCcw v-else :size="14" />
      {{ resetComplete ? t('settings.resetComplete') : t('settings.resetAction') }}
    </button>
  </article>
</template>
