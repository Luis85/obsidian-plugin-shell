<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import { specification as spec } from "../../../domain/visual/vp-955.ts";
import UAlert from "@nuxt/ui/components/Alert.vue";
import UButton from "@nuxt/ui/components/Button.vue";
import UInput from "@nuxt/ui/components/Input.vue";
import StatusNotice from "../library/status-notice.vue";
const props = defineProps<{ designState?: VisualState; designScenario?: string }>();
const emit = defineEmits<{ interaction: [request: VisualRequest] }>();
const model = useVisual(spec, props, request => emit('interaction', request));
</script>
<template>
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vp-955" :data-design-state="model.state.value" :aria-label="spec.name" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-956" v-if="model.visible('vn-956')" :style="model.style('vn-956')" v-bind="model.attrs('vn-956')" v-on="model.on('vn-956')">
  <h2 data-design-node="vn-957" v-if="model.visible('vn-957')" :style="model.style('vn-957')">{{ model.text('vn-957') }}</h2>
  <p data-design-node="vn-958" v-if="model.visible('vn-958')" :style="model.style('vn-958')">{{ model.text('vn-958') }}</p>
  <UInput data-design-node="vn-959" v-if="model.visible('vn-959')" :style="model.style('vn-959')" :aria-description="model.a11y('vn-959')" v-bind="model.props('vn-959')" v-on="model.on('vn-959')"></UInput>
  <ul data-design-node="vn-960" v-if="model.visible('vn-960')" :style="model.style('vn-960')" v-bind="model.attrs('vn-960')" v-on="model.on('vn-960')">
    <li data-design-node="vn-968" v-if="model.visible('vn-968')" v-bind="model.attrs('vn-968')" v-on="model.on('vn-968')">
      <span data-design-node="vn-969" v-if="model.visible('vn-969')">{{ model.text('vn-969') }}</span>
    </li>
    <li data-design-node="vn-970" v-if="model.visible('vn-970')" v-bind="model.attrs('vn-970')" v-on="model.on('vn-970')">
      <span data-design-node="vn-971" v-if="model.visible('vn-971')">{{ model.text('vn-971') }}</span>
    </li>
    <li data-design-node="vn-972" v-if="model.visible('vn-972')" v-bind="model.attrs('vn-972')" v-on="model.on('vn-972')">
      <span data-design-node="vn-973" v-if="model.visible('vn-973')">{{ model.text('vn-973') }}</span>
    </li>
  </ul>
  <StatusNotice data-design-node="vn-961" v-if="model.visible('vn-961')" :style="model.style('vn-961')" v-bind="model.props('vn-961')" :design-state="model.state.value === 'default' ? undefined : model.state.value" v-on="model.on('vn-961')">
    <template #details>
      <p data-design-node="vn-962" v-if="model.visible('vn-962')" :style="model.style('vn-962')">{{ model.text('vn-962') }}</p>
    </template>
  </StatusNotice>
  <div data-design-node="vn-963" v-if="model.visible('vn-963')" :style="model.style('vn-963')" v-bind="model.attrs('vn-963')" v-on="model.on('vn-963')">
    <UButton data-design-node="vn-964" v-if="model.visible('vn-964')" :style="model.style('vn-964')" v-bind="model.props('vn-964')" v-on="model.on('vn-964')"></UButton>
    <UButton data-design-node="vn-965" v-if="model.visible('vn-965')" :style="model.style('vn-965')" v-bind="model.props('vn-965')" v-on="model.on('vn-965')"></UButton>
  </div>
  <UAlert data-design-node="vn-966" v-if="model.visible('vn-966')" :style="model.style('vn-966')" v-bind="model.props('vn-966')" v-on="model.on('vn-966')"></UAlert>
  <UButton data-design-node="vn-967" v-if="model.visible('vn-967')" :style="model.style('vn-967')" v-bind="model.props('vn-967')" v-on="model.on('vn-967')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
