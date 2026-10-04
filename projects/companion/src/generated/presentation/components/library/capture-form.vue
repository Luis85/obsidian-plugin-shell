<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentEvents, ComponentSlots } from "../../../domain/components/contracts/capture-form.ts";
import { specification as spec } from "../../../domain/visual/vc-56.ts";
import UButton from "@nuxt/ui/components/Button.vue";
import UInput from "@nuxt/ui/components/Input.vue";
const props = defineProps<ComponentProps & { designState?: VisualState; designScenario?: string }>();
const emit = defineEmits<ComponentEvents & { interaction: [request: VisualRequest] }>();
defineSlots<ComponentSlots>();
const model = useVisual(spec, props, request => emit('interaction', request), (name, payload) => {
  switch (name) {
    case "submit": if (typeof payload === "string") { emit("submit", payload); return; } throw new Error('VISUAL_EMIT_PAYLOAD');
    case "cancel": if (payload === undefined) { emit("cancel", payload); return; } throw new Error('VISUAL_EMIT_PAYLOAD');
    default: throw new Error('VISUAL_EMIT_UNKNOWN');
  }
});
</script>
<template>
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-56" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-135" v-if="model.visible('vn-135')" :style="model.style('vn-135')" v-bind="model.attrs('vn-135')" v-on="model.on('vn-135')">
  <h2 data-design-node="vn-136" v-if="model.visible('vn-136')" :style="model.style('vn-136')">{{ model.text('vn-136') }}</h2>
  <UInput data-design-node="vn-137" v-if="model.visible('vn-137')" :style="model.style('vn-137')" :aria-description="model.a11y('vn-137')" v-bind="model.props('vn-137')" v-on="model.on('vn-137')"></UInput>
  <div data-design-node="vn-138" v-if="model.visible('vn-138')" :style="model.style('vn-138')">
    <slot name="footer">
      <p data-design-node="vn-140" v-if="model.visible('vn-140')">{{ model.text('vn-140') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-139" v-if="model.visible('vn-139')" :style="model.style('vn-139')" v-bind="model.props('vn-139')" v-on="model.on('vn-139')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
