<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import { specification as spec } from "../../../domain/visual/vp-736.ts";
import UAlert from "@nuxt/ui/components/Alert.vue";
import UButton from "@nuxt/ui/components/Button.vue";
import UInput from "@nuxt/ui/components/Input.vue";
import UTable from "@nuxt/ui/components/Table.vue";
import TestOperationPanel from "../library/test-operation-panel.vue";
const props = defineProps<{ designState?: VisualState; designScenario?: string }>();
const emit = defineEmits<{ interaction: [request: VisualRequest] }>();
const model = useVisual(spec, props, request => emit('interaction', request));
</script>
<template>
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vp-736" :data-design-state="model.state.value" :aria-label="spec.name" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-737" v-if="model.visible('vn-737')" :style="model.style('vn-737')" v-bind="model.attrs('vn-737')" v-on="model.on('vn-737')">
  <h2 data-design-node="vn-738" v-if="model.visible('vn-738')" :style="model.style('vn-738')">{{ model.text('vn-738') }}</h2>
  <p data-design-node="vn-739" v-if="model.visible('vn-739')" :style="model.style('vn-739')">{{ model.text('vn-739') }}</p>
  <UInput data-design-node="vn-740" v-if="model.visible('vn-740')" :style="model.style('vn-740')" :aria-description="model.a11y('vn-740')" v-bind="model.props('vn-740')" v-on="model.on('vn-740')"></UInput>
  <UTable data-design-node="vn-741" v-if="model.visible('vn-741')" :style="model.style('vn-741')" v-bind="model.props('vn-741')" v-on="model.on('vn-741')">
    <template #empty>
      <p data-design-node="vn-749" v-if="model.visible('vn-749')">{{ model.text('vn-749') }}</p>
    </template>
  </UTable>
  <TestOperationPanel data-design-node="vn-742" v-if="model.visible('vn-742')" :style="model.style('vn-742')" v-bind="model.props('vn-742')" :design-state="model.state.value === 'default' ? undefined : model.state.value" v-on="model.on('vn-742')">
    <template #content>
      <p data-design-node="vn-743" v-if="model.visible('vn-743')" :style="model.style('vn-743')">{{ model.text('vn-743') }}</p>
    </template>
  </TestOperationPanel>
  <div data-design-node="vn-744" v-if="model.visible('vn-744')" :style="model.style('vn-744')" v-bind="model.attrs('vn-744')" v-on="model.on('vn-744')">
    <UButton data-design-node="vn-745" v-if="model.visible('vn-745')" :style="model.style('vn-745')" v-bind="model.props('vn-745')" v-on="model.on('vn-745')"></UButton>
    <UButton data-design-node="vn-746" v-if="model.visible('vn-746')" :style="model.style('vn-746')" v-bind="model.props('vn-746')" v-on="model.on('vn-746')"></UButton>
  </div>
  <UAlert data-design-node="vn-747" v-if="model.visible('vn-747')" :style="model.style('vn-747')" v-bind="model.props('vn-747')" v-on="model.on('vn-747')"></UAlert>
  <UButton data-design-node="vn-748" v-if="model.visible('vn-748')" :style="model.style('vn-748')" v-bind="model.props('vn-748')" v-on="model.on('vn-748')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
