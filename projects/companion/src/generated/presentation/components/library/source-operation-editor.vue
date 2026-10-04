<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentEvents, ComponentSlots } from "../../../domain/components/contracts/source-operation-editor.ts";
import { specification as spec } from "../../../domain/visual/vc-103.ts";
import UButton from "@nuxt/ui/components/Button.vue";
import UInput from "@nuxt/ui/components/Input.vue";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-103" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-496" v-if="model.visible('vn-496')" :style="model.style('vn-496')" v-bind="model.attrs('vn-496')" v-on="model.on('vn-496')">
  <h2 data-design-node="vn-497" v-if="model.visible('vn-497')" :style="model.style('vn-497')">{{ model.text('vn-497') }}</h2>
  <UInput data-design-node="vn-498" v-if="model.visible('vn-498')" :style="model.style('vn-498')" :aria-description="model.a11y('vn-498')" v-bind="model.props('vn-498')" v-on="model.on('vn-498')"></UInput>
  <div data-design-node="vn-499" v-if="model.visible('vn-499')" :style="model.style('vn-499')">
    <slot name="content">
      <p data-design-node="vn-501" v-if="model.visible('vn-501')">{{ model.text('vn-501') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-500" v-if="model.visible('vn-500')" :style="model.style('vn-500')" v-bind="model.props('vn-500')" v-on="model.on('vn-500')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
