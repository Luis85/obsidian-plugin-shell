<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import { specification as spec } from "../../../domain/visual/vp-719.ts";
import UAlert from "@nuxt/ui/components/Alert.vue";
import UButton from "@nuxt/ui/components/Button.vue";
import UInput from "@nuxt/ui/components/Input.vue";
import UTable from "@nuxt/ui/components/Table.vue";
import SourceOperationEditor from "../library/source-operation-editor.vue";
const props = defineProps<{ designState?: VisualState; designScenario?: string }>();
const emit = defineEmits<{ interaction: [request: VisualRequest] }>();
const model = useVisual(spec, props, request => emit('interaction', request));
</script>
<template>
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vp-719" :data-design-state="model.state.value" :aria-label="spec.name" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-720" v-if="model.visible('vn-720')" :style="model.style('vn-720')" v-bind="model.attrs('vn-720')" v-on="model.on('vn-720')">
  <h2 data-design-node="vn-721" v-if="model.visible('vn-721')" :style="model.style('vn-721')">{{ model.text('vn-721') }}</h2>
  <p data-design-node="vn-722" v-if="model.visible('vn-722')" :style="model.style('vn-722')">{{ model.text('vn-722') }}</p>
  <UInput data-design-node="vn-723" v-if="model.visible('vn-723')" :style="model.style('vn-723')" :aria-description="model.a11y('vn-723')" v-bind="model.props('vn-723')" v-on="model.on('vn-723')"></UInput>
  <UTable data-design-node="vn-724" v-if="model.visible('vn-724')" :style="model.style('vn-724')" v-bind="model.props('vn-724')" v-on="model.on('vn-724')">
    <template #empty>
      <p data-design-node="vn-732" v-if="model.visible('vn-732')">{{ model.text('vn-732') }}</p>
    </template>
  </UTable>
  <SourceOperationEditor data-design-node="vn-725" v-if="model.visible('vn-725')" :style="model.style('vn-725')" v-bind="model.props('vn-725')" :design-state="model.state.value === 'default' ? undefined : model.state.value" v-on="model.on('vn-725')">
    <template #content>
      <p data-design-node="vn-726" v-if="model.visible('vn-726')" :style="model.style('vn-726')">{{ model.text('vn-726') }}</p>
    </template>
  </SourceOperationEditor>
  <div data-design-node="vn-727" v-if="model.visible('vn-727')" :style="model.style('vn-727')" v-bind="model.attrs('vn-727')" v-on="model.on('vn-727')">
    <UButton data-design-node="vn-728" v-if="model.visible('vn-728')" :style="model.style('vn-728')" v-bind="model.props('vn-728')" v-on="model.on('vn-728')"></UButton>
    <UButton data-design-node="vn-729" v-if="model.visible('vn-729')" :style="model.style('vn-729')" v-bind="model.props('vn-729')" v-on="model.on('vn-729')"></UButton>
  </div>
  <UAlert data-design-node="vn-730" v-if="model.visible('vn-730')" :style="model.style('vn-730')" v-bind="model.props('vn-730')" v-on="model.on('vn-730')"></UAlert>
  <UButton data-design-node="vn-731" v-if="model.visible('vn-731')" :style="model.style('vn-731')" v-bind="model.props('vn-731')" v-on="model.on('vn-731')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
