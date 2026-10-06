<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentSlots } from "../../../domain/components/contracts/content-empty.ts";
import { specification as spec } from "../../../domain/visual/vc-73.ts";
import UAlert from "@nuxt/ui/components/Alert.vue";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-73" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-267" v-if="model.visible('vn-267')" :style="model.style('vn-267')" v-bind="model.attrs('vn-267')" v-on="model.on('vn-267')">
  <h2 data-design-node="vn-268" v-if="model.visible('vn-268')" :style="model.style('vn-268')">{{ model.text('vn-268') }}</h2>
  <UAlert data-design-node="vn-269" v-if="model.visible('vn-269')" :style="model.style('vn-269')" v-bind="model.props('vn-269')" v-on="model.on('vn-269')"></UAlert>
  <div data-design-node="vn-270" v-if="model.visible('vn-270')" :style="model.style('vn-270')">
    <slot name="content">
      <p data-design-node="vn-272" v-if="model.visible('vn-272')">{{ model.text('vn-272') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-271" v-if="model.visible('vn-271')" :style="model.style('vn-271')" v-bind="model.props('vn-271')" v-on="model.on('vn-271')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
