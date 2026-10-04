<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentEvents, ComponentSlots } from "../../../domain/components/contracts/shell-handoff-panel.ts";
import { specification as spec } from "../../../domain/visual/vc-108.ts";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-108" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-524" v-if="model.visible('vn-524')" :style="model.style('vn-524')" v-bind="model.attrs('vn-524')" v-on="model.on('vn-524')">
  <h2 data-design-node="vn-525" v-if="model.visible('vn-525')" :style="model.style('vn-525')">{{ model.text('vn-525') }}</h2>
  <p data-design-node="vn-526" v-if="model.visible('vn-526')" :style="model.style('vn-526')">{{ model.text('vn-526') }}</p>
  <div data-design-node="vn-527" v-if="model.visible('vn-527')" :style="model.style('vn-527')">
    <slot name="content">
      <p data-design-node="vn-529" v-if="model.visible('vn-529')">{{ model.text('vn-529') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-528" v-if="model.visible('vn-528')" :style="model.style('vn-528')" v-bind="model.props('vn-528')" v-on="model.on('vn-528')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
