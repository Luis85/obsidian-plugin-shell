<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentEvents, ComponentSlots } from "../../../domain/components/contracts/filter-toolbar.ts";
import { specification as spec } from "../../../domain/visual/vc-58.ts";
import UButton from "@nuxt/ui/components/Button.vue";
import UInput from "@nuxt/ui/components/Input.vue";
const props = defineProps<ComponentProps & { designState?: VisualState; designScenario?: string }>();
const emit = defineEmits<ComponentEvents & { interaction: [request: VisualRequest] }>();
defineSlots<ComponentSlots>();
const model = useVisual(spec, props, request => emit('interaction', request), (name, payload) => {
  switch (name) {
    case "search": if (typeof payload === "string") { emit("search", payload); return; } throw new Error('VISUAL_EMIT_PAYLOAD');
    case "clear": if (payload === undefined) { emit("clear", payload); return; } throw new Error('VISUAL_EMIT_PAYLOAD');
    default: throw new Error('VISUAL_EMIT_UNKNOWN');
  }
});
</script>
<template>
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-58" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-149" v-if="model.visible('vn-149')" :style="model.style('vn-149')" v-bind="model.attrs('vn-149')" v-on="model.on('vn-149')">
  <h2 data-design-node="vn-150" v-if="model.visible('vn-150')" :style="model.style('vn-150')">{{ model.text('vn-150') }}</h2>
  <UInput data-design-node="vn-151" v-if="model.visible('vn-151')" :style="model.style('vn-151')" :aria-description="model.a11y('vn-151')" v-bind="model.props('vn-151')" v-on="model.on('vn-151')"></UInput>
  <div data-design-node="vn-152" v-if="model.visible('vn-152')" :style="model.style('vn-152')">
    <slot name="actions">
      <p data-design-node="vn-154" v-if="model.visible('vn-154')">{{ model.text('vn-154') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-153" v-if="model.visible('vn-153')" :style="model.style('vn-153')" v-bind="model.props('vn-153')" v-on="model.on('vn-153')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
