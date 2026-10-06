<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import { specification as spec } from "../../../domain/visual/vp-702.ts";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vp-702" :data-design-state="model.state.value" :aria-label="spec.name" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-703" v-if="model.visible('vn-703')" :style="model.style('vn-703')" v-bind="model.attrs('vn-703')" v-on="model.on('vn-703')">
  <h2 data-design-node="vn-704" v-if="model.visible('vn-704')" :style="model.style('vn-704')">{{ model.text('vn-704') }}</h2>
  <p data-design-node="vn-705" v-if="model.visible('vn-705')" :style="model.style('vn-705')">{{ model.text('vn-705') }}</p>
  <UInput data-design-node="vn-706" v-if="model.visible('vn-706')" :style="model.style('vn-706')" :aria-description="model.a11y('vn-706')" v-bind="model.props('vn-706')" v-on="model.on('vn-706')"></UInput>
  <UTable data-design-node="vn-707" v-if="model.visible('vn-707')" :style="model.style('vn-707')" v-bind="model.props('vn-707')" v-on="model.on('vn-707')">
    <template #empty>
      <p data-design-node="vn-715" v-if="model.visible('vn-715')">{{ model.text('vn-715') }}</p>
    </template>
  </UTable>
  <StatusNotice data-design-node="vn-708" v-if="model.visible('vn-708')" :style="model.style('vn-708')" v-bind="model.props('vn-708')" :design-state="model.state.value === 'default' ? undefined : model.state.value" v-on="model.on('vn-708')">
    <template #details>
      <p data-design-node="vn-709" v-if="model.visible('vn-709')" :style="model.style('vn-709')">{{ model.text('vn-709') }}</p>
    </template>
  </StatusNotice>
  <div data-design-node="vn-710" v-if="model.visible('vn-710')" :style="model.style('vn-710')" v-bind="model.attrs('vn-710')" v-on="model.on('vn-710')">
    <UButton data-design-node="vn-711" v-if="model.visible('vn-711')" :style="model.style('vn-711')" v-bind="model.props('vn-711')" v-on="model.on('vn-711')"></UButton>
    <UButton data-design-node="vn-712" v-if="model.visible('vn-712')" :style="model.style('vn-712')" v-bind="model.props('vn-712')" v-on="model.on('vn-712')"></UButton>
  </div>
  <UAlert data-design-node="vn-713" v-if="model.visible('vn-713')" :style="model.style('vn-713')" v-bind="model.props('vn-713')" v-on="model.on('vn-713')"></UAlert>
  <UButton data-design-node="vn-714" v-if="model.visible('vn-714')" :style="model.style('vn-714')" v-bind="model.props('vn-714')" v-on="model.on('vn-714')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
