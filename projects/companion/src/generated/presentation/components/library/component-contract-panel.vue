<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentEvents, ComponentSlots } from "../../../domain/components/contracts/component-contract-panel.ts";
import { specification as spec } from "../../../domain/visual/vc-106.ts";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-106" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-517" v-if="model.visible('vn-517')" :style="model.style('vn-517')" v-bind="model.attrs('vn-517')" v-on="model.on('vn-517')">
  <h2 data-design-node="vn-518" v-if="model.visible('vn-518')" :style="model.style('vn-518')">{{ model.text('vn-518') }}</h2>
  <UInput data-design-node="vn-519" v-if="model.visible('vn-519')" :style="model.style('vn-519')" :aria-description="model.a11y('vn-519')" v-bind="model.props('vn-519')" v-on="model.on('vn-519')"></UInput>
  <div data-design-node="vn-520" v-if="model.visible('vn-520')" :style="model.style('vn-520')">
    <slot name="content">
      <p data-design-node="vn-522" v-if="model.visible('vn-522')">{{ model.text('vn-522') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-521" v-if="model.visible('vn-521')" :style="model.style('vn-521')" v-bind="model.props('vn-521')" v-on="model.on('vn-521')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
