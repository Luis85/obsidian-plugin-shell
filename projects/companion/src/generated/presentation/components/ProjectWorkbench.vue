<script setup lang="ts">
import { useWorkbench } from '../composables/use-workbench.ts';
const model = useWorkbench();
</script>
<template>
  <div class="generated-workbench">
    <nav v-if="!model.context.isolated" aria-label="Project navigation">
      <button v-for="item in model.items" :key="item.id" type="button" :aria-current="model.navigation.current === item.id ? 'page' : undefined" @click="model.navigation.open(item.id)">{{ item.label }}</button>
      <button type="button" :disabled="!model.navigation.history.length" @click="model.navigation.back()">Back</button>
    </nav>
    <main :inert="model.context.designState?.() === 'disabled' || model.context.designState?.() === 'loading'"><component :is="model.context.panels[model.navigation.current]" :design-state="model.context.designState?.()" /></main>
  </div>
</template>
