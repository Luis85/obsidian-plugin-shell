<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentSlots } from "../../../domain/components/contracts/pattern-tab-strip.ts";
import { specification as spec } from "../../../domain/visual/vc-88.ts";
import UButton from "@nuxt/ui/components/Button.vue";
import UTabs from "@nuxt/ui/components/Tabs.vue";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-88" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-376" v-if="model.visible('vn-376')" :style="model.style('vn-376')" v-bind="model.attrs('vn-376')" v-on="model.on('vn-376')">
  <h2 data-design-node="vn-377" v-if="model.visible('vn-377')" :style="model.style('vn-377')">{{ model.text('vn-377') }}</h2>
  <UTabs data-design-node="vn-378" v-if="model.visible('vn-378')" :style="model.style('vn-378')" v-bind="model.props('vn-378')" v-on="model.on('vn-378')"></UTabs>
  <div data-design-node="vn-379" v-if="model.visible('vn-379')" :style="model.style('vn-379')">
    <slot name="content">
      <p data-design-node="vn-381" v-if="model.visible('vn-381')">{{ model.text('vn-381') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-380" v-if="model.visible('vn-380')" :style="model.style('vn-380')" v-bind="model.props('vn-380')" v-on="model.on('vn-380')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
