<script setup lang="ts">
import { CheckCircle2, PackageCheck, Wrench } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

import type { ChatMessageView } from '../stores/chat'

defineProps<{ tool: ChatMessageView['tools'][number] }>()
const { t } = useI18n()
</script>

<template>
  <section class="demo-tool" :data-status="tool.status">
    <header>
      <Wrench :size="15" /><strong>{{ t(`playground.tool.${tool.toolName}`) }}</strong
      ><span>{{ t(`demo.experience.toolStatus.${tool.status}`) }}</span>
    </header>
    <p>{{ tool.summary }}</p>
    <div
      v-if="tool.status === 'succeeded' && tool.details?.kind === 'order_lookup'"
      class="demo-order-result"
    >
      <span><CheckCircle2 :size="14" />{{ t('presentation.demo.matched') }}</span>
      <div>
        <PackageCheck :size="32" :stroke-width="1.3" /><strong>{{
          t(`orders.status.${tool.details.orderStatus}`)
        }}</strong>
      </div>
      <small>{{ t('presentation.demo.notProgress') }}</small>
    </div>
    <dl v-if="tool.details?.kind === 'order_lookup'">
      <div>
        <dt>{{ t('demo.experience.orderNumber') }}</dt>
        <dd>{{ tool.details.orderNumber }}</dd>
      </div>
      <div>
        <dt>{{ t('demo.experience.orderStatus') }}</dt>
        <dd>{{ t(`orders.status.${tool.details.orderStatus}`) }}</dd>
      </div>
      <div>
        <dt>{{ t('demo.products') }}</dt>
        <dd>{{ tool.details.itemModels.join(' · ') }}</dd>
      </div>
    </dl>
    <dl v-else-if="tool.details?.kind === 'return_eligibility'">
      <div>
        <dt>{{ t('demo.experience.eligibility') }}</dt>
        <dd>{{ t(`demo.experience.returnStatus.${tool.details.eligibility}`) }}</dd>
      </div>
      <div>
        <dt>{{ t('demo.experience.policyVersion') }}</dt>
        <dd>{{ tool.details.policyVersion }}</dd>
      </div>
    </dl>
  </section>
</template>
