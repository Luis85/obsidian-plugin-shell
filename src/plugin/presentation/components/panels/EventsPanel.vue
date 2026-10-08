<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue';
import UCard from '@nuxt/ui/components/Card.vue';
import UBadge from '@nuxt/ui/components/Badge.vue';
import { useShowcaseActions } from '../../composables/use-showcase-actions';
import { useShowcase } from '../../stores/showcase';
const model = useShowcase();
const { t, ping, notice, expected, modal, confirm, prompt, startRecovery, pendingRecovery } = useShowcaseActions();
</script>
<template>
  <div class="shell-page-heading"><div class="shell-eyebrow">TypedEventBus · NotificationService</div><h1>{{ t('events.title') }}</h1><p>{{ t('events.subtitle') }}</p></div>
  <div class="shell-actions shell-demo-actions"><UButton icon="i-lucide-radio" @click="ping">{{ t('events.ping') }}</UButton><UButton color="neutral" variant="outline" icon="i-lucide-bell" @click="notice">{{ t('events.notice') }}</UButton><UButton color="neutral" variant="outline" icon="i-lucide-message-square-warning" @click="expected">{{ t('events.error') }}</UButton><UButton color="neutral" variant="outline" icon="i-lucide-panel-top" @click="modal">{{ t('events.modal') }}</UButton><UButton color="neutral" variant="outline" @click="confirm">{{ t('modal.confirmTitle') }}</UButton><UButton color="neutral" variant="outline" @click="prompt">{{ t('modal.promptTitle') }}</UButton><UButton color="neutral" variant="outline" :disabled="pendingRecovery" @click="startRecovery">{{ t('recovery.start') }}</UButton></div>
  <UCard><template #header><div class="shell-section-heading"><h2>{{ t('events.log') }}</h2><UBadge color="primary" variant="soft">{{ model.eventCount }}</UBadge></div></template><table v-if="model.stream.length" class="shell-event-table"><thead><tr><th>{{ t('events.sequence') }}</th><th>{{ t('events.type') }}</th></tr></thead><tbody><tr v-for="event in model.stream" :key="event.sequence"><td>{{ String(event.sequence).padStart(3, '0') }}</td><td><code>{{ event.type }}</code></td></tr></tbody></table><p v-else class="shell-empty-text">{{ t('events.empty') }}</p><template #footer><small>{{ t('events.safety') }}</small></template></UCard>
  <UCard class="shell-diagnostics"><template #header><h2>{{ t('events.diagnostics') }}</h2></template><p v-if="!model.diagnostics.length" class="shell-hint">{{ t('events.noErrors') }}</p><div v-for="item in model.diagnostics" :key="item.sequence" class="shell-diagnostic"><code>{{ item.code }}</code><span>{{ item.operation }}</span></div></UCard>
</template>
