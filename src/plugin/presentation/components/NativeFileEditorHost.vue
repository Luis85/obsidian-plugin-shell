<script setup lang="ts">
import type { Component } from 'vue';
import UApp from '@nuxt/ui/components/App.vue';
import { useAuthoringView } from '../composables/use-authoring-view';
const props = defineProps<{ portalRoot: HTMLElement; editor: Component }>();
const model = useAuthoringView();
</script>

<template>
  <UApp :toaster="null" :portal="props.portalRoot" :locale="model.uiLocale.value">
    <div :lang="model.locale.value">
      <component :is="props.editor" />
    </div>
  </UApp>
</template>
