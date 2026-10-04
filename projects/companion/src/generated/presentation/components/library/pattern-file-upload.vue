<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentSlots } from "../../../domain/components/contracts/pattern-file-upload.ts";
import { specification as spec } from "../../../domain/visual/vc-92.ts";
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
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-92" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-408" v-if="model.visible('vn-408')" :style="model.style('vn-408')" v-bind="model.attrs('vn-408')" v-on="model.on('vn-408')">
  <h2 data-design-node="vn-409" v-if="model.visible('vn-409')" :style="model.style('vn-409')">{{ model.text('vn-409') }}</h2>
  <p data-design-node="vn-410" v-if="model.visible('vn-410')" :style="model.style('vn-410')">{{ model.text('vn-410') }}</p>
  <div data-design-node="vn-411" v-if="model.visible('vn-411')" :style="model.style('vn-411')">
    <slot name="content">
      <p data-design-node="vn-413" v-if="model.visible('vn-413')">{{ model.text('vn-413') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-412" v-if="model.visible('vn-412')" :style="model.style('vn-412')" v-bind="model.props('vn-412')" v-on="model.on('vn-412')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
