<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentSlots } from "../../../domain/components/contracts/pattern-breadcrumbs.ts";
import { specification as spec } from "../../../domain/visual/vc-86.ts";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-86" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-358" v-if="model.visible('vn-358')" :style="model.style('vn-358')" v-bind="model.attrs('vn-358')" v-on="model.on('vn-358')">
  <h2 data-design-node="vn-359" v-if="model.visible('vn-359')" :style="model.style('vn-359')">{{ model.text('vn-359') }}</h2>
  <p data-design-node="vn-360" v-if="model.visible('vn-360')" :style="model.style('vn-360')">{{ model.text('vn-360') }}</p>
  <div data-design-node="vn-361" v-if="model.visible('vn-361')" :style="model.style('vn-361')">
    <slot name="content">
      <p data-design-node="vn-363" v-if="model.visible('vn-363')">{{ model.text('vn-363') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-362" v-if="model.visible('vn-362')" :style="model.style('vn-362')" v-bind="model.props('vn-362')" v-on="model.on('vn-362')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
