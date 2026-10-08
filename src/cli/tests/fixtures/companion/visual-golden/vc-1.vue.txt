<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentEvents, ComponentSlots } from "../../../domain/components/contracts/library-search.ts";
import { specification as spec } from "../../../domain/visual/vc-1.ts";
import UButton from "@nuxt/ui/components/Button.vue";
import UInput from "@nuxt/ui/components/Input.vue";
const props = defineProps<ComponentProps & { designState?: VisualState; designScenario?: string }>();
const emit = defineEmits<ComponentEvents & { interaction: [request: VisualRequest] }>();
defineSlots<ComponentSlots>();
const model = useVisual(spec, props, request => emit('interaction', request), (name, payload) => {
  switch (name) {
    case "search": if (typeof payload === "string") { emit("search", payload); return; } throw new Error('VISUAL_EMIT_PAYLOAD');
    default: throw new Error('VISUAL_EMIT_UNKNOWN');
  }
});
</script>
<template>
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-1" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-6" v-if="model.visible('vn-6')" :style="model.style('vn-6')" v-bind="model.attrs('vn-6')" v-on="model.on('vn-6')">
  <UInput data-design-node="vn-3" v-if="model.visible('vn-3')" v-bind="model.props('vn-3')" v-on="model.on('vn-3')"></UInput>
  <UButton data-design-node="vn-4" v-if="model.visible('vn-4')" v-bind="model.props('vn-4')" v-on="model.on('vn-4')"></UButton>
  <div data-design-node="vn-7" v-if="model.visible('vn-7')">
    <slot name="actions"></slot>
  </div>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
