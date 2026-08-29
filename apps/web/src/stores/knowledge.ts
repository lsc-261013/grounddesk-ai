import {
  knowledgeChunkListResponseSchema,
  knowledgeDocumentListResponseSchema,
  knowledgeDocumentUploadResponseSchema,
  type KnowledgeChunkPreview,
  type KnowledgeDocument,
  type Locale,
} from '@grounddesk/shared'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import { useAuthStore } from './auth'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787'

interface UploadInput {
  file: File
  title: string
  language: Locale | 'bilingual'
}

export const useKnowledgeStore = defineStore('knowledge', () => {
  const documents = ref<KnowledgeDocument[]>([])
  const chunks = ref<KnowledgeChunkPreview[]>([])
  const selectedDocumentId = ref<string | null>(null)
  const isLoading = ref(false)
  const isUploading = ref(false)
  const isLoadingChunks = ref(false)
  const error = ref<string | null>(null)
  const notice = ref<'uploaded' | 'duplicate' | 'retrying' | null>(null)

  const request = async (path: string, init?: RequestInit): Promise<Response> => {
    const authStore = useAuthStore()
    const accessToken = authStore.accessToken
    if (!accessToken) throw new Error('Authentication session is unavailable.')

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...init?.headers,
        authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Knowledge request failed with status ${response.status}`)
    }
    return response
  }

  const workspaceId = (): string => {
    const id = useAuthStore().activeMembership?.workspace.id
    if (!id) throw new Error('Workspace membership is unavailable.')
    return id
  }

  const loadDocuments = async (): Promise<void> => {
    isLoading.value = true
    error.value = null
    try {
      const response = await request(`/v1/workspaces/${workspaceId()}/knowledge/documents`)
      documents.value = knowledgeDocumentListResponseSchema.parse(await response.json()).documents
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Document loading failed.'
    } finally {
      isLoading.value = false
    }
  }

  const uploadDocument = async (input: UploadInput): Promise<boolean> => {
    isUploading.value = true
    error.value = null
    notice.value = null
    const formData = new FormData()
    formData.append('file', input.file)
    formData.append('language', input.language)
    if (input.title.trim()) formData.append('title', input.title.trim())

    try {
      const response = await request(`/v1/workspaces/${workspaceId()}/knowledge/documents`, {
        method: 'POST',
        body: formData,
      })
      const payload = knowledgeDocumentUploadResponseSchema.parse(await response.json())
      notice.value = payload.duplicate ? 'duplicate' : 'uploaded'
      await loadDocuments()
      return true
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Document upload failed.'
      return false
    } finally {
      isUploading.value = false
    }
  }

  const loadChunks = async (documentId: string): Promise<void> => {
    selectedDocumentId.value = documentId
    isLoadingChunks.value = true
    error.value = null
    chunks.value = []
    try {
      const response = await request(
        `/v1/workspaces/${workspaceId()}/knowledge/documents/${documentId}/chunks`,
      )
      chunks.value = knowledgeChunkListResponseSchema.parse(await response.json()).chunks
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Chunk loading failed.'
    } finally {
      isLoadingChunks.value = false
    }
  }

  const retryDocument = async (documentId: string): Promise<void> => {
    error.value = null
    notice.value = null
    try {
      await request(`/v1/workspaces/${workspaceId()}/knowledge/documents/${documentId}/retry`, {
        method: 'POST',
      })
      notice.value = 'retrying'
      await loadDocuments()
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Document retry failed.'
    }
  }

  const clearSelection = (): void => {
    selectedDocumentId.value = null
    chunks.value = []
  }

  return {
    chunks,
    clearSelection,
    documents,
    error,
    isLoading,
    isLoadingChunks,
    isUploading,
    loadChunks,
    loadDocuments,
    notice,
    retryDocument,
    selectedDocumentId,
    uploadDocument,
  }
})
