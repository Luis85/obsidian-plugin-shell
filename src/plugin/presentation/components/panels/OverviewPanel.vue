<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue';
import UBadge from '@nuxt/ui/components/Badge.vue';
import UCard from '@nuxt/ui/components/Card.vue';
import { useShowcaseActions } from '../../composables/use-showcase-actions';
import { useShowcase } from '../../stores/showcase';
const model = useShowcase();
const { t, modal } = useShowcaseActions();
const capabilities = ['documents', 'events', 'feedback', 'theme'];
</script>
<template>
  <section class="shell-hero"><div class="shell-eyebrow">{{ t('overview.subtitle') }}</div><h1>{{ t('app.tagline') }}</h1><p class="shell-lead">{{ t('app.intro') }}</p><div class="shell-actions"><UButton size="lg" icon="i-lucide-file-plus-2" @click="model.navigate('documents')">{{ t('overview.primary') }}</UButton><UButton size="lg" color="neutral" variant="outline" icon="i-lucide-panel-top" @click="modal">{{ t('overview.secondary') }}</UButton></div><p class="shell-hint">{{ t('overview.safe') }}</p></section>
  <div class="shell-stats"><div><strong>{{ model.createdCount }}</strong><span>{{ t('overview.statNotes') }}</span></div><div><strong>{{ model.eventCount }}</strong><span>{{ t('overview.statEvents') }}</span></div><div><strong>{{ model.preferences.locale.toUpperCase() }}</strong><span>{{ t('overview.statLocale') }}</span></div></div>
  <div class="shell-section-heading"><h2>{{ t('overview.title') }}</h2><UBadge color="success" variant="subtle">{{ t('overview.active') }}</UBadge></div>
  <div class="shell-card-grid"><UCard v-for="(card, index) in capabilities" :key="card" class="shell-capability"><div class="shell-card-number">0{{ index + 1 }}</div><h3>{{ t(`overview.cards.${card}`) }}</h3><p>{{ t(`overview.cards.${card}Text`) }}</p></UCard></div>
  <UCard class="shell-flow-card"><h3>{{ t('overview.flow') }}</h3><p>{{ t('overview.flowText') }}</p><div class="shell-flow">{{ t('overview.steps') }}</div></UCard>
  <div class="shell-stack"><span>{{ t('overview.stack') }}</span><UBadge v-for="name in ['Vue 3', 'Nuxt UI', 'Pinia', 'TypeScript', 'Vite', 'Vitest']" :key="name" color="neutral" variant="outline">{{ name }}</UBadge></div>
</template>
