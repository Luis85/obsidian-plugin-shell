<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentSlots } from "../../../domain/components/contracts/pattern-progress.ts";
import { specification as spec } from "../../../domain/visual/vc-96.ts";
import UAlert from "@nuxt/ui/components/Alert.vue";
import UButton from "@nuxt/ui/components/Button.vue";
const props = defineProps<ComponentProps & { designState?: VisualState; designScenario?: string }>();
const emit = defineEmits<{ interaction: [request: VisualRequest] }>();
defineSlots<ComponentSlots>();
const model = useVisual(spec, props, request => emit('interaction', request), (name) => {
  switch (name) {
    default: throw new Error('VISUAL_EMIT_UNKNOWN');
  }
});
</script>
<template>
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-96" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-440" v-if="model.visible('vn-440')" :style="model.style('vn-440')" v-bind="model.attrs('vn-440')" v-on="model.on('vn-440')">
  <h2 data-design-node="vn-441" v-if="model.visible('vn-441')" :style="model.style('vn-441')">{{ model.text('vn-441') }}</h2>
  <UAlert data-design-node="vn-442" v-if="model.visible('vn-442')" :style="model.style('vn-442')" v-bind="model.props('vn-442')" v-on="model.on('vn-442')"></UAlert>
  <div data-design-node="vn-443" v-if="model.visible('vn-443')" :style="model.style('vn-443')">
    <slot name="content">
      <p data-design-node="vn-445" v-if="model.visible('vn-445')">{{ model.text('vn-445') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-444" v-if="model.visible('vn-444')" :style="model.style('vn-444')" v-bind="model.props('vn-444')" v-on="model.on('vn-444')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
