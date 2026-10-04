<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentEvents, ComponentSlots } from "../../../domain/components/contracts/test-operation-panel.ts";
import { specification as spec } from "../../../domain/visual/vc-104.ts";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-104" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-503" v-if="model.visible('vn-503')" :style="model.style('vn-503')" v-bind="model.attrs('vn-503')" v-on="model.on('vn-503')">
  <h2 data-design-node="vn-504" v-if="model.visible('vn-504')" :style="model.style('vn-504')">{{ model.text('vn-504') }}</h2>
  <p data-design-node="vn-505" v-if="model.visible('vn-505')" :style="model.style('vn-505')">{{ model.text('vn-505') }}</p>
  <div data-design-node="vn-506" v-if="model.visible('vn-506')" :style="model.style('vn-506')">
    <slot name="content">
      <p data-design-node="vn-508" v-if="model.visible('vn-508')">{{ model.text('vn-508') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-507" v-if="model.visible('vn-507')" :style="model.style('vn-507')" v-bind="model.props('vn-507')" v-on="model.on('vn-507')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
