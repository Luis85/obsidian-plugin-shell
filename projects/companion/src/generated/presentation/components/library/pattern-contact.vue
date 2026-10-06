<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentSlots } from "../../../domain/components/contracts/pattern-contact.ts";
import { specification as spec } from "../../../domain/visual/vc-83.ts";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-83" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-337" v-if="model.visible('vn-337')" :style="model.style('vn-337')" v-bind="model.attrs('vn-337')" v-on="model.on('vn-337')">
  <h2 data-design-node="vn-338" v-if="model.visible('vn-338')" :style="model.style('vn-338')">{{ model.text('vn-338') }}</h2>
  <p data-design-node="vn-339" v-if="model.visible('vn-339')" :style="model.style('vn-339')">{{ model.text('vn-339') }}</p>
  <div data-design-node="vn-340" v-if="model.visible('vn-340')" :style="model.style('vn-340')">
    <slot name="content">
      <p data-design-node="vn-342" v-if="model.visible('vn-342')">{{ model.text('vn-342') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-341" v-if="model.visible('vn-341')" :style="model.style('vn-341')" v-bind="model.props('vn-341')" v-on="model.on('vn-341')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
