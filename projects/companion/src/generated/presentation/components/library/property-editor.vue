<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentEvents, ComponentSlots } from "../../../domain/components/contracts/property-editor.ts";
import { specification as spec } from "../../../domain/visual/vc-60.ts";
import UButton from "@nuxt/ui/components/Button.vue";
import UInput from "@nuxt/ui/components/Input.vue";
const props = defineProps<ComponentProps & { designState?: VisualState; designScenario?: string }>();
const emit = defineEmits<ComponentEvents & { interaction: [request: VisualRequest] }>();
defineSlots<ComponentSlots>();
const model = useVisual(spec, props, request => emit('interaction', request), (name, payload) => {
  switch (name) {
    case "change": if (typeof payload === "string") { emit("change", payload); return; } throw new Error('VISUAL_EMIT_PAYLOAD');
    case "cancel": if (payload === undefined) { emit("cancel", payload); return; } throw new Error('VISUAL_EMIT_PAYLOAD');
    default: throw new Error('VISUAL_EMIT_UNKNOWN');
  }
});
</script>
<template>
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-60" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-163" v-if="model.visible('vn-163')" :style="model.style('vn-163')" v-bind="model.attrs('vn-163')" v-on="model.on('vn-163')">
  <h2 data-design-node="vn-164" v-if="model.visible('vn-164')" :style="model.style('vn-164')">{{ model.text('vn-164') }}</h2>
  <UInput data-design-node="vn-165" v-if="model.visible('vn-165')" :style="model.style('vn-165')" :aria-description="model.a11y('vn-165')" v-bind="model.props('vn-165')" v-on="model.on('vn-165')"></UInput>
  <div data-design-node="vn-166" v-if="model.visible('vn-166')" :style="model.style('vn-166')">
    <slot name="help">
      <p data-design-node="vn-168" v-if="model.visible('vn-168')">{{ model.text('vn-168') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-167" v-if="model.visible('vn-167')" :style="model.style('vn-167')" v-bind="model.props('vn-167')" v-on="model.on('vn-167')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
