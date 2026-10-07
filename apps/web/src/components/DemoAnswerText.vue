<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ChatCitation } from '@grounddesk/shared'

import { answerBlocks, answerInlines } from '../utils/demoAnswer'

const props = defineProps<{ content: string; citations: ChatCitation[] }>()
const emit = defineEmits<{ citation: [ordinal: number] }>()
const { t } = useI18n()
const blocks = computed(() =>
  answerBlocks(props.content).map((block) => ({
    ...block,
    entries: block.lines.map((line) =>
      answerInlines(
        line,
        props.citations.map((c) => c.ordinal),
      ),
    ),
  })),
)
</script>

<template>
  <div class="demo-message__content">
    <component
      :is="block.kind === 'paragraph' ? 'p' : block.kind === 'ordered' ? 'ol' : 'ul'"
      v-for="(block, blockIndex) in blocks"
      :key="blockIndex"
    >
      <component
        :is="block.kind === 'paragraph' ? 'span' : 'li'"
        v-for="(entry, index) in block.entries"
        :key="index"
      >
        <template v-for="(part, partIndex) in entry" :key="partIndex">
          <strong v-if="part.kind === 'strong'">{{ part.text }}</strong>
          <a
            v-else-if="part.kind === 'link'"
            :href="part.href"
            target="_blank"
            rel="noopener noreferrer"
            >{{ part.text }}</a
          >
          <button
            v-else-if="part.kind === 'citation'"
            type="button"
            class="demo-citation-marker"
            :aria-label="t('demo.experience.sourceNumber', { number: part.ordinal })"
            @click="emit('citation', part.ordinal)"
          >
            {{ part.text }}
          </button>
          <template v-else>{{ part.text }}</template>
        </template>
        <br v-if="block.kind === 'paragraph' && index < block.entries.length - 1" />
      </component>
    </component>
  </div>
</template>
