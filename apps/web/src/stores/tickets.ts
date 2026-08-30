import {
  assignableAgentsResponseSchema,
  ticketDetailResponseSchema,
  ticketListResponseSchema,
  type TicketAssignee,
  type TicketDetail,
  type TicketPriority,
  type TicketStatus,
  type TicketSummary,
} from '@grounddesk/shared'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import { authenticatedApi, workspaceId } from '../lib/api'

export const useTicketStore = defineStore('tickets', () => {
  const tickets = ref<TicketSummary[]>([])
  const agents = ref<TicketAssignee[]>([])
  const selected = ref<TicketDetail | null>(null)
  const isLoading = ref(false)
  const isMutating = ref(false)
  const error = ref<string | null>(null)

  const load = async (): Promise<void> => {
    isLoading.value = true
    error.value = null
    try {
      const response = await authenticatedApi(`/v1/workspaces/${workspaceId()}/tickets`)
      tickets.value = ticketListResponseSchema.parse(await response.json()).tickets
      if (selected.value) {
        const stillVisible = tickets.value.some((ticket) => ticket.id === selected.value?.id)
        if (!stillVisible) selected.value = null
      }
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Ticket loading failed.'
    } finally {
      isLoading.value = false
    }
  }

  const open = async (ticketId: string): Promise<void> => {
    isLoading.value = true
    error.value = null
    try {
      const response = await authenticatedApi(`/v1/workspaces/${workspaceId()}/tickets/${ticketId}`)
      selected.value = ticketDetailResponseSchema.parse(await response.json()).ticket
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Ticket detail loading failed.'
    } finally {
      isLoading.value = false
    }
  }

  const loadAgents = async (): Promise<void> => {
    try {
      const response = await authenticatedApi(`/v1/workspaces/${workspaceId()}/tickets/agents`)
      agents.value = assignableAgentsResponseSchema.parse(await response.json()).agents
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Agent loading failed.'
    }
  }

  const mutate = async (path: string, init: RequestInit): Promise<boolean> => {
    isMutating.value = true
    error.value = null
    try {
      const response = await authenticatedApi(path, init)
      selected.value = ticketDetailResponseSchema.parse(await response.json()).ticket
      await load()
      return true
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Ticket update failed.'
      return false
    } finally {
      isMutating.value = false
    }
  }

  const reply = (ticketId: string, body: string): Promise<boolean> =>
    mutate(`/v1/workspaces/${workspaceId()}/tickets/${ticketId}/replies`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    })

  const setStatus = (ticketId: string, status: TicketStatus): Promise<boolean> =>
    mutate(`/v1/workspaces/${workspaceId()}/tickets/${ticketId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })

  const assign = (
    ticketId: string,
    assignedTo: string | null,
    priority: TicketPriority,
  ): Promise<boolean> =>
    mutate(`/v1/workspaces/${workspaceId()}/tickets/${ticketId}/assignment`, {
      method: 'PATCH',
      body: JSON.stringify({ assignedTo, priority }),
    })

  const closeDetail = (): void => {
    selected.value = null
  }

  return {
    agents,
    assign,
    closeDetail,
    error,
    isLoading,
    isMutating,
    load,
    loadAgents,
    open,
    reply,
    selected,
    setStatus,
    tickets,
  }
})
