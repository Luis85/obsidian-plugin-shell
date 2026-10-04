<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentSlots } from "../../../domain/components/contracts/content-detail.ts";
import { specification as spec } from "../../../domain/visual/vc-68.ts";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-68" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-232" v-if="model.visible('vn-232')" :style="model.style('vn-232')" v-bind="model.attrs('vn-232')" v-on="model.on('vn-232')">
  <h2 data-design-node="vn-233" v-if="model.visible('vn-233')" :style="model.style('vn-233')">{{ model.text('vn-233') }}</h2>
  <p data-design-node="vn-234" v-if="model.visible('vn-234')" :style="model.style('vn-234')">{{ model.text('vn-234') }}</p>
  <div data-design-node="vn-235" v-if="model.visible('vn-235')" :style="model.style('vn-235')">
    <slot name="content">
      <p data-design-node="vn-237" v-if="model.visible('vn-237')">{{ model.text('vn-237') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-236" v-if="model.visible('vn-236')" :style="model.style('vn-236')" v-bind="model.props('vn-236')" v-on="model.on('vn-236')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
