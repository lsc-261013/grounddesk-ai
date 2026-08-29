<script setup lang="ts">
import {
  AlertCircle,
  Check,
  ChevronRight,
  FileText,
  LoaderCircle,
  RefreshCw,
  UploadCloud,
  X,
} from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { KnowledgeDocument, Locale } from '@grounddesk/shared'

import { useAuthStore } from '../stores/auth'
import { useKnowledgeStore } from '../stores/knowledge'

const { locale, t } = useI18n()
const authStore = useAuthStore()
const knowledgeStore = useKnowledgeStore()
const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const form = reactive({ title: '', language: locale.value as Locale | 'bilingual' })
let refreshTimer: ReturnType<typeof setTimeout> | null = null

const canUpload = computed(() => authStore.activeMembership?.role === 'admin')
const selectedDocument = computed(() =>
  knowledgeStore.documents.find((document) => document.id === knowledgeStore.selectedDocumentId),
)

const formatBytes = (bytes: number): string => `${(bytes / 1024).toFixed(1)} KB`
const formatDate = (iso: string): string =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  )

const chooseFile = (): void => fileInput.value?.click()
const onFileChange = (event: Event): void => {
  const input = event.target as HTMLInputElement
  selectedFile.value = input.files?.[0] ?? null
  if (selectedFile.value && !form.title) {
    form.title = selectedFile.value.name.replace(/\.(pdf|md|markdown|txt)$/i, '')
  }
}

const upload = async (): Promise<void> => {
  if (!selectedFile.value) return
  const uploaded = await knowledgeStore.uploadDocument({
    file: selectedFile.value,
    title: form.title,
    language: form.language,
  })
  if (uploaded) {
    selectedFile.value = null
    form.title = ''
    if (fileInput.value) fileInput.value.value = ''
  }
}

const openChunks = async (document: KnowledgeDocument): Promise<void> => {
  if (document.status === 'ready') await knowledgeStore.loadChunks(document.id)
}

watch(
  () => knowledgeStore.documents.map((document) => document.status).join(','),
  (statuses) => {
    if (refreshTimer) clearTimeout(refreshTimer)
    if (statuses.includes('queued') || statuses.includes('processing')) {
      refreshTimer = setTimeout(() => void knowledgeStore.loadDocuments(), 1_500)
    }
  },
)

onMounted(() => void knowledgeStore.loadDocuments())
onBeforeUnmount(() => {
  if (refreshTimer) clearTimeout(refreshTimer)
  knowledgeStore.clearSelection()
})
</script>

