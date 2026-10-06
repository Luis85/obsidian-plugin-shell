<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentSlots } from "../../../domain/components/contracts/content-chart.ts";
import { specification as spec } from "../../../domain/visual/vc-70.ts";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-70" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-246" v-if="model.visible('vn-246')" :style="model.style('vn-246')" v-bind="model.attrs('vn-246')" v-on="model.on('vn-246')">
  <h2 data-design-node="vn-247" v-if="model.visible('vn-247')" :style="model.style('vn-247')">{{ model.text('vn-247') }}</h2>
  <p data-design-node="vn-248" v-if="model.visible('vn-248')" :style="model.style('vn-248')">{{ model.text('vn-248') }}</p>
  <div data-design-node="vn-249" v-if="model.visible('vn-249')" :style="model.style('vn-249')">
    <slot name="content">
      <p data-design-node="vn-251" v-if="model.visible('vn-251')">{{ model.text('vn-251') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-250" v-if="model.visible('vn-250')" :style="model.style('vn-250')" v-bind="model.props('vn-250')" v-on="model.on('vn-250')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
