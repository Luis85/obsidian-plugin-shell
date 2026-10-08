<script setup lang="ts">
import UApp from '@nuxt/ui/components/App.vue';
import UButton from '@nuxt/ui/components/Button.vue';
import AuthoringHost from './AuthoringHost.vue';
import { useAuthoringView } from '../composables/use-authoring-view';
const props = defineProps<{ portalRoot: HTMLElement; showViewActions?: (event: MouseEvent) => void }>();
const model = useAuthoringView();
</script>

<template>
  <UApp :toaster="null" :portal="props.portalRoot" :locale="model.uiLocale.value">
    <main :lang="model.locale.value">
      <UButton v-if="props.showViewActions" :aria-label="model.t('view.actions')" @click="props.showViewActions">{{ model.t('view.actions') }}</UButton>
      <AuthoringHost />
    </main>
  </UApp>
</template>
