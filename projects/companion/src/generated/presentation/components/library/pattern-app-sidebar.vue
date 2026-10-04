<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentSlots } from "../../../domain/components/contracts/pattern-app-sidebar.ts";
import { specification as spec } from "../../../domain/visual/vc-87.ts";
import UButton from "@nuxt/ui/components/Button.vue";
const props = defineProps<ComponentProps & { designState?: VisualState; designScenario?: string }>();
const emit = defineEmits<{ interaction: [request: VisualRequest] }>();
defineSlots<ComponentSlots>();
const model = useVisual(spec, props, request => emit('interaction', request), (name) => {
  switch (name) {
    default: throw new Error('VISUAL_EMIT_UNKNOWN');
  }
});
</script>
<template>
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-87" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-365" v-if="model.visible('vn-365')" :style="model.style('vn-365')" v-bind="model.attrs('vn-365')" v-on="model.on('vn-365')">
  <h2 data-design-node="vn-366" v-if="model.visible('vn-366')" :style="model.style('vn-366')">{{ model.text('vn-366') }}</h2>
  <ul data-design-node="vn-367" v-if="model.visible('vn-367')" :style="model.style('vn-367')" v-bind="model.attrs('vn-367')" v-on="model.on('vn-367')">
    <li data-design-node="vn-370" v-if="model.visible('vn-370')" v-bind="model.attrs('vn-370')" v-on="model.on('vn-370')">
      <span data-design-node="vn-371" v-if="model.visible('vn-371')">{{ model.text('vn-371') }}</span>
    </li>
    <li data-design-node="vn-372" v-if="model.visible('vn-372')" v-bind="model.attrs('vn-372')" v-on="model.on('vn-372')">
      <span data-design-node="vn-373" v-if="model.visible('vn-373')">{{ model.text('vn-373') }}</span>
    </li>
  </ul>
  <div data-design-node="vn-368" v-if="model.visible('vn-368')" :style="model.style('vn-368')">
    <slot name="content">
      <p data-design-node="vn-374" v-if="model.visible('vn-374')">{{ model.text('vn-374') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-369" v-if="model.visible('vn-369')" :style="model.style('vn-369')" v-bind="model.props('vn-369')" v-on="model.on('vn-369')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
