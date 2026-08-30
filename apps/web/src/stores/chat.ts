import {
  chatStreamEventSchema,
  publicChatFeedbackResponseSchema,
  type ChatCitation,
  type ChatStage,
  type ChatStageStatus,
  type ChatStreamEvent,
  type Locale,
  type FeedbackRating,
} from '@grounddesk/shared'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787'
const SESSION_STORAGE_KEY = 'grounddesk-public-chat-session'

interface StageEntry {
  stage: ChatStage
  status: ChatStageStatus
}

interface ToolEntry {
  toolName: 'order_lookup' | 'return_eligibility'
  status: Extract<ChatStreamEvent, { type: 'tool' }>['status']
  summary: string
  details: Extract<ChatStreamEvent, { type: 'tool' }>['details']
}

export interface ChatMessageView {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations: ChatCitation[]
  stages: StageEntry[]
  tools: ToolEntry[]
  streaming: boolean
  refused: boolean
  handedOff: boolean
  feedback: FeedbackRating | null
}

const getSessionId = (): string => {
  const saved = window.localStorage.getItem(SESSION_STORAGE_KEY)
  if (saved && /^[0-9a-f-]{36}$/i.test(saved)) return saved
  const sessionId = crypto.randomUUID()
  window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId)
  return sessionId
}

const readErrorMessage = async (response: Response): Promise<string> => {
  const payload: unknown = await response.json().catch(() => null)
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'message' in payload &&
    typeof payload.message === 'string'
  ) {
    return payload.message
  }
  return `Chat request failed with status ${response.status}.`
}

const streamReadResultSchema = {
  parse(value: unknown): { done: boolean; value?: Uint8Array } {
    if (typeof value !== 'object' || value === null || !('done' in value)) {
      throw new Error('The response stream returned an invalid chunk.')
    }
    const done: unknown = Reflect.get(value, 'done')
    const bytes: unknown = Reflect.get(value, 'value')
    if (typeof done !== 'boolean' || (bytes !== undefined && !(bytes instanceof Uint8Array))) {
      throw new Error('The response stream returned an invalid chunk.')
    }
    return bytes === undefined ? { done } : { done, value: bytes }
  },
}

export const useChatStore = defineStore('chat', () => {
  const sessionId = ref(getSessionId())
  const conversationId = ref<string | null>(null)
  const messages = ref<ChatMessageView[]>([])
  const isStreaming = ref(false)
  const error = ref<string | null>(null)

  const hasMessages = computed(() => messages.value.length > 0)

  const applyEvent = (message: ChatMessageView, streamEvent: ChatStreamEvent): void => {
    if (streamEvent.type === 'session') {
      conversationId.value = streamEvent.conversationId
      return
    }
    if (streamEvent.type === 'stage') {
      const existing = message.stages.find((entry) => entry.stage === streamEvent.stage)
      if (existing) existing.status = streamEvent.status
      else message.stages.push({ stage: streamEvent.stage, status: streamEvent.status })
      return
    }
    if (streamEvent.type === 'token') {
      message.content += streamEvent.delta
      return
    }
    if (streamEvent.type === 'citations') {
      for (const citation of streamEvent.citations) {
        const index = message.citations.findIndex(
          (candidate) => candidate.chunkId === citation.chunkId,
        )
        if (index >= 0) message.citations[index] = citation
        else message.citations.push(citation)
      }
      message.citations.sort((left, right) => left.ordinal - right.ordinal)
      return
    }
    if (streamEvent.type === 'tool') {
      message.tools.push(streamEvent)
      return
    }
    if (streamEvent.type === 'replace_answer') {
      message.content = streamEvent.content
      if (streamEvent.citations) message.citations = [...streamEvent.citations]
      return
    }
    if (streamEvent.type === 'done') {
      message.id = streamEvent.messageId
      message.refused = streamEvent.refused
      message.handedOff = streamEvent.handedOff
      message.streaming = false
      return
    }
    error.value = streamEvent.message
  }

  const sendMessage = async (rawMessage: string, locale: Locale): Promise<void> => {
    const content = rawMessage.trim()
    if (!content || isStreaming.value) return
    error.value = null
    isStreaming.value = true
    messages.value.push({
      id: crypto.randomUUID(),
      role: 'user',
      content,
      citations: [],
      stages: [],
      tools: [],
      streaming: false,
      refused: false,
      handedOff: false,
      feedback: null,
    })
    const assistant: ChatMessageView = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      citations: [],
      stages: [],
      tools: [],
      streaming: true,
      refused: false,
      handedOff: false,
      feedback: null,
    }
    messages.value.push(assistant)

    try {
      const response = await fetch(`${API_BASE_URL}/v1/public/workspaces/avenlo-demo/chat/stream`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId.value,
          ...(conversationId.value ? { conversationId: conversationId.value } : {}),
          message: content,
          locale,
        }),
      })
      if (!response.ok) throw new Error(await readErrorMessage(response))
      if (!response.body) throw new Error('The browser did not receive a response stream.')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const rawResult: unknown = await reader.read()
        const { done, value } = streamReadResultSchema.parse(rawResult)
        buffer += decoder.decode(value, { stream: !done })
        const lines = buffer.split(/\r?\n/)
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload: unknown = JSON.parse(line.slice(6))
          applyEvent(assistant, chatStreamEventSchema.parse(payload))
        }
        if (done) break
      }
      if (buffer.startsWith('data: ')) {
        const payload: unknown = JSON.parse(buffer.slice(6))
        applyEvent(assistant, chatStreamEventSchema.parse(payload))
      }
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'The chat request failed.'
      assistant.streaming = false
    } finally {
      isStreaming.value = false
    }
  }

  const resetConversation = (): void => {
    sessionId.value = crypto.randomUUID()
    window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId.value)
    conversationId.value = null
    messages.value = []
    error.value = null
  }

  const submitFeedback = async (
    message: ChatMessageView,
    rating: FeedbackRating,
  ): Promise<void> => {
    if (!conversationId.value || message.role !== 'assistant' || message.streaming) return
    error.value = null
    try {
      const response = await fetch(
        `${API_BASE_URL}/v1/public/workspaces/avenlo-demo/chat/feedback`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionId.value,
            conversationId: conversationId.value,
            messageId: message.id,
            rating,
          }),
        },
      )
      if (!response.ok) throw new Error(await readErrorMessage(response))
      publicChatFeedbackResponseSchema.parse(await response.json())
      message.feedback = rating
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Feedback submission failed.'
    }
  }

  return {
    conversationId,
    error,
    hasMessages,
    isStreaming,
    messages,
    resetConversation,
    sendMessage,
    submitFeedback,
  }
})
