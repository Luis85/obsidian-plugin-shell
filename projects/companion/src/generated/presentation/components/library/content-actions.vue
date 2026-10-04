<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentSlots } from "../../../domain/components/contracts/content-actions.ts";
import { specification as spec } from "../../../domain/visual/vc-72.ts";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-72" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-260" v-if="model.visible('vn-260')" :style="model.style('vn-260')" v-bind="model.attrs('vn-260')" v-on="model.on('vn-260')">
  <h2 data-design-node="vn-261" v-if="model.visible('vn-261')" :style="model.style('vn-261')">{{ model.text('vn-261') }}</h2>
  <p data-design-node="vn-262" v-if="model.visible('vn-262')" :style="model.style('vn-262')">{{ model.text('vn-262') }}</p>
  <div data-design-node="vn-263" v-if="model.visible('vn-263')" :style="model.style('vn-263')">
    <slot name="content">
      <p data-design-node="vn-265" v-if="model.visible('vn-265')">{{ model.text('vn-265') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-264" v-if="model.visible('vn-264')" :style="model.style('vn-264')" v-bind="model.props('vn-264')" v-on="model.on('vn-264')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
