<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import { specification as spec } from "../../../domain/visual/vp-887.ts";
import UAlert from "@nuxt/ui/components/Alert.vue";
import UButton from "@nuxt/ui/components/Button.vue";
import UInput from "@nuxt/ui/components/Input.vue";
import UTable from "@nuxt/ui/components/Table.vue";
import StatusNotice from "../library/status-notice.vue";
const props = defineProps<{ designState?: VisualState; designScenario?: string }>();
const emit = defineEmits<{ interaction: [request: VisualRequest] }>();
const model = useVisual(spec, props, request => emit('interaction', request));
</script>
<template>
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vp-887" :data-design-state="model.state.value" :aria-label="spec.name" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-888" v-if="model.visible('vn-888')" :style="model.style('vn-888')" v-bind="model.attrs('vn-888')" v-on="model.on('vn-888')">
  <h2 data-design-node="vn-889" v-if="model.visible('vn-889')" :style="model.style('vn-889')">{{ model.text('vn-889') }}</h2>
  <p data-design-node="vn-890" v-if="model.visible('vn-890')" :style="model.style('vn-890')">{{ model.text('vn-890') }}</p>
  <UInput data-design-node="vn-891" v-if="model.visible('vn-891')" :style="model.style('vn-891')" :aria-description="model.a11y('vn-891')" v-bind="model.props('vn-891')" v-on="model.on('vn-891')"></UInput>
  <UTable data-design-node="vn-892" v-if="model.visible('vn-892')" :style="model.style('vn-892')" v-bind="model.props('vn-892')" v-on="model.on('vn-892')">
    <template #empty>
      <p data-design-node="vn-900" v-if="model.visible('vn-900')">{{ model.text('vn-900') }}</p>
    </template>
  </UTable>
  <StatusNotice data-design-node="vn-893" v-if="model.visible('vn-893')" :style="model.style('vn-893')" v-bind="model.props('vn-893')" :design-state="model.state.value === 'default' ? undefined : model.state.value" v-on="model.on('vn-893')">
    <template #details>
      <p data-design-node="vn-894" v-if="model.visible('vn-894')" :style="model.style('vn-894')">{{ model.text('vn-894') }}</p>
    </template>
  </StatusNotice>
  <div data-design-node="vn-895" v-if="model.visible('vn-895')" :style="model.style('vn-895')" v-bind="model.attrs('vn-895')" v-on="model.on('vn-895')">
    <UButton data-design-node="vn-896" v-if="model.visible('vn-896')" :style="model.style('vn-896')" v-bind="model.props('vn-896')" v-on="model.on('vn-896')"></UButton>
    <UButton data-design-node="vn-897" v-if="model.visible('vn-897')" :style="model.style('vn-897')" v-bind="model.props('vn-897')" v-on="model.on('vn-897')"></UButton>
  </div>
  <UAlert data-design-node="vn-898" v-if="model.visible('vn-898')" :style="model.style('vn-898')" v-bind="model.props('vn-898')" v-on="model.on('vn-898')"></UAlert>
  <UButton data-design-node="vn-899" v-if="model.visible('vn-899')" :style="model.style('vn-899')" v-bind="model.props('vn-899')" v-on="model.on('vn-899')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
