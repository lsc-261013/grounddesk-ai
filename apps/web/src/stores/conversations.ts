import {
  conversationDetailResponseSchema,
  conversationListResponseSchema,
  type ConversationDetail,
  type ConversationSummary,
} from '@grounddesk/shared'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import { authenticatedApi, workspaceId } from '../lib/api'

export const useConversationStore = defineStore('conversations', () => {
  const conversations = ref<ConversationSummary[]>([])
  const selected = ref<ConversationDetail | null>(null)
  const total = ref(0)
  const isLoading = ref(false)
  const isLoadingDetail = ref(false)
  const error = ref<string | null>(null)

  const load = async (): Promise<void> => {
    isLoading.value = true
    error.value = null
    try {
      const response = await authenticatedApi(`/v1/workspaces/${workspaceId()}/conversations`)
      const payload = conversationListResponseSchema.parse(await response.json())
      conversations.value = payload.conversations
      total.value = payload.total
      if (selected.value && !conversations.value.some((item) => item.id === selected.value?.id)) {
        selected.value = null
      }
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Conversations could not be loaded.'
    } finally {
      isLoading.value = false
    }
  }

  const select = async (conversationId: string): Promise<void> => {
    isLoadingDetail.value = true
    error.value = null
    try {
      const response = await authenticatedApi(
        `/v1/workspaces/${workspaceId()}/conversations/${conversationId}`,
      )
      selected.value = conversationDetailResponseSchema.parse(await response.json()).conversation
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Conversation could not be loaded.'
    } finally {
      isLoadingDetail.value = false
    }
  }

  return { conversations, error, isLoading, isLoadingDetail, load, select, selected, total }
})
