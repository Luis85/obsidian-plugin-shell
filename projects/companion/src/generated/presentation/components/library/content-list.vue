<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentSlots } from "../../../domain/components/contracts/content-list.ts";
import { specification as spec } from "../../../domain/visual/vc-65.ts";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-65" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-202" v-if="model.visible('vn-202')" :style="model.style('vn-202')" v-bind="model.attrs('vn-202')" v-on="model.on('vn-202')">
  <h2 data-design-node="vn-203" v-if="model.visible('vn-203')" :style="model.style('vn-203')">{{ model.text('vn-203') }}</h2>
  <ul data-design-node="vn-204" v-if="model.visible('vn-204')" :style="model.style('vn-204')" v-bind="model.attrs('vn-204')" v-on="model.on('vn-204')">
    <li data-design-node="vn-207" v-if="model.visible('vn-207')" v-bind="model.attrs('vn-207')" v-on="model.on('vn-207')">
      <span data-design-node="vn-208" v-if="model.visible('vn-208')">{{ model.text('vn-208') }}</span>
    </li>
    <li data-design-node="vn-209" v-if="model.visible('vn-209')" v-bind="model.attrs('vn-209')" v-on="model.on('vn-209')">
      <span data-design-node="vn-210" v-if="model.visible('vn-210')">{{ model.text('vn-210') }}</span>
    </li>
  </ul>
  <div data-design-node="vn-205" v-if="model.visible('vn-205')" :style="model.style('vn-205')">
    <slot name="content">
      <p data-design-node="vn-211" v-if="model.visible('vn-211')">{{ model.text('vn-211') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-206" v-if="model.visible('vn-206')" :style="model.style('vn-206')" v-bind="model.props('vn-206')" v-on="model.on('vn-206')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
