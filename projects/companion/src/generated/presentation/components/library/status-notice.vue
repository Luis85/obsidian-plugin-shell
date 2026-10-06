<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentEvents, ComponentSlots } from "../../../domain/components/contracts/status-notice.ts";
import { specification as spec } from "../../../domain/visual/vc-59.ts";
import UAlert from "@nuxt/ui/components/Alert.vue";
import UButton from "@nuxt/ui/components/Button.vue";
const props = defineProps<ComponentProps & { designState?: VisualState; designScenario?: string }>();
const emit = defineEmits<ComponentEvents & { interaction: [request: VisualRequest] }>();
defineSlots<ComponentSlots>();
const model = useVisual(spec, props, request => emit('interaction', request), (name, payload) => {
  switch (name) {
    case "retry": if (payload === undefined) { emit("retry", payload); return; } throw new Error('VISUAL_EMIT_PAYLOAD');
    default: throw new Error('VISUAL_EMIT_UNKNOWN');
  }
});
</script>
<template>
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-59" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-156" v-if="model.visible('vn-156')" :style="model.style('vn-156')" v-bind="model.attrs('vn-156')" v-on="model.on('vn-156')">
  <h2 data-design-node="vn-157" v-if="model.visible('vn-157')" :style="model.style('vn-157')">{{ model.text('vn-157') }}</h2>
  <UAlert data-design-node="vn-158" v-if="model.visible('vn-158')" :style="model.style('vn-158')" v-bind="model.props('vn-158')" v-on="model.on('vn-158')"></UAlert>
  <div data-design-node="vn-159" v-if="model.visible('vn-159')" :style="model.style('vn-159')">
    <slot name="details">
      <p data-design-node="vn-161" v-if="model.visible('vn-161')">{{ model.text('vn-161') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-160" v-if="model.visible('vn-160')" :style="model.style('vn-160')" v-bind="model.props('vn-160')" v-on="model.on('vn-160')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
