<script setup lang="ts">
import { ref, onErrorCaptured, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import UApp from '@nuxt/ui/components/App.vue';
import UButton from '@nuxt/ui/components/Button.vue';
import UBadge from '@nuxt/ui/components/Badge.vue';
import { en, de } from '@nuxt/ui/locale';
import { pages, useShowcase } from './stores/showcase';
import { useServices } from './context';
import OverviewPanel from './panels/OverviewPanel.vue';
import DocumentPanel from './panels/DocumentPanel.vue';
import EventsPanel from './panels/EventsPanel.vue';
import SettingsPanel from './panels/SettingsPanel.vue';
const props = defineProps<{ portalRoot: HTMLElement; showViewActions?: (event: MouseEvent) => void }>();
const { t, locale } = useI18n();
const services = useServices();
const model = useShowcase();
const failed = ref(false);
const uiLocale = computed(() => locale.value === 'de' ? de : en);
onErrorCaptured(() => { failed.value = true; services.diagnostics.report('vue.render', 'view.render'); return false; });
const icons = { overview: 'i-lucide-layout-dashboard', documents: 'i-lucide-file-plus-2', events: 'i-lucide-radio', settings: 'i-lucide-sliders-horizontal' };
</script>

<template>
  <UApp :toaster="null" :portal="props.portalRoot" :locale="uiLocale">
    <div class="shell-app" data-testid="showcase" :lang="locale">
      <aside class="shell-sidebar" :aria-label="t('nav.section')">
        <div class="shell-brand"><span class="shell-brand-mark" aria-hidden="true">◈</span><div><strong>{{ t('app.title') }}</strong><small>{{ t('app.showcase') }}</small></div></div>
        <div class="shell-nav-label">{{ t('nav.section') }}</div>
        <nav class="shell-nav">
          <UButton v-for="item in pages" :key="item" :icon="icons[item]" :variant="model.page === item ? 'soft' : 'ghost'" :color="model.page === item ? 'primary' : 'neutral'" :aria-current="model.page === item ? 'page' : undefined" @click="model.navigate(item)">{{ t(`nav.${item}`) }}</UButton>
        </nav>
        <div class="shell-sidebar-bottom"><UBadge color="neutral" variant="subtle">{{ t('app.iteration') }}</UBadge><p>{{ t('app.local') }}</p><code>v0.2.0</code></div>
      </aside>
      <div class="shell-workspace">
        <header class="shell-header"><div class="shell-breadcrumb">{{ t('app.title') }} <span>/</span> <strong>{{ t(`nav.${model.page}`) }}</strong></div><div class="shell-header-status"><span class="shell-status-dot" aria-hidden="true" />{{ t('app.ready') }}<UBadge color="neutral" variant="outline">{{ t(services.host.kind === 'obsidian' ? 'app.native' : 'app.browser') }}</UBadge></div><UButton v-if="props.showViewActions" class="shell-view-actions" icon="i-lucide-ellipsis-vertical" color="neutral" variant="ghost" :aria-label="t('view.actions')" :title="t('view.actions')" @click="props.showViewActions" /></header>
        <main class="shell-main">
          <section class="shell-page">
          <div v-if="failed" role="alert" class="shell-error">{{ t('error.render') }}</div>
          <template v-else>
            <OverviewPanel v-if="model.page === 'overview'" />
            <DocumentPanel v-else-if="model.page === 'documents'" />
            <EventsPanel v-else-if="model.page === 'events'" />
            <SettingsPanel v-else />
          </template>
          </section>
          <footer class="shell-footer">{{ t('app.scope') }}</footer>
        </main>
        <div class="shell-feedback" aria-live="polite" aria-atomic="false">
          <div v-for="item in model.feedback" :key="item.id" class="shell-feedback-item" :data-kind="item.kind" role="status"><span>{{ t(item.key) }}</span><UButton icon="i-lucide-x" color="neutral" variant="ghost" :aria-label="t('feedback.dismiss')" @click="services.notifications.dismiss(item.id)" /></div>
        </div>
      </div>
    </div>
  </UApp>
</template>
