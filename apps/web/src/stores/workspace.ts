import {
  demoResetResponseSchema,
  workspaceMemberListResponseSchema,
  workspaceMemberSchema,
  workspaceSettingsResponseSchema,
  type Locale,
  type WorkspaceMember,
  type WorkspaceRole,
  type WorkspaceSettings,
} from '@grounddesk/shared'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import { authenticatedApi, workspaceId } from '../lib/api'

export const useWorkspaceStore = defineStore('workspace-settings', () => {
  const workspace = ref<WorkspaceSettings | null>(null)
  const members = ref<WorkspaceMember[]>([])
  const isLoading = ref(false)
  const isMutating = ref(false)
  const error = ref<string | null>(null)

  const load = async (): Promise<void> => {
    isLoading.value = true
    error.value = null
    try {
      const id = workspaceId()
      const [workspaceResponse, membersResponse] = await Promise.all([
        authenticatedApi(`/v1/workspaces/${id}/settings`),
        authenticatedApi(`/v1/workspaces/${id}/members`),
      ])
      workspace.value = workspaceSettingsResponseSchema.parse(
        await workspaceResponse.json(),
      ).workspace
      members.value = workspaceMemberListResponseSchema.parse(await membersResponse.json()).members
    } catch (cause) {
      error.value =
        cause instanceof Error ? cause.message : 'Workspace settings could not be loaded.'
    } finally {
      isLoading.value = false
    }
  }

  const save = async (input: {
    name: string
    defaultLocale: Locale
    confidenceThreshold: number
  }): Promise<boolean> => {
    isMutating.value = true
    error.value = null
    try {
      const response = await authenticatedApi(`/v1/workspaces/${workspaceId()}/settings`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      })
      workspace.value = workspaceSettingsResponseSchema.parse(await response.json()).workspace
      return true
    } catch (cause) {
      error.value =
        cause instanceof Error ? cause.message : 'Workspace settings could not be saved.'
      return false
    } finally {
      isMutating.value = false
    }
  }

  const addMember = async (email: string, role: WorkspaceRole): Promise<boolean> => {
    isMutating.value = true
    error.value = null
    try {
      const response = await authenticatedApi(`/v1/workspaces/${workspaceId()}/members`, {
        method: 'POST',
        body: JSON.stringify({ email, role }),
      })
      const member = workspaceMemberSchema.parse(await response.json())
      members.value = [...members.value.filter((item) => item.userId !== member.userId), member]
      return true
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Member could not be added.'
      return false
    } finally {
      isMutating.value = false
    }
  }

  const updateMember = async (userId: string, role: WorkspaceRole): Promise<boolean> => {
    isMutating.value = true
    error.value = null
    try {
      const response = await authenticatedApi(`/v1/workspaces/${workspaceId()}/members/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      })
      const member = workspaceMemberSchema.parse(await response.json())
      const index = members.value.findIndex((item) => item.userId === userId)
      if (index >= 0) members.value[index] = member
      return true
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Member role could not be changed.'
      return false
    } finally {
      isMutating.value = false
    }
  }

  const removeMember = async (userId: string): Promise<boolean> => {
    isMutating.value = true
    error.value = null
    try {
      await authenticatedApi(`/v1/workspaces/${workspaceId()}/members/${userId}`, {
        method: 'DELETE',
      })
      members.value = members.value.filter((member) => member.userId !== userId)
      return true
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Member could not be removed.'
      return false
    } finally {
      isMutating.value = false
    }
  }

  const resetDemo = async (): Promise<boolean> => {
    isMutating.value = true
    error.value = null
    try {
      const response = await authenticatedApi(`/v1/workspaces/${workspaceId()}/demo-reset`, {
        method: 'POST',
      })
      demoResetResponseSchema.parse(await response.json())
      await load()
      return true
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Demo Workspace could not be reset.'
      return false
    } finally {
      isMutating.value = false
    }
  }

  return {
    addMember,
    error,
    isLoading,
    isMutating,
    load,
    members,
    removeMember,
    resetDemo,
    save,
    updateMember,
    workspace,
  }
})