<template>
  <div class="knowledge-page">
    <header class="console-page-heading">
      <div>
        <p class="console-kicker">PRIVATE SOURCES · REAL EMBEDDINGS</p>
        <h1>{{ t('knowledge.title') }}</h1>
        <p>{{ t('knowledge.description') }}</p>
      </div>
      <span class="document-limit">{{ knowledgeStore.documents.length }} / 20</span>
    </header>

    <section v-if="canUpload" class="upload-panel" aria-labelledby="upload-title">
      <div class="upload-panel__heading">
        <div>
          <h2 id="upload-title">{{ t('knowledge.uploadTitle') }}</h2>
          <p>{{ t('knowledge.uploadHint') }}</p>
        </div>
        <UploadCloud :size="22" />
      </div>

      <div class="upload-grid">
        <button class="file-picker" type="button" @click="chooseFile">
          <FileText :size="18" />
          <span>{{ selectedFile?.name ?? t('knowledge.chooseFile') }}</span>
        </button>
        <input
          ref="fileInput"
          class="visually-hidden"
          type="file"
          accept=".pdf,.md,.markdown,.txt,application/pdf,text/markdown,text/plain"
          @change="onFileChange"
        />
        <label>
          <span>{{ t('knowledge.documentTitle') }}</span>
          <input v-model.trim="form.title" type="text" maxlength="180" />
        </label>
        <label>
          <span>{{ t('knowledge.language') }}</span>
          <select v-model="form.language">
            <option value="zh-CN">中文</option>
            <option value="en-US">English</option>
            <option value="bilingual">{{ t('knowledge.bilingual') }}</option>
          </select>
        </label>
        <button
          class="console-primary-button"
          type="button"
          :disabled="!selectedFile || knowledgeStore.isUploading"
          @click="upload"
        >
          <LoaderCircle v-if="knowledgeStore.isUploading" class="spin" :size="16" />
          <UploadCloud v-else :size="16" />
          {{ knowledgeStore.isUploading ? t('knowledge.uploading') : t('knowledge.upload') }}
        </button>
      </div>
    </section>

    <p v-else class="permission-note">{{ t('knowledge.readOnly') }}</p>
    <p v-if="knowledgeStore.error" class="console-alert" role="alert">
      <AlertCircle :size="17" />{{ t('knowledge.error') }}
    </p>
    <p v-if="knowledgeStore.notice" class="console-notice" role="status">
      <Check :size="16" />{{ t(`knowledge.notice.${knowledgeStore.notice}`) }}
    </p>

    <section class="document-panel" aria-labelledby="document-list-title">
      <div class="document-panel__heading">
        <div>
          <h2 id="document-list-title">{{ t('knowledge.sources') }}</h2>
          <p>{{ t('knowledge.sourcesHint') }}</p>
        </div>
        <button
          type="button"
          :aria-label="t('knowledge.refresh')"
          @click="knowledgeStore.loadDocuments"
        >
          <RefreshCw :size="16" :class="{ spin: knowledgeStore.isLoading }" />
        </button>
      </div>

      <div
        v-if="knowledgeStore.isLoading && knowledgeStore.documents.length === 0"
        class="document-state"
      >
        <LoaderCircle class="spin" :size="20" />{{ t('knowledge.loading') }}
      </div>
      <div v-else-if="knowledgeStore.documents.length === 0" class="document-state">
        <FileText :size="22" />{{ t('knowledge.empty') }}
      </div>
      <ul v-else class="document-list">
        <li v-for="document in knowledgeStore.documents" :key="document.id">
          <button
            type="button"
            :disabled="document.status !== 'ready'"
            @click="openChunks(document)"
          >
            <span class="document-icon"><FileText :size="17" /></span>
            <span class="document-main">
              <strong>{{ document.title }}</strong>
              <small>
                {{ document.originalFilename }} · {{ formatBytes(document.byteSize) }} ·
                {{ formatDate(document.updatedAt) }}
              </small>
              <em v-if="document.failureMessage">{{ document.failureMessage }}</em>
            </span>
            <span class="status-badge" :data-status="document.status">
              <LoaderCircle
                v-if="document.status === 'queued' || document.status === 'processing'"
                class="spin"
                :size="13"
              />
              {{ t(`knowledge.status.${document.status}`) }}
            </span>
            <span class="chunk-count">{{ document.chunkCount }} {{ t('knowledge.chunks') }}</span>
            <ChevronRight :size="16" />
          </button>
          <button
            v-if="document.status === 'failed' && canUpload"
            class="retry-button"
            type="button"
            @click="knowledgeStore.retryDocument(document.id)"
          >
            <RefreshCw :size="13" />{{ t('knowledge.retry') }}
          </button>
        </li>
      </ul>
    </section>

    <aside v-if="selectedDocument" class="chunk-drawer" aria-labelledby="chunk-title">
      <div class="chunk-drawer__header">
        <div>
          <p class="console-kicker">CHUNK PREVIEW</p>
          <h2 id="chunk-title">{{ selectedDocument.title }}</h2>
        </div>
        <button
          type="button"
          :aria-label="t('knowledge.close')"
          @click="knowledgeStore.clearSelection"
        >
          <X :size="18" />
        </button>
      </div>
      <p v-if="knowledgeStore.isLoadingChunks" class="document-state">
        <LoaderCircle class="spin" :size="18" />{{ t('knowledge.loading') }}
      </p>
      <ol v-else class="chunk-list">
        <li v-for="chunk in knowledgeStore.chunks" :key="chunk.id">
          <div>
            <span>#{{ String(chunk.chunkIndex + 1).padStart(2, '0') }}</span>
            <span>{{ chunk.sectionPath.join(' / ') || t('knowledge.noSection') }}</span>
            <span v-if="chunk.pageStart">
              p.{{ chunk.pageStart
              }}<template v-if="chunk.pageEnd !== chunk.pageStart">–{{ chunk.pageEnd }}</template>
            </span>
          </div>
          <p>{{ chunk.content }}</p>
          <small v-if="chunk.productModels.length">{{ chunk.productModels.join(' · ') }}</small>
        </li>
      </ol>
    </aside>
    <button
      v-if="selectedDocument"
      class="drawer-backdrop"
      type="button"
      :aria-label="t('knowledge.close')"
      @click="knowledgeStore.clearSelection"
    ></button>
  </div>
</template>
