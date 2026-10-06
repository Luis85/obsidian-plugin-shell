<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentSlots } from "../../../domain/components/contracts/pattern-testimonials.ts";
import { specification as spec } from "../../../domain/visual/vc-79.ts";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-79" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-309" v-if="model.visible('vn-309')" :style="model.style('vn-309')" v-bind="model.attrs('vn-309')" v-on="model.on('vn-309')">
  <h2 data-design-node="vn-310" v-if="model.visible('vn-310')" :style="model.style('vn-310')">{{ model.text('vn-310') }}</h2>
  <p data-design-node="vn-311" v-if="model.visible('vn-311')" :style="model.style('vn-311')">{{ model.text('vn-311') }}</p>
  <div data-design-node="vn-312" v-if="model.visible('vn-312')" :style="model.style('vn-312')">
    <slot name="content">
      <p data-design-node="vn-314" v-if="model.visible('vn-314')">{{ model.text('vn-314') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-313" v-if="model.visible('vn-313')" :style="model.style('vn-313')" v-bind="model.props('vn-313')" v-on="model.on('vn-313')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
