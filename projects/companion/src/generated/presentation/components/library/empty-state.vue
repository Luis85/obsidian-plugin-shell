<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentEvents, ComponentSlots } from "../../../domain/components/contracts/empty-state.ts";
import { specification as spec } from "../../../domain/visual/vc-57.ts";
import UAlert from "@nuxt/ui/components/Alert.vue";
import UButton from "@nuxt/ui/components/Button.vue";
const props = defineProps<ComponentProps & { designState?: VisualState; designScenario?: string }>();
const emit = defineEmits<ComponentEvents & { interaction: [request: VisualRequest] }>();
defineSlots<ComponentSlots>();
const model = useVisual(spec, props, request => emit('interaction', request), (name, payload) => {
  switch (name) {
    case "create": if (payload === undefined) { emit("create", payload); return; } throw new Error('VISUAL_EMIT_PAYLOAD');
    default: throw new Error('VISUAL_EMIT_UNKNOWN');
  }
});
</script>
<template>
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-57" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-142" v-if="model.visible('vn-142')" :style="model.style('vn-142')" v-bind="model.attrs('vn-142')" v-on="model.on('vn-142')">
  <h2 data-design-node="vn-143" v-if="model.visible('vn-143')" :style="model.style('vn-143')">{{ model.text('vn-143') }}</h2>
  <UAlert data-design-node="vn-144" v-if="model.visible('vn-144')" :style="model.style('vn-144')" v-bind="model.props('vn-144')" v-on="model.on('vn-144')"></UAlert>
  <div data-design-node="vn-145" v-if="model.visible('vn-145')" :style="model.style('vn-145')">
    <slot name="illustration">
      <p data-design-node="vn-147" v-if="model.visible('vn-147')">{{ model.text('vn-147') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-146" v-if="model.visible('vn-146')" :style="model.style('vn-146')" v-bind="model.props('vn-146')" v-on="model.on('vn-146')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
