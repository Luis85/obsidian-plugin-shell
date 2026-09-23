<script setup lang="ts">
import UApp from '@nuxt/ui/components/App.vue';
import UButton from '@nuxt/ui/components/Button.vue';
import UBadge from '@nuxt/ui/components/Badge.vue';
import OverviewPanel from './panels/OverviewPanel.vue';
import DocumentPanel from './panels/DocumentPanel.vue';
import EventsPanel from './panels/EventsPanel.vue';
import SettingsPanel from './panels/SettingsPanel.vue';
import { useShowcaseShell } from '../composables/use-showcase-shell';
import { useShowcase } from '../stores/showcase';
const props = defineProps<{ portalRoot: HTMLElement; showViewActions?: (event: MouseEvent) => void }>();
const model = useShowcase();
const { t, locale, services, failed, uiLocale, icons, pages } = useShowcaseShell();
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
        <div class="shell-sidebar-bottom"><UBadge color="neutral" variant="subtle">{{ t('app.iteration') }}</UBadge><p>{{ t('app.local') }}</p><code>v{{ services.identity.version }}</code></div>
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
          <div v-for="item in model.feedback" :key="item.id" class="shell-feedback-item" :data-kind="item.kind" role="status"><span>{{ t(item.key) }}</span><UButton v-for="action in item.actions" :key="action.id" color="neutral" variant="outline" :disabled="action.busy" @click="services.notifications.invoke(item.id, action.id)">{{ t(action.labelKey) }}</UButton><UButton icon="i-lucide-x" color="neutral" variant="ghost" :aria-label="t('feedback.dismiss')" @click="services.notifications.dismiss(item.id)" /></div>
        </div>
      </div>
    </div>
  </UApp>
</template>
