<script setup lang="ts">
import { ref, nextTick, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import UButton from '@nuxt/ui/components/Button.vue';
import UInput from '@nuxt/ui/components/Input.vue';
import UCard from '@nuxt/ui/components/Card.vue';
import UBadge from '@nuxt/ui/components/Badge.vue';
import { useShowcase } from '../stores/showcase';
import { useServices } from '../context';
const { t } = useI18n();
const model = useShowcase();
const services = useServices();
const input = model.draft;
const uid = useId();
const form = ref<HTMLFormElement>();
async function preview() {
  model.preview({ ...input });
  await nextTick();
  if (model.error?.field) form.value?.querySelector<HTMLInputElement>(`[name="${model.error.field}"]`)?.focus();
}
</script>
<template>
  <div class="shell-page-heading"><div class="shell-eyebrow">DocumentCreationService</div><h1>{{ t('doc.title') }}</h1><p>{{ t('doc.subtitle') }}</p></div>
  <p v-if="services.host.kind === 'browser'" class="shell-info">{{ t('doc.browserNote') }}</p>
  <div class="shell-document-grid">
    <UCard><template #header><h2>{{ t('doc.form') }}</h2></template>
      <form ref="form" class="shell-form" @submit.prevent="preview">
        <div class="shell-field"><label :for="`${uid}-task-title`">{{ t('doc.label') }} <span aria-hidden="true">*</span></label><UInput :id="`${uid}-task-title`" v-model="input.title" name="title" :placeholder="t('doc.placeholder')" :disabled="model.busy || !!model.receipt || model.error?.effect === 'uncertain'" :aria-invalid="model.error?.field === 'title'" :aria-describedby="model.error?.field === 'title' ? `${uid}-document-error` : undefined" @update:model-value="model.reset()" /></div>
        <div class="shell-field"><label :for="`${uid}-task-due`">{{ t('doc.due') }}</label><UInput :id="`${uid}-task-due`" v-model="input.due" name="due" type="date" :disabled="model.busy || !!model.receipt || model.error?.effect === 'uncertain'" :aria-invalid="model.error?.field === 'due'" :aria-describedby="model.error?.field === 'due' ? `${uid}-document-error` : undefined" @update:model-value="model.reset()" /></div>
        <div class="shell-field"><label :for="`${uid}-task-tags`">{{ t('doc.tags') }}</label><UInput :id="`${uid}-task-tags`" v-model="input.tags" name="tags" :aria-invalid="model.error?.field === 'tags'" :aria-describedby="model.error?.field === 'tags' ? `${uid}-document-error` : undefined" placeholder="work, release" :disabled="model.busy || !!model.receipt || model.error?.effect === 'uncertain'" @update:model-value="model.reset()" /><small>{{ t('doc.tagsHint') }}</small></div>
        <p v-if="model.error" :id="`${uid}-document-error`" class="shell-error" role="alert">{{ t(model.error.key) }}</p>
        <UButton type="submit" icon="i-lucide-scan-text" :disabled="model.busy || !!model.receipt || model.error?.effect === 'uncertain'">{{ t('doc.preview') }}</UButton>
        <p class="shell-hint">{{ t('doc.note') }}</p>
      </form>
    </UCard>
    <UCard class="shell-preview"><template #header><div class="shell-section-heading"><h2>{{ t('doc.previewTitle') }}</h2><UBadge color="neutral" variant="subtle">Markdown</UBadge></div></template>
      <template v-if="model.prepared"><div class="shell-destination"><small>{{ t('doc.destination') }}</small><code>{{ model.prepared.path }}</code></div><pre data-testid="markdown-preview"><code>{{ model.prepared.markdown }}</code></pre>
        <div v-if="model.receipt" class="shell-created"><strong role="status">{{ t('doc.created') }}</strong><div class="shell-actions"><UButton icon="i-lucide-arrow-up-right" @click="model.openCreated">{{ t('doc.open') }}</UButton><UButton color="neutral" variant="outline" @click="model.reset">{{ t('doc.new') }}</UButton></div></div>
        <div v-else class="shell-actions"><UButton icon="i-lucide-file-check-2" :loading="model.busy" :disabled="!!model.error" @click="model.commit">{{ t(model.busy ? 'doc.creating' : 'doc.commit') }}</UButton><UButton color="neutral" variant="ghost" :disabled="model.busy || model.error?.effect === 'uncertain'" @click="model.reset">{{ t('doc.edit') }}</UButton></div>
      </template>
      <div v-else class="shell-empty"><span aria-hidden="true">⌘</span><h3>{{ t('doc.empty') }}</h3><p>{{ t('doc.emptyText') }}</p></div>
    </UCard>
  </div>
</template>
