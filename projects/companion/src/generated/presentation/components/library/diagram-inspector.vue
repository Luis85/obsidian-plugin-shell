<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentEvents, ComponentSlots } from "../../../domain/components/contracts/diagram-inspector.ts";
import { specification as spec } from "../../../domain/visual/vc-102.ts";
import UButton from "@nuxt/ui/components/Button.vue";
const props = defineProps<ComponentProps & { designState?: VisualState; designScenario?: string }>();
const emit = defineEmits<ComponentEvents & { interaction: [request: VisualRequest] }>();
defineSlots<ComponentSlots>();
const model = useVisual(spec, props, request => emit('interaction', request), (name, payload) => {
  switch (name) {
    case "select": if (typeof payload === "string") { emit("select", payload); return; } throw new Error('VISUAL_EMIT_PAYLOAD');
    case "cancel": if (payload === undefined) { emit("cancel", payload); return; } throw new Error('VISUAL_EMIT_PAYLOAD');
    default: throw new Error('VISUAL_EMIT_UNKNOWN');
  }
});
</script>
<template>
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-102" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-489" v-if="model.visible('vn-489')" :style="model.style('vn-489')" v-bind="model.attrs('vn-489')" v-on="model.on('vn-489')">
  <h2 data-design-node="vn-490" v-if="model.visible('vn-490')" :style="model.style('vn-490')">{{ model.text('vn-490') }}</h2>
  <p data-design-node="vn-491" v-if="model.visible('vn-491')" :style="model.style('vn-491')">{{ model.text('vn-491') }}</p>
  <div data-design-node="vn-492" v-if="model.visible('vn-492')" :style="model.style('vn-492')">
    <slot name="content">
      <p data-design-node="vn-494" v-if="model.visible('vn-494')">{{ model.text('vn-494') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-493" v-if="model.visible('vn-493')" :style="model.style('vn-493')" v-bind="model.props('vn-493')" v-on="model.on('vn-493')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
