<script setup lang="ts">
import UApp from '@nuxt/ui/components/App.vue';
import ProjectWorkbench from './ProjectWorkbench.vue';
import { useClickdummy } from '../context/clickdummy.ts';
const model = useClickdummy();
</script>
<template>
<UApp><div class="clickdummy-preview">
<header class="clickdummy-toolbar">
  <div><h1>{{ model.name }}</h1><p>Clickdummy · synthetic read data · business writes unavailable</p></div>
  <div class="clickdummy-control"><label for="clickdummy-surface">Browse surfaces</label><select id="clickdummy-surface" :value="model.current()" @change="model.open(($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = model.current()"><option v-for="surface in model.surfaces" :key="surface.id" :value="surface.id">{{ surface.label }}</option></select></div>
  <div class="clickdummy-control"><label for="clickdummy-state">Preview state</label><select id="clickdummy-state" v-model="model.state.value" :disabled="model.editorSurface()"><option value="default">Default</option><option value="loading">Loading</option><option value="empty">Empty</option><option value="error">Error</option><option value="disabled">Disabled</option></select></div>
  <div class="clickdummy-control"><label for="clickdummy-scenario">Authored scenario</label><select id="clickdummy-scenario" :value="model.scenario()" :disabled="!model.scenarios().length" @change="model.selectScenario(($event.target as HTMLSelectElement).value)"><option value="">Synthetic reads (no scenario)</option><option v-for="scenario in model.scenarios()" :key="scenario.id" :value="scenario.id">{{ scenario.name }} · {{ scenario.state }} · {{ scenario.width }}</option></select></div>
  <button id="clickdummy-reset" type="button" @click="model.reset">Reset preview</button><button type="button" @click="model.exportProject">Project JSON</button>
</header>
<p v-if="model.scenario()" class="clickdummy-route" role="status">Authored sample data · local interactions only · no data is saved. Changing scenario resets local edits.</p>
<p class="clickdummy-route">{{ model.route() || 'No authored route for this surface' }}</p>
<p v-if="model.error.value" class="clickdummy-error" role="alert">{{ model.error.value }}</p>
<ProjectWorkbench :key="model.state.value + '/' + model.scenario()" />
</div></UApp>
</template>
