<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentEvents, ComponentSlots } from "../../../domain/components/contracts/record-card.ts";
import { specification as spec } from "../../../domain/visual/vc-55.ts";
import UButton from "@nuxt/ui/components/Button.vue";
const props = defineProps<ComponentProps & { designState?: VisualState; designScenario?: string }>();
const emit = defineEmits<ComponentEvents & { interaction: [request: VisualRequest] }>();
defineSlots<ComponentSlots>();
const model = useVisual(spec, props, request => emit('interaction', request), (name, payload) => {
  switch (name) {
    case "select": if (typeof payload === "string") { emit("select", payload); return; } throw new Error('VISUAL_EMIT_PAYLOAD');
    default: throw new Error('VISUAL_EMIT_UNKNOWN');
  }
});
</script>
<template>
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-55" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-128" v-if="model.visible('vn-128')" :style="model.style('vn-128')" v-bind="model.attrs('vn-128')" v-on="model.on('vn-128')">
  <h2 data-design-node="vn-129" v-if="model.visible('vn-129')" :style="model.style('vn-129')">{{ model.text('vn-129') }}</h2>
  <p data-design-node="vn-130" v-if="model.visible('vn-130')" :style="model.style('vn-130')">{{ model.text('vn-130') }}</p>
  <div data-design-node="vn-131" v-if="model.visible('vn-131')" :style="model.style('vn-131')">
    <slot name="actions">
      <p data-design-node="vn-133" v-if="model.visible('vn-133')">{{ model.text('vn-133') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-132" v-if="model.visible('vn-132')" :style="model.style('vn-132')" v-bind="model.props('vn-132')" v-on="model.on('vn-132')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
