<script setup lang="ts">
import { LoaderCircle, Plus, Trash2, Users } from 'lucide-vue-next'
import { reactive } from 'vue'
import { useI18n } from 'vue-i18n'

import type { WorkspaceRole } from '@grounddesk/shared'

import { useWorkspaceStore } from '../stores/workspace'

const { t } = useI18n()
const workspaceStore = useWorkspaceStore()
const form = reactive<{ email: string; role: WorkspaceRole }>({ email: '', role: 'agent' })

const add = async (): Promise<void> => {
  if (await workspaceStore.addMember(form.email.trim(), form.role)) form.email = ''
}
</script>

<template>
  <article class="console-panel workspace-members-panel">
    <div class="console-panel__heading">
      <div>
        <p class="console-kicker">ROLE BOUNDARY</p>
        <h2>{{ t('settings.membersTitle') }}</h2>
      </div>
      <Users :size="20" />
    </div>
    <form class="member-add-form" @submit.prevent="add">
      <label>
        <span>{{ t('settings.memberEmail') }}</span>
        <input v-model.trim="form.email" type="email" required placeholder="agent@example.com" />
      </label>
      <label>
        <span>{{ t('settings.memberRole') }}</span>
        <select v-model="form.role">
          <option value="agent">{{ t('settings.role.agent') }}</option>
          <option value="admin">{{ t('settings.role.admin') }}</option>
        </select>
      </label>
      <button
        class="console-secondary-button"
        type="submit"
        :disabled="workspaceStore.isMutating || !form.email"
      >
        <LoaderCircle v-if="workspaceStore.isMutating" class="spin" :size="14" />
        <Plus v-else :size="14" />{{ t('settings.addMember') }}
      </button>
    </form>
    <div class="member-list">
      <div v-for="member in workspaceStore.members" :key="member.userId" class="member-row">
        <span class="member-avatar">{{ member.displayName.slice(0, 1).toUpperCase() }}</span>
        <span>
          <strong>{{ member.displayName }}</strong>
          <small>{{ member.email ?? member.userId.slice(0, 8) }}</small>
        </span>
        <select
          :value="member.role"
          :aria-label="t('settings.changeMemberRole', { name: member.displayName })"
          :disabled="workspaceStore.isMutating"
          @change="
            workspaceStore.updateMember(
              member.userId,
              ($event.target as HTMLSelectElement).value as WorkspaceRole,
            )
          "
        >
          <option value="agent">{{ t('settings.role.agent') }}</option>
          <option value="admin">{{ t('settings.role.admin') }}</option>
        </select>
        <button
          type="button"
          :aria-label="t('settings.removeMember', { name: member.displayName })"
          :disabled="workspaceStore.isMutating"
          @click="workspaceStore.removeMember(member.userId)"
        >
          <Trash2 :size="14" />
        </button>
      </div>
    </div>
  </article>
</template>
