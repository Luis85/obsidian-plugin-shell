<script setup lang="ts">
import UCard from '@nuxt/ui/components/Card.vue';
import UBadge from '@nuxt/ui/components/Badge.vue';
import DataForm from '../forms/DataForm.vue';
import { useFormsPage } from '../../composables/use-forms-page';
import { useFormsShowcase } from '../../stores/forms-showcase';
const { t, definition } = useFormsPage();
const page = useFormsShowcase();
</script>

<template>
  <div class="shell-page-heading"><div class="shell-eyebrow">{{ t('forms.eyebrow') }}</div><h1>{{ t('forms.title') }}</h1><p>{{ t('forms.subtitle') }}</p></div>
  <div class="shell-document-grid">
    <UCard><DataForm :definition="definition" @submit="page.accept" /></UCard>
    <UCard class="shell-preview"><template #header><div class="shell-section-heading"><h2>{{ t('forms.result') }}</h2><UBadge color="neutral" variant="subtle">JSON</UBadge></div></template>
      <pre v-if="page.submitted" data-testid="form-result" role="status"><code>{{ page.preview }}</code></pre>
      <div v-else class="shell-empty"><h3>{{ t('forms.empty') }}</h3><p>{{ t('forms.emptyText') }}</p></div>
      <p class="shell-hint">{{ t('forms.note') }}</p>
    </UCard>
  </div>
</template>
