<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentEvents, ComponentSlots } from "../../../domain/components/contracts/design-token-editor.ts";
import { specification as spec } from "../../../domain/visual/vc-105.ts";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-105" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-510" v-if="model.visible('vn-510')" :style="model.style('vn-510')" v-bind="model.attrs('vn-510')" v-on="model.on('vn-510')">
  <h2 data-design-node="vn-511" v-if="model.visible('vn-511')" :style="model.style('vn-511')">{{ model.text('vn-511') }}</h2>
  <UInput data-design-node="vn-512" v-if="model.visible('vn-512')" :style="model.style('vn-512')" :aria-description="model.a11y('vn-512')" v-bind="model.props('vn-512')" v-on="model.on('vn-512')"></UInput>
  <div data-design-node="vn-513" v-if="model.visible('vn-513')" :style="model.style('vn-513')">
    <slot name="content">
      <p data-design-node="vn-515" v-if="model.visible('vn-515')">{{ model.text('vn-515') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-514" v-if="model.visible('vn-514')" :style="model.style('vn-514')" v-bind="model.props('vn-514')" v-on="model.on('vn-514')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
