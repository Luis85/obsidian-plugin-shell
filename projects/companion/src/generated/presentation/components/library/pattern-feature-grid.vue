<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentSlots } from "../../../domain/components/contracts/pattern-feature-grid.ts";
import { specification as spec } from "../../../domain/visual/vc-77.ts";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-77" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-295" v-if="model.visible('vn-295')" :style="model.style('vn-295')" v-bind="model.attrs('vn-295')" v-on="model.on('vn-295')">
  <h2 data-design-node="vn-296" v-if="model.visible('vn-296')" :style="model.style('vn-296')">{{ model.text('vn-296') }}</h2>
  <p data-design-node="vn-297" v-if="model.visible('vn-297')" :style="model.style('vn-297')">{{ model.text('vn-297') }}</p>
  <div data-design-node="vn-298" v-if="model.visible('vn-298')" :style="model.style('vn-298')">
    <slot name="content">
      <p data-design-node="vn-300" v-if="model.visible('vn-300')">{{ model.text('vn-300') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-299" v-if="model.visible('vn-299')" :style="model.style('vn-299')" v-bind="model.props('vn-299')" v-on="model.on('vn-299')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
