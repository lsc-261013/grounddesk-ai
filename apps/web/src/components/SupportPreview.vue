<script setup lang="ts">
import { BookOpenCheck, CheckCircle2, MessageSquareText, TicketCheck } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <section class="support-preview" :aria-label="t('landing.preview.ariaLabel')">
    <header class="support-preview__header">
      <span><i></i>{{ t('landing.preview.label') }}</span>
      <small>{{ t('landing.preview.disclaimer') }}</small>
    </header>

    <div class="support-preview__conversation">
      <div class="support-preview__question">
        <MessageSquareText :size="17" aria-hidden="true" />
        <p>{{ t('landing.preview.question') }}</p>
      </div>

      <div class="support-preview__answer">
        <div class="support-preview__answer-meta">
          <span><CheckCircle2 :size="15" />{{ t('landing.preview.grounded') }}</span>
          <small>{{ t('landing.preview.latency') }}</small>
        </div>
        <p>{{ t('landing.preview.answer') }} <b>[1]</b></p>
        <details open>
          <summary><BookOpenCheck :size="15" />{{ t('landing.preview.sourceTitle') }}</summary>
          <blockquote>{{ t('landing.preview.sourceQuote') }}</blockquote>
        </details>
      </div>
    </div>

    <div class="support-preview__handoff">
      <span><TicketCheck :size="17" /></span>
      <div>
        <strong>{{ t('landing.preview.handoffTitle') }}</strong>
        <small>{{ t('landing.preview.handoffDescription') }}</small>
      </div>
      <b>{{ t('landing.preview.handoffStatus') }}</b>
    </div>
  </section>
</template>
